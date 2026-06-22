import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/auth/AuthContext";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";

/** Prefetch setup-status as soon as a session exists (parallel with auth user fetch). */
export function SetupStatusBootstrap() {
  const queryClient = useQueryClient();
  const session = useAuthSession();

  useEffect(() => {
    if (!session) return;
    void queryClient.ensureQueryData(setupStatusQueryOptions);
  }, [queryClient, session]);

  return null;
}
