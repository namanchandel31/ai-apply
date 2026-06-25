import { ApplicationsDashboard, RealtimeConnectionBadge } from "@/components/applications/ApplicationsDashboard";
import { PageShell } from "@/components/layout/PageShell";

export function Applications() {
  return (
    <PageShell
      title="Applications"
      description="Track and debug AI-tailored job applications in real time."
      actions={<RealtimeConnectionBadge />}
    >
      <ApplicationsDashboard />
    </PageShell>
  );
}
