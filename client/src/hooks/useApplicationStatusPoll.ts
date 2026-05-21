import { useEffect, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  api,
  type ApiError,
  type ApplicationRecord,
  type ApplicationStatusPayload,
} from "@/lib/api";
import { applyPollStatusToCache } from "@/services/realtime/cache/cacheSyncApi";
import {
  APPLICATION_POLL_SSE_FALLBACK_MS,
  APPLICATION_MAX_POLL_ATTEMPTS,
  MAX_CONSECUTIVE_POLL_ERRORS,
  POLL_BACKOFF_BASE_MS,
  POLL_BACKOFF_MAX_MS,
  POLL_RATE_LIMIT_DEFAULT_MS,
  STATUS_POLL_CONCURRENCY,
} from "@/constants/polling";
import { mapWithConcurrency } from "@/lib/pollLoopLogic";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import type { ConnectionState } from "@/services/realtime/transport/sseTransport";

export type PollTimeoutHandler = (applicationId: string) => void;
export type PollErrorHandler = (applicationId: string, message: string) => void;

let pollerGeneration = 0;
const etagClears = new Set<string>();

/** Clear cached ETag after explicit retry/continue revive. */
export function requestPollEtagClear(applicationId: string): void {
  etagClears.add(applicationId);
}

function jitterMs(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * 500) - 250;
}

function pollIntervalForConnection(
  state: ConnectionState,
  options: { sseReady: boolean; isLeader: boolean }
): number | null {
  if (options.sseReady || !options.isLeader) return null;
  if (state === "connected") return null;
  if (state === "degraded" || state === "disconnected") {
    return APPLICATION_POLL_SSE_FALLBACK_MS;
  }
  return null;
}

export function useApplicationStatusPoll(
  applications: ApplicationRecord[],
  queryClient: QueryClient,
  options?: {
    onPollTimeout?: PollTimeoutHandler;
    onPollError?: PollErrorHandler;
    connectionState?: ConnectionState;
    sseReady?: boolean;
    isLeader?: boolean;
  }
) {
  const appsRef = useRef(applications);
  appsRef.current = applications;

  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const globalPausedUntilRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickInFlightRef = useRef(false);
  const etagByAppIdRef = useRef<Record<string, string>>({});
  const timedOutRef = useRef<Set<string>>(new Set());

  const [pollableIdsKey, setPollableIdsKey] = useState("");
  const [visibilityEpoch, setVisibilityEpoch] = useState(0);

  const registry = globalOrchestrationRegistry;

  useEffect(() => {
    registry.syncFromPresentation(applications);
    const key = registry.getPollableIdsKey(APPLICATION_MAX_POLL_ATTEMPTS);
    setPollableIdsKey((prev) => (prev === key ? prev : key));
  }, [applications]);

  const connectionState = options?.connectionState ?? "disconnected";
  const sseReady = options?.sseReady ?? false;
  const isLeader = options?.isLeader ?? true;
  const pollIntervalMs = pollIntervalForConnection(connectionState, { sseReady, isLeader });

  useEffect(() => {
    const clearPoller = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
    };

    if (!pollableIdsKey || pollIntervalMs === null) {
      clearPoller();
      return;
    }

    const myGeneration = ++pollerGeneration;
    let cancelled = false;
    const prevKeyRef = { current: "" };

    const scheduleNext = (delayMs: number) => {
      if (cancelled || myGeneration !== pollerGeneration) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        void tick().finally(() => {
          if (!cancelled && myGeneration === pollerGeneration) {
            scheduleNext(jitterMs(pollIntervalMs));
          }
        });
      }, delayMs);
    };

    const tick = async () => {
      if (cancelled || myGeneration !== pollerGeneration) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (Date.now() < globalPausedUntilRef.current) return;
      if (tickInFlightRef.current) return;

      tickInFlightRef.current = true;
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      try {
        const current = appsRef.current;
        const now = Date.now();
        registry.evictInactive(now);

        const activeIds = registry.getPollableIds(APPLICATION_MAX_POLL_ATTEMPTS, now);
        const active = current.filter((a) => activeIds.includes(a.id));

        if (!active.length || cancelled || myGeneration !== pollerGeneration) return;

        for (const app of active) {
          registry.recordPollAttempt(app.id);
          const state = registry.get(app.id);
          if (state && state.pollAttempts >= APPLICATION_MAX_POLL_ATTEMPTS) {
            if (!timedOutRef.current.has(app.id)) {
              timedOutRef.current.add(app.id);
              optionsRef.current?.onPollTimeout?.(app.id);
            }
            registry.markTerminal(app.id);
          }
        }

        const stillIds = registry.getPollableIds(APPLICATION_MAX_POLL_ATTEMPTS, now);
        const stillPolling = current.filter((a) => stillIds.includes(a.id));
        if (!stillPolling.length || cancelled || myGeneration !== pollerGeneration) return;

        type PollUpdate = { id: string; status: ApplicationStatusPayload } | null;

        const updates = await mapWithConcurrency(
          stillPolling,
          STATUS_POLL_CONCURRENCY,
          async (app): Promise<PollUpdate> => {
            if (controller.signal.aborted) return null;
            const reg = registry.get(app.id);
            if (!reg || reg.prunedAt !== null) return null;

            try {
              if (etagClears.has(app.id)) {
                delete etagByAppIdRef.current[app.id];
                etagClears.delete(app.id);
              }
              const res = await api.getApplicationStatus(app.id, {
                signal: controller.signal,
                ifNoneMatch: etagByAppIdRef.current[app.id],
              });
              if (res.notModified) {
                if (res.etag) etagByAppIdRef.current[app.id] = res.etag;
                registry.clearPollError(app.id);
                return null;
              } else {
                if (res.etag) etagByAppIdRef.current[app.id] = res.etag;
                registry.clearPollError(app.id);

                const data = res.data as ApplicationStatusPayload & {
                  version?: number;
                  orchestrationEpoch?: number;
                  updatedAt?: string;
                };
                return { id: app.id, status: data };
              }
            } catch (e) {
              if (controller.signal.aborted) return null;
              const err = e as ApiError;
              if (err.status === 429) {
                const pauseMs = err.retryAfterMs ?? POLL_RATE_LIMIT_DEFAULT_MS;
                globalPausedUntilRef.current = Math.max(
                  globalPausedUntilRef.current,
                  Date.now() + pauseMs
                );
                return null;
              }
              const stateNow = registry.get(app.id);
              const count = (stateNow?.pollErrors ?? 0) + 1;
              const backoffUntil = Date.now() + Math.min(
                POLL_BACKOFF_BASE_MS * 2 ** (count - 1),
                POLL_BACKOFF_MAX_MS
              );
              registry.recordPollError(app.id, backoffUntil);
              if (count >= MAX_CONSECUTIVE_POLL_ERRORS) {
                optionsRef.current?.onPollError?.(
                  app.id,
                  e instanceof Error ? e.message : "Failed to fetch status"
                );
              }
              return null;
            }
          }
        );

        if (cancelled || myGeneration !== pollerGeneration || controller.signal.aborted) return;

        const byId = new Map(
          updates
            .filter((u): u is { id: string; status: ApplicationStatusPayload } => u !== null)
            .map((u) => [u.id, u.status])
        );
        if (byId.size === 0) return;

        for (const [id, status] of byId) {
          const becameTerminal = registry.upsertFromPoll({
            ...status,
            applicationId: id,
          });
          applyPollStatusToCache(queryClientRef.current, id, status);
          if (becameTerminal) {
            delete etagByAppIdRef.current[id];
            const key = registry.getPollableIdsKey(APPLICATION_MAX_POLL_ATTEMPTS);
            setPollableIdsKey((prev) => (prev === key ? prev : key));
          }
        }
      } finally {
        tickInFlightRef.current = false;
      }
    };

    const onVisibility = () => {
      if (cancelled || myGeneration !== pollerGeneration) return;
      if (document.visibilityState === "hidden") {
        clearPoller();
        return;
      }
      setVisibilityEpoch((n) => n + 1);
      const wasEmpty = prevKeyRef.current === "";
      prevKeyRef.current = pollableIdsKey;
      scheduleNext(wasEmpty ? 0 : jitterMs(100));
    };

    prevKeyRef.current = pollableIdsKey;

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    if (document.visibilityState !== "hidden") {
      scheduleNext(pollableIdsKey && prevKeyRef.current !== pollableIdsKey ? 0 : jitterMs(pollIntervalMs));
    }

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      clearPoller();
    };
  }, [pollableIdsKey, pollIntervalMs, visibilityEpoch, connectionState, sseReady, isLeader]);
}
