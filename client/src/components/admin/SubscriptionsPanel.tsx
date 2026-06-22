import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminSubscription, type AdminPlan } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SubscriptionsPanel() {
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [grant, setGrant] = useState({ userId: "", planSlug: "", days: 30 });
  const [working, setWorking] = useState(false);

  const planById = (id: string) => plans.find((p) => p.id === id)?.slug ?? id.slice(0, 8);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([api.adminListSubscriptions(100, 0), api.adminListPlans()]);
      setSubs(s.data);
      setPlans(p.data);
      if (!grant.planSlug && p.data[0]) setGrant((g) => ({ ...g, planSlug: p.data[0].slug }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runGrant = async () => {
    if (!grant.userId || !grant.planSlug || !grant.days) {
      toast.error("User ID, plan and days are required");
      return;
    }
    setWorking(true);
    try {
      await api.adminSubscriptionAction(grant.userId, "grant", {
        planSlug: grant.planSlug,
        days: grant.days,
      });
      toast.success("Access granted/extended");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setWorking(false);
    }
  };

  const action = async (userId: string, act: string, body: Record<string, unknown> = {}) => {
    try {
      await api.adminSubscriptionAction(userId, act, body);
      toast.success(`${act} done`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${act} failed`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grant / extend access</CardTitle>
          <CardDescription>
            Manually grant an access period. Extending stacks days on top of any remaining time.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label>User ID</Label>
            <Input value={grant.userId} onChange={(e) => setGrant((g) => ({ ...g, userId: e.target.value }))} placeholder="uuid" />
          </div>
          <div className="space-y-1">
            <Label>Plan</Label>
            <Select value={grant.planSlug} onValueChange={(v) => setGrant((g) => ({ ...g, planSlug: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.slug}>
                    {p.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Days</Label>
            <Input type="number" value={grant.days} onChange={(e) => setGrant((g) => ({ ...g, days: Number(e.target.value) }))} />
          </div>
          <div className="sm:col-span-4">
            <Button type="button" disabled={working} onClick={() => void runGrant()}>
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Grant access
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent subscriptions</CardTitle>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Access ends</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.userId.slice(0, 8)}…</TableCell>
                    <TableCell>{planById(s.planId)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" || s.status === "trialing" ? "success" : "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.accessEndsAt ? new Date(s.accessEndsAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void action(s.userId, "grant", { planSlug: planById(s.planId), days: 30 })}>
                        +30d
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void action(s.userId, "cancel", { immediate: false })}>
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {subs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No subscriptions yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
