import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { resolvePostAuthPath } from "@/lib/postAuthDestination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OneTapBrand } from "@/components/OneTapLogomark";

const BENEFITS = [
  "Personalized emails from any job description",
  "Sent from your Gmail in one click",
  "Every application tracked in one place",
] as const;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        toast.error(error.message);
        setGoogleLoading(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setGoogleLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Enter your email and password");
      return;
    }
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate(await resolvePostAuthPath(), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-lg border border-border bg-white shadow-none">
        <CardContent className="p-8">
          <OneTapBrand className="mb-8" />

          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:whitespace-nowrap">
            Tailored job applications in one tap
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            OneTap turns job descriptions into personalized outreach emails using your resume,
            then sends them from Gmail and tracks every reply.
          </p>

          <ul className="mt-8 space-y-2.5">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex gap-2.5 text-base text-foreground">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-foreground" aria-hidden />
                {benefit}
              </li>
            ))}
          </ul>

          <div className="mt-10 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="login-password">Password</Label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <Button
              type="button"
              disabled={emailLoading}
              className="h-11 w-full text-base"
              onClick={() => void handleEmailSignIn()}
            >
              {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in with email
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={googleLoading}
              className="h-11 w-full border-input-border bg-white text-base font-medium hover:bg-black/[0.04]"
              onClick={() => void handleGoogleSignIn()}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5" />
              )}
              Continue with Google
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New to OneTap?{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
