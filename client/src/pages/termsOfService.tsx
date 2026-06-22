import { useEffect } from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "June 21, 2026";
const CONTACT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "";

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of
          OneTap, including our website, web application, Chrome extension, and related
          services (collectively, the &ldquo;Service&rdquo;). By creating an account,
          connecting the extension, or otherwise using the Service, you agree to these
          Terms and our{" "}
          <Link to="/privacy-policy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          If you do not agree, do not use the Service. If you use the Service on behalf
          of an organization, you represent that you have authority to bind that
          organization to these Terms.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "2. Description of the Service",
    body: (
      <>
        <p>
          OneTap is a job-application assistant that helps you organize opportunities,
          draft tailored outreach, and send applications from your own email account when
          you choose to. Features may include:
        </p>
        <ul>
          <li>Resume upload and parsing to personalize applications.</li>
          <li>
            A Chrome extension that lets you capture hiring posts from LinkedIn and send
            them to your OneTap account.
          </li>
          <li>
            AI-assisted drafting of application emails, using either your own AI provider
            credentials (&ldquo;Bring your own AI&rdquo;) or OneTap-hosted models
            (&ldquo;OneTap AI&rdquo;), depending on your plan.
          </li>
          <li>Gmail or app-password email integration to send messages on your behalf.</li>
          <li>Application tracking and status management in your dashboard.</li>
        </ul>
        <p>
          We may add, change, or discontinue features at any time. The Service is
          provided as a tool to assist you; you remain responsible for reviewing and
          approving content before it is sent.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "3. Eligibility",
    body: (
      <p>
        You must be at least 16 years old and able to form a binding contract to use the
        Service. You may not use the Service if you are barred from doing so under
        applicable law or if your account has been suspended or terminated by us.
      </p>
    ),
  },
  {
    id: "account",
    title: "4. Your Account",
    body: (
      <>
        <p>
          You sign in through our authentication provider (for example, Google via
          Supabase). You are responsible for maintaining the security of your account and
          for all activity that occurs under it.
        </p>
        <p>
          You agree to provide accurate information and to keep your account details up
          to date. Notify us promptly if you suspect unauthorized access to your account.
        </p>
      </>
    ),
  },
  {
    id: "user-content",
    title: "5. Your Content and Credentials",
    body: (
      <>
        <p>
          You retain ownership of content you submit, including resumes, job descriptions,
          and edited email drafts (&ldquo;User Content&rdquo;). You grant OneTap a
          limited license to host, process, and display User Content solely to operate
          and improve the Service for you.
        </p>
        <p>
          If you connect third-party credentials (AI API keys, Gmail, or app passwords),
          you authorize us to use them only to perform actions you request, such as
          generating drafts or sending applications. You represent that you have the right
          to provide such credentials and that their use complies with the third
          party&rsquo;s terms.
        </p>
        <p>
          You are solely responsible for the accuracy, legality, and appropriateness of
          applications and emails you send through the Service.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "6. Acceptable Use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for spam, harassment, fraud, or any unlawful purpose.</li>
          <li>
            Misrepresent your identity, qualifications, or affiliation in applications or
            outreach.
          </li>
          <li>
            Attempt to reverse engineer, scrape, overload, or disrupt the Service or its
            infrastructure.
          </li>
          <li>
            Use the extension or API in a way that violates LinkedIn, Google, or other
            third-party platform terms.
          </li>
          <li>Share account access or resell the Service without our written permission.</li>
          <li>Circumvent usage limits, quotas, or access controls.</li>
        </ul>
        <p>
          We may suspend or terminate access if we reasonably believe you have violated
          these Terms or pose a risk to the Service or other users.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "7. AI-Generated Content",
    body: (
      <>
        <p>
          The Service may use artificial intelligence to parse resumes, analyze job
          descriptions, and draft emails. AI output can be inaccurate, incomplete, or
          inappropriate. You must review all generated content before sending.
        </p>
        <p>
          OneTap does not guarantee that AI-generated text will be error-free, that
          employers will respond, or that you will obtain interviews or offers. You use
          AI-assisted features at your own discretion and risk.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "8. Third-Party Services",
    body: (
      <>
        <p>
          The Service integrates with third parties such as LinkedIn (via the extension),
          Google/Gmail, Supabase, payment processors, and AI model providers. Your use of
          those services is subject to their own terms and policies. OneTap is not
          responsible for third-party services we do not control.
        </p>
        <p>
          LinkedIn is a trademark of LinkedIn Corporation. OneTap is not affiliated with,
          endorsed by, or sponsored by LinkedIn.
        </p>
      </>
    ),
  },
  {
    id: "billing",
    title: "9. Subscriptions and Payments",
    body: (
      <>
        <p>
          Some features require a paid plan or are subject to usage quotas. Prices,
          limits, and plan features are described on our pricing pages and may change
          with notice where required.
        </p>
        <p>
          Payments are processed by our checkout partner. OneTap does not store full
          payment card details on our servers. Refunds, cancellations, and billing
          disputes are handled according to the policies shown at checkout and
          applicable law.
        </p>
        <p>
          Free trials or promotional allowances may be modified or discontinued at our
          discretion.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "10. Intellectual Property",
    body: (
      <p>
        The Service, including its software, design, branding, and documentation (excluding
        User Content), is owned by OneTap and protected by intellectual property laws. We
        grant you a limited, non-exclusive, non-transferable license to use the Service
        for your personal or internal business job-search purposes, subject to these
        Terms.
      </p>
    ),
  },
  {
    id: "termination",
    title: "11. Termination",
    body: (
      <>
        <p>
          You may stop using the Service at any time. You may disconnect the extension and
          remove credentials from your dashboard. To request account deletion, contact us
          as described below.
        </p>
        <p>
          We may suspend or terminate your access if you breach these Terms, if required by
          law, or if we discontinue the Service. Provisions that by their nature should
          survive termination (including disclaimers, limitations of liability, and
          indemnification) will survive.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "12. Disclaimers",
    body: (
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
        WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES
        OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO
        NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
      </p>
    ),
  },
  {
    id: "liability",
    title: "13. Limitation of Liability",
    body: (
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, ONETAP AND ITS AFFILIATES, OFFICERS,
        EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
        SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA,
        OPPORTUNITIES, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL
        LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF (A)
        THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED
        U.S. DOLLARS (USD $100), EXCEPT WHERE SUCH LIMITATIONS ARE PROHIBITED BY LAW.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "14. Indemnification",
    body: (
      <p>
        You agree to indemnify and hold harmless OneTap from claims, damages, losses, and
        expenses (including reasonable legal fees) arising from your User Content, your use
        of the Service, your violation of these Terms, or your violation of any
        third-party rights or platform rules.
      </p>
    ),
  },
  {
    id: "law",
    title: "15. Governing Law",
    body: (
      <p>
        These Terms are governed by the laws applicable in the jurisdiction where OneTap
        operates, without regard to conflict-of-law principles. Any disputes will be
        resolved in the courts of that jurisdiction, unless applicable law requires
        otherwise.
      </p>
    ),
  },
  {
    id: "changes",
    title: "16. Changes to These Terms",
    body: (
      <p>
        We may update these Terms from time to time. When we make material changes, we
        will update the &ldquo;Last updated&rdquo; date at the top of this page. Your
        continued use of the Service after changes become effective constitutes acceptance
        of the revised Terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "17. Contact Us",
    body: CONTACT_EMAIL ? (
      <p>
        Questions about these Terms? Contact us at{" "}
        <a className="text-primary underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    ) : (
      <p>
        Questions about these Terms? Please reach out through our{" "}
        <Link to="/support" className="text-primary underline underline-offset-4">
          Support page
        </Link>
        .
      </p>
    ),
  },
];

export function TermsOfServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Terms of Service · OneTap";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
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
            <Link to="/privacy-policy" className="text-primary underline underline-offset-4">
              Privacy Policy
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
