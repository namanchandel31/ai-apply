import { Link } from "react-router-dom";
import { useEffect } from "react";

// Optional: set VITE_SUPPORT_EMAIL once a real support inbox exists.
// Until then the page shows a domain-agnostic fallback (no fake address).
const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "";
const PRIVACY_PATH = "/privacy-policy";
const TERMS_PATH = "/terms-of-service";

type FaqItem = {
  q: string;
  a: React.ReactNode;
};

const FAQS: FaqItem[] = [
  {
    q: "How do I connect the Chrome extension?",
    a: (
      <>
        Sign in to the OneTap website, open{" "}
        <strong>Settings &rarr; Chrome Extension</strong>, and choose{" "}
        <strong>Connect Extension</strong>. The extension is authorized
        automatically&mdash;there is no token to copy or password to enter in the
        extension.
      </>
    ),
  },
  {
    q: "I don't see the OneTap button on LinkedIn posts.",
    a: (
      <>
        Make sure the extension shows as <strong>Connected</strong> and your setup
        is complete in the popup, then reload the LinkedIn tab. The button appears
        on hiring posts that include a contact email. If it still doesn&rsquo;t
        appear, try scrolling the feed so new posts are scanned.
      </>
    ),
  },
  {
    q: "How is my account secured?",
    a: (
      <>
        You sign in with Google, and the extension is authorized through a one-time,
        single-use connect token issued after login. Signing out on the website
        removes the extension&rsquo;s stored credentials.
      </>
    ),
  },
  {
    q: "Can I use my own AI provider?",
    a: (
      <>
        Yes. Add your provider&rsquo;s API key in the dashboard. Keys are stored
        encrypted and used only to generate content on your behalf.
      </>
    ),
  },
  {
    q: "How do I delete my account or data?",
    a: SUPPORT_EMAIL ? (
      <>
        Email us at{" "}
        <a
          className="text-primary underline underline-offset-4"
          href={`mailto:${SUPPORT_EMAIL}`}
        >
          {SUPPORT_EMAIL}
        </a>{" "}
        and we&rsquo;ll help you remove your account and associated data.
      </>
    ) : (
      <>
        You can remove your uploaded resume, AI keys, and email credentials from the
        dashboard at any time. To delete your entire account and associated data,
        reach out through the contact channel listed above.
      </>
    ),
  },
];

export function SupportPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Support · OneTap";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Need help with OneTap? We&rsquo;re here for you.
          </p>
        </header>

        <section className="mb-12">
          <h2 className="mb-3 text-xl font-semibold tracking-tight">Contact us</h2>
          {SUPPORT_EMAIL ? (
            <>
              <p className="text-base leading-relaxed text-muted-foreground">
                The fastest way to reach us is by email. We aim to respond within
                1&ndash;2 business days.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Email {SUPPORT_EMAIL}
              </a>
            </>
          ) : (
            <p className="text-base leading-relaxed text-muted-foreground">
              We&rsquo;re currently setting up a dedicated support inbox. In the
              meantime, you can manage and remove your data directly from the OneTap
              dashboard, and a contact address will be published here soon.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQS.map((item) => (
              <div key={item.q}>
                <h3 className="text-base font-medium text-foreground">{item.q}</h3>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            See also our{" "}
            <Link to={PRIVACY_PATH} className="text-primary underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to={TERMS_PATH} className="text-primary underline underline-offset-4">
              Terms of Service
            </Link>
            .
          </p>
          <p className="mt-2">
            &copy; {new Date().getFullYear()} OneTap. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
