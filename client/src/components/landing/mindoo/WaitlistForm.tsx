import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2 } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type FormStatus = "idle" | "submitting" | "success" | "duplicate" | "error";

function WaitlistSuccessState({ duplicate }: { duplicate: boolean }) {
  return (
    <div className="m-waitlist-success">
      <div className="m-waitlist-success-icon">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h3 className="m-h5">
        {duplicate ? "You're already on the list" : "You're on the list"}
      </h3>
      <p className="m-body-secondary">
        {duplicate
          ? "We already have your email. You're all set for early access when we launch."
          : "We'll reach out when early access opens. No spam — just the launch update."}
      </p>
    </div>
  );
}

export function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [useCase, setUseCase] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");

  const isSubmitting = status === "submitting";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let valid = true;
    setNameError("");
    setEmailError("");

    if (!name.trim()) {
      setNameError("Name is required.");
      valid = false;
    }
    if (!email.trim()) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      valid = false;
    }
    if (!valid) return;

    setStatus("submitting");

    const { error } = await supabase.from("waitlist").insert({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: role || null,
      use_case: useCase.trim() || null,
    });

    if (!error) {
      setStatus("success");
      return;
    }

    if (error.code === "23505") {
      setStatus("duplicate");
      return;
    }

    setStatus("error");
    setServerError(error.message);
  };

  if (status === "success" || status === "duplicate") {
    return <WaitlistSuccessState duplicate={status === "duplicate"} />;
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      noValidate
      className="m-waitlist-form"
    >
      <div className="m-waitlist-row">
        <div className="m-waitlist-field">
          <label htmlFor="wl-name">
            Name <span>*</span>
          </label>
          <Input
            id="wl-name"
            type="text"
            placeholder="Alex Chen"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            aria-invalid={nameError ? true : undefined}
          />
          {nameError ? <p className="m-field-error">{nameError}</p> : null}
        </div>

        <div className="m-waitlist-field">
          <label htmlFor="wl-email">
            Email <span>*</span>
          </label>
          <Input
            id="wl-email"
            type="email"
            placeholder="alex@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            aria-invalid={emailError ? true : undefined}
          />
          {emailError ? <p className="m-field-error">{emailError}</p> : null}
        </div>
      </div>

      <div className="m-waitlist-field">
        <label htmlFor="wl-role">
          Role <span className="m-optional">(optional)</span>
        </label>
        <Select value={role} onValueChange={setRole} disabled={isSubmitting}>
          <SelectTrigger id="wl-role">
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
          <SelectContent>
            {["Founder", "Engineer", "Designer", "Product Manager", "Other"].map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="m-waitlist-field">
        <label htmlFor="wl-usecase">
          What will you use OneTap for?{" "}
          <span className="m-optional">(optional)</span>
        </label>
        <Textarea
          id="wl-usecase"
          placeholder="e.g. I'm actively applying to engineering roles and want to apply faster without losing quality..."
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          maxLength={280}
          disabled={isSubmitting}
          className="min-h-[96px] resize-none"
        />
        <p className="m-char-count">{useCase.length}/280</p>
      </div>

      {status === "error" ? (
        <p className="m-server-error">
          {serverError || "Something went wrong. Please try again."}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isSubmitting} className="m-waitlist-submit">
        {isSubmitting ? "Joining..." : "Join the waitlist"}
      </Button>
    </form>
  );
}
