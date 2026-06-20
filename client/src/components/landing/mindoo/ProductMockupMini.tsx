import { OneTapLogomark } from "@/components/OneTapLogomark";

type MiniVariant = "apply" | "track" | "extension" | "gmail" | "byok";

export function ProductMockupMini({ variant }: { variant: MiniVariant }) {
  if (variant === "track") {
    return (
      <div className="m-mini-ui">
        <div className="m-mini-bar">
          <OneTapLogomark className="h-3 w-3" />
          <span>Applications</span>
        </div>
        <div className="m-mini-list">
          {[
            { co: "Stripe", role: "Sr. Engineer", status: "Sent", score: 87 },
            { co: "Notion", role: "Full Stack", status: "Draft", score: 72 },
            { co: "Linear", role: "Backend", status: "Queued", score: 91 },
          ].map((row) => (
            <div key={row.co} className="m-mini-row">
              <div>
                <p className="m-mini-title">{row.role}</p>
                <p className="m-mini-sub">{row.co}</p>
              </div>
              <div className="m-mini-meta">
                <span className="m-mini-score">{row.score}</span>
                <span>{row.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "extension") {
    return (
      <div className="m-mini-ui m-mini-extension">
        <div className="m-mini-extension-bar">
          <span className="m-mini-extension-logo">in</span>
          <span>LinkedIn</span>
        </div>
        <div className="m-mini-extension-body">
          <p className="m-mini-title">Senior Software Engineer</p>
          <p className="m-mini-sub">Stripe · San Francisco, CA</p>
          <div className="m-mini-extension-actions">
            <span className="m-mini-extension-muted">Easy Apply</span>
            <span className="m-mini-extension-cta">
              <OneTapLogomark className="h-2.5 w-2.5" />
              Apply with OneTap
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "byok") {
    return (
      <div className="m-mini-ui m-mini-byok">
        <div className="m-mini-bar">
          <OneTapLogomark className="h-3 w-3" />
          <span>Setup</span>
        </div>
        <div className="m-mini-byok-body">
          <p className="m-mini-label">AI provider</p>
          <div className="m-mini-byok-field">
            <span>Anthropic</span>
            <span className="m-mini-byok-status">Connected</span>
          </div>
          <p className="m-mini-label">API key</p>
          <div className="m-mini-byok-key">sk-ant-••••••••••••••••••••</div>
          <div className="m-mini-byok-notes">
            <span className="m-mini-byok-pill">Your key stays yours</span>
            <span className="m-mini-byok-pill">Private by default</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "gmail") {
    return (
      <div className="m-mini-ui m-mini-gmail">
        <div className="m-mini-gmail-bar">
          <span>Gmail</span>
          <span className="m-mini-gmail-from">you@gmail.com</span>
        </div>
        <div className="m-mini-gmail-body">
          <p className="m-mini-sub">To: hiring@stripe.com</p>
          <p className="m-mini-title">Applying for Senior Software Engineer</p>
          <p className="m-mini-gmail-snippet">
            Hi Sarah, I came across the role and wanted to reach out directly...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="m-mini-ui">
      <div className="m-mini-bar">
        <OneTapLogomark className="h-3 w-3" />
        <span>Apply</span>
      </div>
      <div className="m-mini-apply">
        <p className="m-mini-label">Job description</p>
        <div className="m-mini-jd">
          Senior Software Engineer @ Stripe, Payments Infrastructure team...
        </div>
        <p className="m-mini-label">Email preview</p>
        <div className="m-mini-email">
          Hi Sarah, I came across the Senior Software Engineer role and wanted to reach out...
        </div>
        <div className="m-mini-footer">
          <span className="m-mini-score">87 match</span>
          <span className="m-mini-send">Review &amp; Send</span>
        </div>
      </div>
    </div>
  );
}

export function ProductMockupFull({ className }: { className?: string }) {
  return (
    <div className={`m-product-mockup ${className ?? ""}`}>
      <div className="m-product-bar">
        <OneTapLogomark className="h-5 w-auto" />
        <span>OneTap</span>
        <div className="m-product-tabs">
          <span className="is-active">Apply</span>
          <span>Applications</span>
        </div>
      </div>
      <div className="m-product-grid">
        <div>
          <p className="m-mini-label">Job description</p>
          <div className="m-product-panel">
            <p className="m-mini-title">Senior Software Engineer @ Stripe</p>
            <p className="m-mini-sub">
              We&apos;re looking for a senior engineer to join the Payments Infrastructure
              team. You&apos;ll build distributed systems handling millions of daily
              transactions...
            </p>
          </div>
        </div>
        <div>
          <p className="m-mini-label">Email preview</p>
          <div className="m-product-panel is-white">
            <div className="m-product-subject">
              <p className="m-mini-sub">Subject</p>
              <p className="m-mini-title">Applying for Senior Software Engineer</p>
            </div>
            <p className="m-mini-sub">
              Hi Sarah, I came across the Senior Software Engineer role and wanted to reach
              out. My five years building payment systems maps directly to what you&apos;re
              looking for...
            </p>
          </div>
        </div>
      </div>
      <div className="m-product-status">
        <div>
          <span className="m-mini-score is-lg">87</span>
          <span className="m-mini-sub">Match score</span>
        </div>
        <span className="m-mini-send is-dark">Review &amp; Send</span>
      </div>
    </div>
  );
}
