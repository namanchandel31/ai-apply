import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";

const BACKOFF_MS = [2000, 2000, 5000, 5000, 10000, 10000];

/**
 * Polls setup-status while a resume is uploaded but not yet parsed.
 */
export function useResumeParsePolling(enabled: boolean) {
  const queryClient = useQueryClient();
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      attemptRef.current = 0;
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const poll = async () => {
      const data = await queryClient.fetchQuery(setupStatusQueryOptions);
      if (data?.hasValidResume) {
        attemptRef.current = 0;
        return;
      }
      const idx = Math.min(attemptRef.current, BACKOFF_MS.length - 1);
      const delay = BACKOFF_MS[idx];
      attemptRef.current += 1;
      timerRef.current = setTimeout(poll, delay);
    };

    poll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, queryClient]);
}
