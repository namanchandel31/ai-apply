import { useCallback, useState } from "react";
import { readStoredAutoApplyEnabled, storeAutoApplyEnabled } from "@/lib/applyMode";

export function useAutoApply() {
  const [autoApplyEnabled, setEnabledState] = useState(() => readStoredAutoApplyEnabled());

  const setAutoApplyEnabled = useCallback((enabled: boolean) => {
    setEnabledState(enabled);
    storeAutoApplyEnabled(enabled);
  }, []);

  return { autoApplyEnabled, setAutoApplyEnabled };
}
