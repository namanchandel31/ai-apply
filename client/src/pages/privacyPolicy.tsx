import { Link } from "react-router-dom";
import { useEffect } from "react";

const LAST_UPDATED = "June 25, 2026";

const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";
const GOOGLE_API_POLICY_URL =
  "https://developers.google.com/terms/api-services-user-data-policy";
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
    id: "google-user-data",
    title: "3. Google User Data",
    body: (
      <>
        <p>
          OneTap uses Google services in two ways: signing you in, and (optionally)
          connecting your Gmail account to send applications. This section explains
          what Google data we access, why we access it, where it is stored, whether
          we share it, and how you can revoke access.
        </p>

        <h3 className="mt-4 font-medium text-foreground">Sign in with Google</h3>
        <ul>
          <li>
            <strong>What we access.</strong> Your Google account email address, name,
            and profile picture (via Supabase Authentication).
          </li>
          <li>
            <strong>Why.</strong> To create your OneTap account and sign you in
            securely.
          </li>
          <li>
            <strong>Where it is stored.</strong> Account identifiers are stored in our
            database (hosted on Supabase). We do not store your Google password.
          </li>
          <li>
            <strong>Sharing.</strong> We do not sell or rent this data. It is shared
            only with Supabase as our authentication provider, solely to operate the
            Service.
          </li>
          <li>
            <strong>How to revoke access.</strong> Sign out of OneTap. You may also
            remove OneTap&rsquo;s access under{" "}
            <a
              href={GOOGLE_PERMISSIONS_URL}
              className="text-primary underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account &rarr; Third-party access
            </a>
            . Deleting your OneTap account removes associated data from our systems
            (see &ldquo;Your Rights and Choices&rdquo; below).
          </li>
        </ul>

        <h3 className="mt-4 font-medium text-foreground">Gmail connection (optional)</h3>
        <ul>
          <li>
            <strong>What we access.</strong> If you choose to connect Gmail, we
            request Google OAuth permission to send email on your behalf (
            <code>gmail.send</code>) and to read your connected Gmail address (
            <code>userinfo.email</code>). We do not request permission to read your
            inbox unless you explicitly opt in to a future reply-tracking feature
            (when that feature is enabled, <code>gmail.readonly</code> may be
            requested). We do not read, store, or analyze the contents of your inbox
            for advertising.
          </li>
          <li>
            <strong>Why.</strong> To send job-application emails you approve from
            your own Gmail address, without sharing your Gmail password with us.
          </li>
          <li>
            <strong>Where it is stored.</strong> Gmail OAuth tokens and your connected
            email address are stored encrypted in our application database. Message
            content you send is processed to deliver the email and retained as part of
            your application history in OneTap.
          </li>
          <li>
            <strong>Sharing.</strong> We do not sell Gmail data. Email transmission
            goes through Google&rsquo;s Gmail API. We do not share your Gmail data with
            advertisers or unrelated third parties.
          </li>
          <li>
            <strong>How to revoke access.</strong> In OneTap, go to{" "}
            <strong>Setup &rarr; Email</strong> and choose{" "}
            <strong>Disconnect Gmail</strong>. This revokes our tokens with Google and
            deletes stored Gmail credentials from our database. You can also remove
            access anytime at{" "}
            <a
              href={GOOGLE_PERMISSIONS_URL}
              className="text-primary underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account &rarr; Third-party access
            </a>
            .
          </li>
        </ul>

        <p>
          <strong>App password alternative.</strong> If you use a Gmail app password
          instead of OAuth, we store the encrypted app password only to send mail you
          initiate. You can remove it in Setup and revoke the app password in your
          Google Account security settings.
        </p>

        <p>
          OneTap&rsquo;s use of information received from Google APIs adheres to the{" "}
          <a
            href={GOOGLE_API_POLICY_URL}
            className="text-primary underline underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "4. How We Use Your Information",
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
    title: "5. The Chrome Extension",
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
    title: "6. Third-Party Services",
    body: (
      <>
        <p>
          We rely on a limited number of service providers to operate OneTap. These
          providers process data only as needed to provide their services to us:
        </p>
        <ul>
          <li>
            <strong>Google</strong> &mdash; sign-in (via Supabase) and, when you
            connect Gmail, sending email through the Gmail API. See &ldquo;Google User
            Data&rdquo; above for details.
          </li>
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
    title: "7. Data Storage and Security",
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
    title: "8. Data Retention",
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
    title: "9. Your Rights and Choices",
    body: (
      <>
        <p>You can:</p>
        <ul>
          <li>Access and update your profile information in the dashboard.</li>
          <li>Remove uploaded resumes, AI keys, and email credentials.</li>
          <li>
            Disconnect Gmail in <strong>Setup &rarr; Email</strong>, which revokes
            our Google tokens and deletes stored Gmail credentials from our database.
          </li>
          <li>
            Revoke OneTap&rsquo;s Google access at any time via{" "}
            <a
              href={GOOGLE_PERMISSIONS_URL}
              className="text-primary underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account &rarr; Third-party access
            </a>
            .
          </li>
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
    title: "10. Children's Privacy",
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
    title: "11. Changes to This Policy",
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
    title: "12. Contact Us",
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

        <div className="space-y-10 [&_a]:break-words [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_h3]:text-base [&_li]:mt-2 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
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
