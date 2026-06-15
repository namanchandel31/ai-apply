import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/lib/api";
import { isApplyMode, readStoredAutoApplyEnabled, storeAutoApplyEnabled } from "@/lib/applyMode";
import { toast } from "sonner";

export function useAutoApply() {
  const { user, refreshUser } = useAuth();
  const [pending, setPending] = useState(false);

  const serverEnabled = isApplyMode(user?.applyMode)
    ? user.applyMode === "auto_apply"
    : readStoredAutoApplyEnabled();

  const [autoApplyEnabled, setEnabledState] = useState(serverEnabled);

  useEffect(() => {
    setEnabledState(serverEnabled);
    if (isApplyMode(user?.applyMode)) {
      storeAutoApplyEnabled(user.applyMode === "auto_apply");
    }
  }, [serverEnabled, user?.applyMode]);

  const setAutoApplyEnabled = useCallback(
    async (enabled: boolean) => {
      const applyMode = enabled ? "auto_apply" : "review_apply";
      setEnabledState(enabled);
      storeAutoApplyEnabled(enabled);
      setPending(true);
      try {
        await api.patchApplyMode(applyMode);
        await refreshUser();
      } catch (err) {
        setEnabledState(!enabled);
        storeAutoApplyEnabled(!enabled);
        toast.error(err instanceof Error ? err.message : "Failed to update apply mode");
      } finally {
        setPending(false);
      }
    },
    [refreshUser]
  );

  return { autoApplyEnabled, setAutoApplyEnabled, isApplyModePending: pending };
}
