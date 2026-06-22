import { useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetectionConfigPanel } from "@/components/admin/DetectionConfigPanel";
import { ModelCertificationPanel } from "@/components/admin/ModelCertificationPanel";
import { AiCostPanel } from "@/components/admin/AiCostPanel";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { ReferralsPanel } from "@/components/admin/ReferralsPanel";
import { BillingSettingsPanel } from "@/components/admin/BillingSettingsPanel";
import { TrialConfigPanel } from "@/components/admin/TrialConfigPanel";
import { PlansPanel } from "@/components/admin/PlansPanel";
import { CampaignsPanel } from "@/components/admin/CampaignsPanel";
import { SubscriptionsPanel } from "@/components/admin/SubscriptionsPanel";

const TABS = ["settings", "trial", "plans", "campaigns", "subscriptions", "referrals", "users", "ai-cost", "detection", "models"] as const;
type AdminTab = (typeof TABS)[number];

function normalizeTab(value: string | null): AdminTab {
  return TABS.includes(value as AdminTab) ? (value as AdminTab) : "settings";
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
      description="Manage subscriptions, plans, campaigns, trial configuration, paywall settings, the LinkedIn extension's detection rules, and the AI models offered to users."
    >
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="trial">Trial</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="ai-cost">OneTap AI &amp; Cost</TabsTrigger>
          <TabsTrigger value="detection">Extension detection</TabsTrigger>
          <TabsTrigger value="models">Model certification</TabsTrigger>
        </TabsList>
        <TabsContent value="settings">
          <BillingSettingsPanel />
        </TabsContent>
        <TabsContent value="trial">
          <TrialConfigPanel />
        </TabsContent>
        <TabsContent value="plans">
          <PlansPanel />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsPanel />
        </TabsContent>
        <TabsContent value="subscriptions">
          <SubscriptionsPanel />
        </TabsContent>
        <TabsContent value="referrals">
          <ReferralsPanel />
        </TabsContent>
        <TabsContent value="users">
          <AdminUsersPanel />
        </TabsContent>
        <TabsContent value="ai-cost">
          <AiCostPanel />
        </TabsContent>
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
