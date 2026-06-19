import { Loader2, Mail } from "lucide-react";
import { useEmailPreferences } from "@/hooks/useEmailPreferences";
import { EmailStyleControls } from "@/components/EmailStyleControls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SETUP_BOX_RADIUS = "rounded-sm";

export function EmailPreferencesCard() {
  const prefs = useEmailPreferences();

  if (prefs.isLoading) {
    return (
      <Card className={SETUP_BOX_RADIUS}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={SETUP_BOX_RADIUS}>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Mail className="h-5 w-5" />
          Email style
        </CardTitle>
        <CardDescription>
          Choose the Length and Tone for application emails. These settings apply to every new
          email you generate, including applications sent from the Chrome extension.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-base font-medium text-foreground">
          {prefs.lengthLabel} · {prefs.toneLabel}
        </p>

        <EmailStyleControls
          lengthOption={prefs.lengthOption}
          toneOption={prefs.toneOption}
          onLengthChange={prefs.setLengthOption}
          onToneChange={prefs.setToneOption}
          isSaving={prefs.isSaving}
        />

        <p className="text-base text-muted-foreground">
          Actual emails are tailored to each job by AI.
        </p>

        {prefs.error ? (
          <p className="text-sm text-destructive" role="alert">
            {prefs.error.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
