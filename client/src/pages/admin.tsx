import { useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetectionConfigPanel } from "@/components/admin/DetectionConfigPanel";
import { ModelCertificationPanel } from "@/components/admin/ModelCertificationPanel";

const TABS = ["detection", "models"] as const;
type AdminTab = (typeof TABS)[number];

function normalizeTab(value: string | null): AdminTab {
  return TABS.includes(value as AdminTab) ? (value as AdminTab) : "detection";
}

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab = normalizeTab(params.get("tab"));

  const handleTabChange = (next: string) => {
    setParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.set("tab", next);
        return updated;
      },
      { replace: true }
    );
  };

  return (
    <PageShell
      title="Admin console"
      description="Manage the LinkedIn extension's detection rules and the AI models offered to users."
    >
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="detection">Extension detection</TabsTrigger>
          <TabsTrigger value="models">AI models</TabsTrigger>
        </TabsList>
        <TabsContent value="detection">
          <DetectionConfigPanel />
        </TabsContent>
        <TabsContent value="models">
          <ModelCertificationPanel />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
