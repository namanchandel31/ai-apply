import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { resolvePostAuthPath } from "@/lib/postAuthDestination";
import { isPricingEnabled } from "@/lib/featureFlags";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OneTapBrand } from "@/components/OneTapLogomark";

export function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password.trim()) {
      toast.error("Name, email, and password are required");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error, data } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: trimmedName },
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.success("Check your email to verify your account, then sign in.");
        navigate("/login", { replace: true });
        return;
      }
      toast.success(
        isPricingEnabled
          ? "Account created. Choose your plan to continue."
          : "Account created. Let's finish setup."
      );
      navigate(await resolvePostAuthPath(), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-lg border border-border bg-white shadow-none">
        <CardContent className="p-8">
          <OneTapBrand className="mb-8" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Add your details to get started, then choose a plan and complete payment.
          </p>

          <div className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Name</Label>
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <Button type="button" className="h-11 w-full text-base" disabled={loading} onClick={() => void handleSignup()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign up
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
