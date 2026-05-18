import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AppRecord {
  id: string;
  status: string;
  createdAt: string;
  sentAt?: string | null;
  role?: string | null;
  company?: string | null;
}

export function ApplicationTable() {
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchApps = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.getApplications();
      setApps(res.data);
    } catch (err) {
      console.error(err);
      if (isRefresh) toast.error("Failed to load applications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApps();
    // Phase 5: Polling mechanism
    const intervalId = setInterval(() => fetchApps(false), 5000);
    return () => clearInterval(intervalId);
  }, []);

  if (loading && apps.length === 0) {
    return (
      <div className="flex justify-center p-8 border rounded-md bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <h2 className="font-medium">Recent Applications</h2>
        <Button variant="ghost" size="sm" onClick={() => fetchApps(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                No applications yet.
              </TableCell>
            </TableRow>
          ) : (
            apps.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.role || "Unknown Role"}</TableCell>
                <TableCell>{app.company || "Unknown Company"}</TableCell>
                <TableCell>
                  {app.status === 'sent' && (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Sent</Badge>
                  )}
                  {app.status === 'failed' && (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                  {app.status === 'queued' && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Queued</Badge>
                  )}
                  {app.status === 'sending' && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />
                      Sending...
                    </Badge>
                  )}
                  {!['sent', 'failed', 'queued', 'sending'].includes(app.status) && (
                    <Badge variant="outline">{app.status}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(app.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
