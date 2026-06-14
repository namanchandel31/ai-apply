import { ApplicationsDashboard, RealtimeConnectionBadge } from "@/components/applications/ApplicationsDashboard";
import { PageShell } from "@/components/layout/PageShell";

export function Applications() {
  const disableTable =
    typeof window !== "undefined" && window.localStorage.getItem("debug:disableApplicationsTable") === "1";
  if (disableTable) {
    return (
      <PageShell title="Applications">
        <div>test</div>
      </PageShell>
    );
  }
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
