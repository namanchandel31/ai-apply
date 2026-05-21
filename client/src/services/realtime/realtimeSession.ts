import {
  createRealtimeCoordinator,
  type RealtimeCoordinator,
} from "@/services/realtime/realtimeCoordinator";
import type { ConnectionState } from "@/services/realtime/transport/sseTransport";

let sharedCoordinator: RealtimeCoordinator | null = null;
let cacheSyncBound = false;
let coordinatorSessionStarted = false;
let bootstrapPrefetchDone = false;
const connectionListeners = new Set<(state: ConnectionState) => void>();

export function getSharedCoordinator() {
  if (!sharedCoordinator) {
    sharedCoordinator = createRealtimeCoordinator((state) => {
      for (const listener of connectionListeners) {
        listener(state);
      }
    });
  }
  return sharedCoordinator;
}

export function addConnectionListener(listener: (state: ConnectionState) => void) {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

export function ensureCoordinatorSession() {
  if (coordinatorSessionStarted && sharedCoordinator) return;
  if (sharedCoordinator) {
    shutdownCoordinatorSession();
  }
  getSharedCoordinator().start();
  coordinatorSessionStarted = true;
}

export function shutdownCoordinatorSession() {
  if (!sharedCoordinator) return;
  sharedCoordinator.shutdown();
  sharedCoordinator = null;
  coordinatorSessionStarted = false;
  bootstrapPrefetchDone = false;
  cacheSyncBound = false;
}

export function isCacheSyncBound() {
  return cacheSyncBound;
}

export function markCacheSyncBound() {
  cacheSyncBound = true;
}

export function getSharedCoordinatorRef() {
  return sharedCoordinator;
}

export function isBootstrapPrefetchDone() {
  return bootstrapPrefetchDone;
}

export function markBootstrapPrefetchDone() {
  bootstrapPrefetchDone = true;
}

export function clearConnectionListeners() {
  connectionListeners.clear();
}
