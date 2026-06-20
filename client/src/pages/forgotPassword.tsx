import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password reset link sent to your email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md border border-border bg-white shadow-none">
        <CardContent className="p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forgot password</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Enter your email and we will send a reset link.
          </p>

          <div className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button type="button" className="h-11 w-full text-base" disabled={loading} onClick={() => void handleSubmit()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send reset link
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
