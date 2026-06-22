import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Ban, Gift } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminUserRow } from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 25;

export function AdminUsersPanel() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [aiMode, setAiMode] = useState<"all" | "managed" | "byok">("all");
  const [days, setDays] = useState("30");
  const [working, setWorking] = useState<string | null>(null);
  const [grantUser, setGrantUser] = useState<AdminUserRow | null>(null);
  const [grantAmount, setGrantAmount] = useState("10");
  const [grantNote, setGrantNote] = useState("");
  const [blockUser, setBlockUser] = useState<AdminUserRow | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers({
        search: search || undefined,
        aiMode,
        limit: PAGE_SIZE,
        offset,
        days: Number(days),
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, aiMode, offset, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = () => {
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const handleBlock = async (user: AdminUserRow, blocked: boolean) => {
    setWorking(user.id);
    try {
      await api.blockAdminUser(user.id, {
        blocked,
        reason: blocked ? blockReason.trim() || "Suspended by admin" : undefined,
      });
      toast.success(blocked ? "User blocked" : "User unblocked");
      setBlockUser(null);
      setBlockReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setWorking(null);
    }
  };

  const handleGrant = async () => {
    if (!grantUser) return;
    const amount = Number(grantAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Enter a positive number of applications");
      return;
    }
    setWorking(grantUser.id);
    try {
      await api.grantAdminUserApplications(grantUser.id, {
        applicationsGranted: Math.floor(amount),
        note: grantNote.trim() || undefined,
      });
      toast.success(`Granted ${Math.floor(amount)} applications`);
      setGrantUser(null);
      setGrantAmount("10");
      setGrantNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setWorking(null);
    }
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User usage &amp; controls</CardTitle>
          <CardDescription>
            Search users, filter by AI mode, review applications sent and LLM cost, block accounts,
            or grant bonus application sends.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[240px] flex-1 gap-2">
              <Input
                placeholder="Search email, name, or user ID"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
              <Button type="button" variant="outline" onClick={runSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">AI mode</Label>
              <Select
                value={aiMode}
                onValueChange={(v) => {
                  setAiMode(v as typeof aiMode);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="managed">OneTap AI</SelectItem>
                  <SelectItem value="byok">BYOK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Cost window</Label>
              <Select
                value={days}
                onValueChange={(v) => {
                  setDays(v);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["7", "30", "90"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}d
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading users…
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>AI</TableHead>
                      <TableHead className="text-right">Apps sent</TableHead>
                      <TableHead className="text-right">Cost ({days}d)</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                          No users match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{user.email}</p>
                              <p className="text-xs text-muted-foreground">
                                {user.fullName || user.id.slice(0, 8)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.aiMode}</Badge>
                            {user.planSlug && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{user.planSlug}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {user.applicationsSent}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ${user.aiCost.toFixed(4)}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-xs">
                            {user.primaryModel
                              ? `${user.primaryProvider}/${user.primaryModel}`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            +{user.adminBonusApplications + user.referralBonusApplications}
                          </TableCell>
                          <TableCell>
                            {user.isBlocked ? (
                              <Badge variant="destructive">Blocked</Badge>
                            ) : (
                              <Badge variant="secondary">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={working === user.id}
                                onClick={() => setGrantUser(user)}
                              >
                                <Gift className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant={user.isBlocked ? "secondary" : "outline"}
                                disabled={working === user.id}
                                onClick={() => {
                                  if (user.isBlocked) {
                                    void handleBlock(user, false);
                                  } else {
                                    setBlockUser(user);
                                  }
                                }}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {total} user{total === 1 ? "" : "s"} · page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={grantUser !== null} onOpenChange={(open) => !open && setGrantUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant bonus applications</DialogTitle>
            <DialogDescription>
              Adds to {grantUser?.email}&apos;s lifetime application limit (same as referral bonus).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <Label>Applications</Label>
              <Input
                type="number"
                min={1}
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} />
            </div>
            <Button onClick={() => void handleGrant()} disabled={working === grantUser?.id}>
              Grant
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={blockUser !== null} onOpenChange={(open) => !open && setBlockUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block user</DialogTitle>
            <DialogDescription>
              {blockUser?.email} will not be able to apply or send applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
            </div>
            <Button
              variant="destructive"
              onClick={() => blockUser && void handleBlock(blockUser, true)}
              disabled={working === blockUser?.id}
            >
              Block user
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
