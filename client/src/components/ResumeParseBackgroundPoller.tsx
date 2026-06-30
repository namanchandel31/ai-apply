import { useSetupStatus } from "@/hooks/useSetupStatus";
import { useResumeParsePolling } from "@/hooks/useResumeParsePolling";

/** Keeps setup-status fresh while a resume is uploaded but not yet parsed. */
export function ResumeParseBackgroundPoller() {
  const { data: status } = useSetupStatus();
  const parsingResume =
    !!status?.hasResume &&
    !status?.hasValidResume &&
    status?.resumeParseStatus !== "failed";
  useResumeParsePolling(parsingResume);
  return null;
}
