import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2 } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

export function HeroWaitlistInput({ ready }: { ready: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("submitting");

    const { error: insertError } = await supabase.from("waitlist").insert({
      email: trimmed.toLowerCase(),
      name: trimmed.split("@")[0] || "Waitlist",
      source: "hero",
    });

    if (!insertError) {
      setStatus("success");
      return;
    }

    if (insertError.code === "23505") {
      setStatus("duplicate");
      return;
    }

    setStatus("error");
    setError(insertError.message || "Something went wrong. Please try again.");
  };

  if (status === "success" || status === "duplicate") {
    return (
      <div className={`mh-hero-waitlist mh-hero-waitlist-success${ready ? " is-ready" : ""}`}>
        <CheckCircle2 className="mh-hero-waitlist-check" aria-hidden />
        <span>
          {status === "duplicate"
            ? "You're already on the list."
            : "You're on the list — we'll be in touch."}
        </span>
      </div>
    );
  }

  const waitlistClass = `mh-hero-waitlist${ready ? " is-ready" : ""}${expanded ? " is-expanded" : ""}`;

  return (
    <div className={waitlistClass}>
      {!expanded ? (
        <button
          type="button"
          className="mh-hero-waitlist-trigger"
          onClick={() => setExpanded(true)}
        >
          Join the waitlist
        </button>
      ) : (
        <form
          className="mh-hero-waitlist-form"
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          noValidate
        >
          <div className="mh-hero-waitlist-field">
            <input
              ref={inputRef}
              type="email"
              className="mh-hero-waitlist-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "submitting"}
              aria-label="Email address"
              aria-invalid={error ? true : undefined}
            />
            <button
              type="submit"
              className="mh-hero-waitlist-submit"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Joining…" : "Join waitlist"}
            </button>
          </div>
          {error ? <p className="mh-hero-waitlist-error">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
