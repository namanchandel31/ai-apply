import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";

export type ChannelHandler = (payload: ApplicationUpdatedPayload) => void;

const noop: ChannelHandler = () => {};

export function createChannelRouter(handlers: {
  applications?: ChannelHandler;
  jobs?: ChannelHandler;
  notifications?: ChannelHandler;
  analytics?: ChannelHandler;
}) {
  const routes: Record<string, ChannelHandler> = {
    applications: handlers.applications ?? noop,
    jobs: handlers.jobs ?? noop,
    notifications: handlers.notifications ?? noop,
    analytics: handlers.analytics ?? noop,
  };

  return function route(channel: string, payload: ApplicationUpdatedPayload) {
    const handler = routes[channel] ?? noop;
    handler(payload);
  };
}
