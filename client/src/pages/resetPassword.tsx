import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { resolvePostAuthPath } from "@/lib/postAuthDestination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setReady(Boolean(data.session));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleReset = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      toast.error("Enter and confirm your new password");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated successfully");
      navigate(await resolvePostAuthPath(queryClient), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md border border-border bg-white shadow-none">
        <CardContent className="p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset password</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Set a new password for your OneTap account.
          </p>

          {!ready ? (
            <div className="mt-8 space-y-3 text-sm text-muted-foreground">
              <p>Open this page from the reset link sent to your email.</p>
              <p>
                <Link to="/forgot-password" className="font-medium text-primary hover:underline">
                  Request a new reset link
                </Link>
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
              <Button type="button" className="h-11 w-full text-base" disabled={loading} onClick={() => void handleReset()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Update password
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
