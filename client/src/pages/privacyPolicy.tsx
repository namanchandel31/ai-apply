import { Link } from "react-router-dom";
import { useEffect } from "react";

const LAST_UPDATED = "June 21, 2026";
// Optional: set VITE_SUPPORT_EMAIL once a real inbox exists. Until then the
// contact section points to the Support page instead of a fake address.
const CONTACT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "";

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "overview",
    title: "1. Overview",
    body: (
      <>
        <p>
          OneTap (&ldquo;OneTap&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
          &ldquo;our&rdquo;) provides a job-application assistant consisting of a
          web application and a companion Chrome extension. The extension helps you
          discover hiring posts on LinkedIn and send them to your OneTap account,
          where applications can be tracked and, where you enable it, drafted and
          submitted with AI assistance.
        </p>
        <p>
          This Privacy Policy explains what information we collect, how we use it,
          who we share it with, and the choices you have. It applies to the OneTap
          website, dashboard, and the OneTap Chrome extension (together, the
          &ldquo;Service&rdquo;).
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "2. Information We Collect",
    body: (
      <>
        <p>We collect only what is needed to run the Service:</p>
        <ul>
          <li>
            <strong>Account information.</strong> When you sign in with Google
            (via Supabase Authentication) we receive your email address, name, and
            profile picture. We use these to create and identify your account.
          </li>
          <li>
            <strong>Resume and profile data.</strong> Resumes you upload and any
            profile details you provide, which are used to prepare and tailor job
            applications.
          </li>
          <li>
            <strong>AI provider credentials.</strong> If you choose to use your own
            AI provider, the API keys you add are stored encrypted and used solely
            to make AI requests on your behalf.
          </li>
          <li>
            <strong>Email sending credentials.</strong> If you connect an email
            account to send applications, the credentials required to send on your
            behalf are stored securely and used only for that purpose.
          </li>
          <li>
            <strong>Application data.</strong> Job postings you add (including from
            LinkedIn), application status, generated drafts, and related metadata.
          </li>
          <li>
            <strong>Content you act on in the extension.</strong> When you tap the
            OneTap button on a LinkedIn post, the text of that post, its URL, and a
            contact email found within it are sent to your OneTap account to create
            an application. The extension does not continuously read, store, or
            transmit your LinkedIn browsing activity.
          </li>
          <li>
            <strong>Technical and diagnostic data.</strong> Basic logs (such as
            request identifiers and error information) used to operate, secure, and
            troubleshoot the Service.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "3. How We Use Your Information",
    body: (
      <>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Authenticate you and provide access to your account.</li>
          <li>
            Detect relevant hiring posts and add them to your applications when you
            choose to.
          </li>
          <li>
            Generate, tailor, and (where you enable it) send job applications and
            outreach emails.
          </li>
          <li>Track the status of your applications.</li>
          <li>
            Maintain the security, reliability, and performance of the Service.
          </li>
          <li>Comply with legal obligations.</li>
        </ul>
        <p>
          We do not sell your personal information, and we do not use your resume,
          application content, or credentials for advertising.
        </p>
      </>
    ),
  },
  {
    id: "extension",
    title: "4. The Chrome Extension",
    body: (
      <>
        <p>
          The extension requires a small set of permissions to function:
        </p>
        <ul>
          <li>
            <strong>Storage.</strong> To keep your session (access and refresh
            tokens) and cached settings on your device so the extension works
            without the website being open.
          </li>
          <li>
            <strong>Access to LinkedIn pages.</strong> So the extension can detect
            hiring posts and show the OneTap button.
          </li>
          <li>
            <strong>Access to the OneTap API domain.</strong> So the extension can
            communicate with your OneTap account.
          </li>
          <li>
            <strong>Alarms.</strong> To periodically refresh your session token in
            the background.
          </li>
        </ul>
        <p>
          The extension is authorized through a one-time, single-use connect token
          issued by the OneTap website after you sign in. Your login credentials are
          never entered into the extension. Signing out on the website removes the
          extension&rsquo;s stored credentials.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "5. Third-Party Services",
    body: (
      <>
        <p>
          We rely on a limited number of service providers to operate OneTap. These
          providers process data only as needed to provide their services to us:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> &mdash; authentication and database hosting.
          </li>
          <li>
            <strong>AI providers</strong> (for example, OpenAI and other model
            providers you configure) &mdash; to generate application content. When
            you use your own API key, requests are made directly with your chosen
            provider under that provider&rsquo;s terms.
          </li>
          <li>
            <strong>Email delivery</strong> &mdash; when you send applications, your
            connected email provider transmits the message.
          </li>
        </ul>
        <p>
          Your use of third-party providers is also subject to their respective
          privacy policies.
        </p>
      </>
    ),
  },
  {
    id: "storage-security",
    title: "6. Data Storage and Security",
    body: (
      <>
        <p>
          We use industry-standard measures to protect your information. Sensitive
          credentials such as AI and email keys are stored encrypted, and access to
          the Service is protected by authenticated, token-based sessions. No method
          of transmission or storage is completely secure, but we work to protect
          your data and limit access to it.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "7. Data Retention",
    body: (
      <>
        <p>
          We retain your information for as long as your account is active or as
          needed to provide the Service. You may request deletion of your account
          and associated data at any time (see &ldquo;Your Rights&rdquo; below).
          Some information may be retained where required for legal, security, or
          fraud-prevention purposes.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "8. Your Rights and Choices",
    body: (
      <>
        <p>You can:</p>
        <ul>
          <li>Access and update your profile information in the dashboard.</li>
          <li>Remove uploaded resumes, AI keys, and email credentials.</li>
          <li>Disconnect the extension at any time, which clears its stored data.</li>
          <li>
            Request access to, correction of, or deletion of your personal data by
            contacting us.
          </li>
        </ul>
        <p>
          Depending on your location, you may have additional rights under
          applicable data-protection laws.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "9. Children's Privacy",
    body: (
      <p>
        OneTap is not directed to individuals under the age of 16, and we do not
        knowingly collect personal information from children. If you believe a child
        has provided us with personal information, please contact us so we can remove
        it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "10. Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. When we make material
        changes, we will revise the &ldquo;Last updated&rdquo; date at the top of
        this page. Your continued use of the Service after an update constitutes
        acceptance of the revised policy.
      </p>
    ),
  },
  {
    id: "contact",
    title: "11. Contact Us",
    body: CONTACT_EMAIL ? (
      <p>
        If you have any questions about this Privacy Policy or how your data is
        handled, contact us at{" "}
        <a className="text-primary underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    ) : (
      <p>
        If you have any questions about this Privacy Policy or how your data is
        handled, please reach out through our{" "}
        <Link to="/support" className="text-primary underline underline-offset-4">
          Support page
        </Link>
        .
      </p>
    ),
  },
];

export function PrivacyPolicyPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacy Policy · OneTap";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="space-y-10 [&_a]:break-words [&_li]:mt-2 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="mb-3 text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <div className="space-y-4 text-base text-muted-foreground">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            See also our{" "}
            <Link to="/terms-of-service" className="text-primary underline underline-offset-4">
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
