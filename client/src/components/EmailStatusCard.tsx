import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Mail, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, type GmailStatus } from "@/lib/api";
import { isGmailReadTierEnabled } from "@/lib/featureFlags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Google Account → Security → App passwords (requires 2-Step Verification). */
const GMAIL_APP_PASSWORDS_URL = "https://myaccount.google.com/apppasswords";
const SECTION_LABEL = "text-base font-medium";
const SETUP_BOX_RADIUS = "rounded-sm";

interface Props {
  email: string | null | undefined;
  onUpdate: () => void;
  defaultExpanded?: boolean;
  /** Where to land after Google OAuth callback (setup email tab vs onboarding). */
  oauthReturnTo?: "setup" | "onboarding";
}

export function EmailStatusCard({ email, onUpdate, defaultExpanded, oauthReturnTo = "setup" }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [readChecked, setReadChecked] = useState(false);

  // App-password (SMTP) form state — demoted behind a disclosure.
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(!!defaultExpanded);
  const [loading, setLoading] = useState(false);

  const refreshGmail = useCallback(async () => {
    try {
      const res = await api.gmail.status();
      setGmail(res.data);
    } catch {
      setGmail(null);
    } finally {
      setGmailLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGmail();
  }, [refreshGmail]);

  // Handle the OAuth callback return (?gmail=connected|error).
  useEffect(() => {
    const result = searchParams.get("gmail");
    if (!result) return;
    if (result === "connected") {
      toast.success("Gmail connected");
      refreshGmail();
      onUpdate();
    } else if (result === "error") {
      const reason = searchParams.get("reason");
      toast.error(reason ? `Gmail connection failed: ${reason}` : "Gmail connection failed");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("gmail");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, refreshGmail, onUpdate]);

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      const tier = isGmailReadTierEnabled && readChecked ? "send_read" : "send";
      const res = await api.gmail.connect(tier, oauthReturnTo);
      window.location.href = res.data.authorizationUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Gmail connection");
      setConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setConnecting(true);
    try {
      await api.gmail.disconnect();
      toast.success("Gmail disconnected");
      await refreshGmail();
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Gmail");
    } finally {
      setConnecting(false);
    }
  };

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
      toast.success("App password saved");
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setLoading(false);
    }
  };

  const gmailConfigured = !!gmail?.configured;
  const gmailConnected = !!gmail?.connected;
  const hasAppPassword = !!email;

  // ---- Gmail connected (primary, recommended path) ----
  const connectedGmailBlock = gmailConnected && (
    <div className={cn("space-y-3 border border-input-border bg-input p-3", SETUP_BOX_RADIUS)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="success">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Gmail connected
          </Badge>
          <span className="text-base font-medium">{gmail?.email}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnectGmail}
          disabled={connecting}
        >
          {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Disconnect
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Applications are sent via the Gmail API using a send-only permission. We never read your
        inbox{gmail?.canRead ? " unless you enable reply tracking" : ""}.
      </p>
    </div>
  );

  // ---- Connect Gmail (prominent CTA) ----
  const connectGmailBlock = !gmailConnected && gmailConfigured && (
    <div className="space-y-3">
      <div className="space-y-2 text-base text-muted-foreground leading-relaxed">
        <p>
          Connect your Gmail so OneTap can send applications{" "}
          <strong className="text-foreground">from your address</strong>. We request a{" "}
          <strong className="text-foreground">send-only</strong> permission — we cannot read your
          inbox or change your account.
        </p>
      </div>
      <Button onClick={handleConnectGmail} disabled={connecting} size="lg">
        {connecting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 h-4 w-4" />
        )}
        Connect Gmail
      </Button>
      {isGmailReadTierEnabled && (
        <label className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
          <Checkbox
            checked={readChecked}
            onCheckedChange={(v) => setReadChecked(v === true)}
          />
          Also allow reading recruiter replies (reply tracking — coming soon)
        </label>
      )}
    </div>
  );

  // ---- App-password (SMTP) section, demoted ----
  const appPasswordConnectedSummary = hasAppPassword && !isEditing && (
    <div
      className={cn(
        "flex items-center justify-between border border-input-border bg-input p-3",
        SETUP_BOX_RADIUS
      )}
    >
      <div className="flex items-center gap-2">
        {!gmailConnected && (
          <Badge variant="success">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
          </Badge>
        )}
        <span className="text-base font-medium">{email}</span>
        <span className="text-sm text-muted-foreground">(app password)</span>
      </div>
      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
        Reconnect
      </Button>
    </div>
  );

  const appPasswordForm = (isEditing || (!hasAppPassword && !gmailConfigured)) && (
    <div className="space-y-3">
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Use a Google <strong className="text-foreground">app password</strong> (a 16-character
          code), not your normal Gmail password. We store it encrypted and use it only to send
          applications you trigger.
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
          <Label htmlFor="cred-email" className={SECTION_LABEL}>
            Gmail address
          </Label>
          <Input
            id="cred-email"
            name="email"
            type="email"
            defaultValue={email || ""}
            className={SETUP_BOX_RADIUS}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cred-password" className={SECTION_LABEL}>
            App password
          </Label>
          <Input
            id="cred-password"
            name="appPassword"
            type="password"
            placeholder="xxxx xxxx xxxx xxxx"
            className={SETUP_BOX_RADIUS}
            required
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            Paste the 16-character code Google shows you. Spaces are optional.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save &amp; verify
          </Button>
          {(hasAppPassword || gmailConfigured) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                if (gmailConfigured) setShowAppPassword(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );

  // The advanced disclosure that reveals the app-password path (only when Gmail
  // OAuth is the available primary path and the user isn't already on app password).
  const showAppPasswordSection =
    !gmailConfigured || hasAppPassword || showAppPassword || isEditing;

  const appPasswordDisclosure =
    gmailConfigured && !hasAppPassword && !showAppPassword && !isEditing ? (
      <button
        type="button"
        onClick={() => {
          setShowAppPassword(true);
          setIsEditing(true);
        }}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Use App Password Instead (advanced)
      </button>
    ) : null;

  return (
    <Card className={cn(SETUP_BOX_RADIUS, !hasAppPassword && !gmailConnected ? "ring-1 ring-warning/40" : "")}>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Mail className="h-5 w-5" />
            Email Configuration
          </CardTitle>
          <CardDescription>
            Connect Gmail to send job applications from your own address.
          </CardDescription>
        </div>
        {(gmailConnected || hasAppPassword) && (
          <Badge variant="success">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {gmailLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking email connection…
          </div>
        ) : (
          <>
            {connectedGmailBlock}
            {connectGmailBlock}

            {(connectGmailBlock || connectedGmailBlock) && showAppPasswordSection && (
              <div className="border-t border-input-border pt-3" />
            )}

            {showAppPasswordSection && (
              <div className="space-y-3">
                {appPasswordConnectedSummary}
                {appPasswordForm}
              </div>
            )}
            {appPasswordDisclosure}
          </>
        )}
      </CardContent>
    </Card>
  );
}
