import { useState } from "react";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props {
  email: string | null | undefined;
  onUpdate: () => void;
}

export function EmailStatusCard({ email, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(!email);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("appPassword")).replace(/\s+/g, "");
    if (password.length !== 16) {
      toast.error("App password must be exactly 16 characters (spaces are ignored)");
      setLoading(false);
      return;
    }
    try {
      await api.saveCredentials(String(fd.get("email")), password);
      toast.success("SMTP credentials saved");
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setLoading(false);
    }
  };

  if (!isEditing && email) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Configuration
            </CardTitle>
            <CardDescription>Your Gmail account is connected for sending applications.</CardDescription>
          </div>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
            <p className="font-medium text-sm">{email}</p>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Reconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={!email ? "border-amber-500/50" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Configuration
        </CardTitle>
        <CardDescription>
          Connect Gmail with a 16-character app password to send applications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cred-email">Gmail address</Label>
            <Input id="cred-email" name="email" type="email" defaultValue={email || ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cred-password">App password</Label>
            <Input
              id="cred-password"
              name="appPassword"
              type="password"
              placeholder="xxxx xxxx xxxx xxxx"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & verify
            </Button>
            {email && (
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={loading}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
