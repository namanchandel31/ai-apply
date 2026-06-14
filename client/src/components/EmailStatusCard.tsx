import { useState } from "react";
import { Loader2, Mail, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Google Account → Security → App passwords (requires 2-Step Verification). */
const GMAIL_APP_PASSWORDS_URL = "https://myaccount.google.com/apppasswords";
const SECTION_LABEL = "text-base font-medium";
const SETUP_BOX_RADIUS = "rounded-sm";

interface Props {
  email: string | null | undefined;
  onUpdate: () => void;
  defaultExpanded?: boolean;
}

export function EmailStatusCard({ email, onUpdate, defaultExpanded }: Props) {
  const [isEditing, setIsEditing] = useState(!email || !!defaultExpanded);
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
      <Card className={SETUP_BOX_RADIUS}>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Mail className="h-5 w-5" />
              Email Configuration
            </CardTitle>
            <CardDescription>Your Gmail account is connected for sending applications.</CardDescription>
          </div>
          <Badge variant="success">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
          </Badge>
        </CardHeader>
        <CardContent>
          <div className={cn("flex items-center justify-between border border-input-border bg-input p-3", SETUP_BOX_RADIUS)}>
            <p className="text-base font-medium">{email}</p>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Reconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(SETUP_BOX_RADIUS, !email ? "ring-1 ring-warning/40" : "")}>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Mail className="h-5 w-5" />
          Email Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3 text-base text-muted-foreground leading-relaxed">
          <p>
            We ask for this so OneTap can send job application emails{" "}
            <strong className="text-foreground">from your Gmail address</strong>. Recruiters see mail from you,
            in your name—not from a generic platform address.
          </p>
          <p>
            Use a Google <strong className="text-foreground">app password</strong> (a one-time 16-character
            code), not your normal Gmail password. Google creates it for trusted apps; we store it encrypted
            and use it only to send applications you trigger. We do not read your inbox or change your account
            settings.
          </p>
          <p>
            <a
              href={GMAIL_APP_PASSWORDS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              Generate a Gmail app password
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
            <span> (opens Google; 2-Step Verification must be on)</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cred-email" className={SECTION_LABEL}>Gmail address</Label>
            <Input id="cred-email" name="email" type="email" defaultValue={email || ""} className={SETUP_BOX_RADIUS} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cred-password" className={SECTION_LABEL}>App password</Label>
            <Input
              id="cred-password"
              name="appPassword"
              type="password"
              placeholder="xxxx xxxx xxxx xxxx"
              className={SETUP_BOX_RADIUS}
              required
              autoComplete="off"
            />
            <p className="text-base text-muted-foreground">
              Paste the 16-character code Google shows you. Spaces are optional.
            </p>
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
