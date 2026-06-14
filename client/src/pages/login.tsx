import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OneTapLogomark } from "@/components/OneTapLogomark";
import { PAGE_PADDING_X } from "@/lib/pageLayout";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex min-h-screen items-center justify-center bg-background py-4", PAGE_PADDING_X)}>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <OneTapLogomark className="mx-auto mb-4 h-12 w-auto" />
          <h1 className="text-display font-semibold">OneTap</h1>
          <p className="mt-2 text-muted-foreground">Sign in with your Google account</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Button
              type="button"
              disabled={loading}
              className="w-full"
              onClick={() => void handleGoogleSignIn()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
