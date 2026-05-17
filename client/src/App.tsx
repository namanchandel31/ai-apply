import { useState } from "react";
import {
  Briefcase,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { api, type ParsedJD, type ParsedResume } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SkillTags } from "@/components/SkillTags";

const STEPS = [
  { id: "auth", label: "Account", icon: User },
  { id: "credentials", label: "Email setup", icon: Mail },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "jd", label: "Job description", icon: Briefcase },
  { id: "apply", label: "Apply", icon: Sparkles },
  { id: "send", label: "Send", icon: Send },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function App() {
  const [step, setStep] = useState<StepId>("auth");
  const [loading, setLoading] = useState(false);

  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ParsedResume | null>(null);
  const [jobDescriptionId, setJobDescriptionId] = useState<string | null>(null);
  const [jdData, setJdData] = useState<ParsedJD | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState(0);
  const [matchedSkills, setMatchedSkills] = useState<string[]>([]);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const authed = !!api.getToken();
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goStep = (target: StepId) => {
    if (target !== "auth" && !api.getToken()) {
      setStep("auth");
      return;
    }
    setStep(target);
  };

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    setStep("auth");
    toast.info("Signed out");
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await api.login(
        String(fd.get("email")),
        String(fd.get("password"))
      );
      api.setToken(res.data.token);
      setUser(res.data.user);
      toast.success("Welcome back");
      setStep("credentials");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    try {
      await api.signup(email, password);
      const res = await api.login(email, password);
      api.setToken(res.data.token);
      setUser(res.data.user);
      toast.success("Account created");
      setStep("credentials");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCredentials = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api.saveCredentials(
        String(fd.get("email")),
        String(fd.get("appPassword")).replace(/\s+/g, "")
      );
      toast.success("SMTP credentials saved");
      setStep("resume");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem("resume") as HTMLInputElement)
      .files?.[0];
    if (!file) return toast.error("Choose a PDF resume");
    setLoading(true);
    try {
      const res = await api.uploadResume(file);
      setResumeId(res.data.resumeId);
      setResumeData(res.data.data);
      toast.success(res.data.message || "Resume parsed");
      setStep("jd");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleJD = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const text = String(fd.get("text")).trim();
    if (!text) return toast.error("Paste the job description");
    try {
      const res = await api.uploadJD(text, String(fd.get("title") || undefined));
      setJobDescriptionId(res.data.jobDescriptionId);
      setJdData(res.data.data);
      toast.success(res.data.message || "Job description parsed");
      setStep("apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!resumeId || !jobDescriptionId) {
      return toast.error("Upload resume and job description first");
    }
    setLoading(true);
    try {
      const res = await api.apply(resumeId, jobDescriptionId);
      const d = res.data;
      setApplicationId(d.applicationId);
      setMatchScore(d.match.score);
      setMatchedSkills(d.match.matchedSkills);
      setMissingSkills(d.match.missingSkills);
      setEmailSubject(d.email.subject);
      setEmailBody(d.email.body);
      toast.success(res.idempotent ? "Existing application loaded" : "Draft ready");
      setStep("send");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!applicationId) return toast.error("Generate an application first");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const recipient = String(fd.get("recipient") || "").trim();
    try {
      const res = await api.send(applicationId, recipient || undefined);
      setSendStatus(res.data.status);
      toast.success(res.data.message || "Application sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-foreground text-background">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              A
            </div>
            <div>
              <h1 className="font-serif text-xl leading-tight">AI Apply</h1>
              <p className="text-xs text-white/60">Parse · Match · Send</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < stepIndex || (s.id === "resume" && resumeId) || (s.id === "jd" && jobDescriptionId);
            const active = s.id === step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goStep(s.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  active && "bg-primary/25 text-white",
                  !active && "text-white/70 hover:bg-white/5 hover:text-white",
                  done && !active && "text-white/90"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    active || done ? "bg-primary text-primary-foreground" : "bg-white/10"
                  )}
                >
                  {i + 1}
                </span>
                <Icon className="h-4 w-4 opacity-80" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          {user && <p className="mb-2 truncate text-xs text-white/60">{user.email}</p>}
          {authed && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 lg:p-10">
        <div className="mx-auto max-w-2xl space-y-6">
          {step === "auth" && (
            <>
              <div>
                <h2 className="font-serif text-3xl">Get started</h2>
                <p className="mt-1 text-muted-foreground">
                  Create an account or sign in to run your application pipeline.
                </p>
              </div>
              <Tabs defaultValue="login">
                <TabsList>
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <Card>
                    <CardContent className="pt-6">
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="login-email">Email</Label>
                          <Input id="login-email" name="email" type="email" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password">Password</Label>
                          <Input id="login-password" name="password" type="password" required />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full">
                          {loading && <Loader2 className="animate-spin" />}
                          Sign in
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="signup">
                  <Card>
                    <CardContent className="pt-6">
                      <form onSubmit={handleSignup} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">Email</Label>
                          <Input id="signup-email" name="email" type="email" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <Input
                            id="signup-password"
                            name="password"
                            type="password"
                            minLength={8}
                            required
                          />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full">
                          {loading && <Loader2 className="animate-spin" />}
                          Create account
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}

          {step === "credentials" && (
            <>
              <div>
                <h2 className="font-serif text-3xl">Email credentials</h2>
                <p className="mt-1 text-muted-foreground">
                  Connect Gmail with a{" "}
                  <a
                    href="https://support.google.com/accounts/answer/185833"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    16-character app password
                  </a>
                  .
                </p>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleCredentials} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cred-email">Gmail address</Label>
                      <Input id="cred-email" name="email" type="email" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cred-password">App password</Label>
                      <Input
                        id="cred-password"
                        name="appPassword"
                        type="password"
                        minLength={16}
                        maxLength={16}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="animate-spin" />}
                      Save & verify
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          )}

          {step === "resume" && (
            <>
              <div>
                <h2 className="font-serif text-3xl">Upload resume</h2>
                <p className="mt-1 text-muted-foreground">PDF only, max 5 MB.</p>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleResume} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="resume-file">Resume (PDF)</Label>
                      <Input
                        id="resume-file"
                        name="resume"
                        type="file"
                        accept="application/pdf"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="animate-spin" />}
                      Upload & parse
                    </Button>
                  </form>
                </CardContent>
              </Card>
              {resumeData && (
                <Card>
                  <CardHeader>
                    <CardTitle>{resumeData.name || "Candidate"}</CardTitle>
                    <CardDescription>Extracted skills</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SkillTags skills={resumeData.skills} />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {step === "jd" && (
            <>
              <div>
                <h2 className="font-serif text-3xl">Job description</h2>
                <p className="mt-1 text-muted-foreground">
                  Paste the full posting. We extract role, company, contact, and skills.
                </p>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleJD} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="jd-title">Title (optional)</Label>
                      <Input id="jd-title" name="title" placeholder="Senior Backend Engineer" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jd-text">Job description</Label>
                      <Textarea id="jd-text" name="text" rows={12} required />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="animate-spin" />}
                      Parse job description
                    </Button>
                  </form>
                </CardContent>
              </Card>
              {jdData && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {jdData.job_title || "Role"}
                      {jdData.company_name && ` · ${jdData.company_name}`}
                    </CardTitle>
                    <CardDescription>
                      {jdData.contact_email || "No contact email found"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SkillTags skills={jdData.skills} variant="secondary" />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {step === "apply" && (
            <>
              <div>
                <h2 className="font-serif text-3xl">Generate application</h2>
                <p className="mt-1 text-muted-foreground">
                  Match your resume and draft a tailored outreach email.
                </p>
              </div>
              <Button onClick={handleApply} disabled={loading} size="lg">
                {loading && <Loader2 className="animate-spin" />}
                Generate match & email
              </Button>
              {applicationId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-baseline justify-between">
                      <span>Match score</span>
                      <span className="text-3xl text-primary">{matchScore}%</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress value={matchScore} />
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                          Matched
                        </p>
                        <SkillTags skills={matchedSkills} variant="success" />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                          Gaps
                        </p>
                        <SkillTags skills={missingSkills} variant="destructive" />
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                        Draft email
                      </p>
                      <p className="font-medium">{emailSubject}</p>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm">
                        {emailBody}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {step === "send" && (
            <>
              <div>
                <h2 className="font-serif text-3xl">Send application</h2>
                <p className="mt-1 text-muted-foreground">
                  Email sends from your Gmail with the resume attached.
                </p>
              </div>
              {!applicationId && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-6 text-sm text-amber-900">
                    Generate an application on the previous step before sending.
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleSend} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="send-recipient">Recipient email</Label>
                      <Input
                        id="send-recipient"
                        name="recipient"
                        type="email"
                        defaultValue={jdData?.contact_email || ""}
                        placeholder="hr@company.com"
                      />
                    </div>
                    <Button type="submit" disabled={loading || !applicationId}>
                      {loading && <Loader2 className="animate-spin" />}
                      Send application
                    </Button>
                  </form>
                </CardContent>
              </Card>
              {sendStatus && (
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="flex items-center gap-2 pt-6">
                    <Badge variant="success">{sendStatus}</Badge>
                    <span className="text-sm text-emerald-900">Application delivered</span>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
