import { ApplicationsIsometricVisual } from "./ApplicationsIsometricVisual";
import { LinkedInFeedScroll } from "./LinkedInFeedScroll";
import { ModelProviderVisual } from "./ModelProviderVisual";
import { CHROME_EXTENSION_URL } from "@/lib/extensionPrompt";

const FEATURE_ROWS = [
  {
    id: "extension",
    tag: "Chrome extension",
    title: "Apply directly from LinkedIn in one click",
    body: "Install the extension and apply from any job post without copy-pasting. OneTap captures the role and queues your application while you keep browsing listings.",
    bullets: [
      "Detects the job post automatically, no copy-paste",
      "Drafts a personalized email from your résumé",
      "Keep browsing LinkedIn without switching tabs",
    ],
    variant: "extension" as const,
  },
  {
    id: "tracking",
    tag: "Application tracking",
    title: "Manage and track every job application",
    body: "Every role, status, and follow-up in one dashboard. Search, filter, and retry failed sends without spreadsheets or digging through your inbox.",
    bullets: [
      "Every role, status, and match score in one view",
      "Search and filter across your full pipeline",
      "Retry failed sends or fix missing contacts in place",
    ],
    variant: "track" as const,
  },
  {
    id: "byok",
    tag: "Bring your own AI",
    title: "Your AI. Your data. Private by default.",
    body: "Connect your own provider key. Your résumé and applications stay yours. OneTap never trains on your data or shares it with third parties.",
    bullets: [
      "OpenAI, Gemini, Groq, or OpenRouter API keys supported",
      "Your résumé and applications stay under your control",
      "Private by default: we never train on your data",
    ],
    variant: "byok" as const,
  },
] as const;

export function MindooFeatureShowcaseSection() {
  return (
    <section id="features" className="m-section m-feature-showcase">
      <div className="m-padding-global">
        <div className="m-container">
          <div className="m-feature-showcase-inner">
            {FEATURE_ROWS.map((item, index) => (
              <article
                key={item.id}
                data-reveal=""
                className={`m-feature-row${index % 2 === 1 ? " is-flipped" : ""}`}
              >
                <div className="m-feature-row-copy">
                  <p className="m-text-caption m-feature-row-tag">{item.tag}</p>
                  <h3 className="m-h4 m-feature-row-title">{item.title}</h3>
                  <p className="m-feature-row-body m-body-text">{item.body}</p>
                  <ul className="m-feature-row-bullets">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="m-body-text">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  {item.id === "extension" ? (
                    <a
                      href={CHROME_EXTENSION_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mh-hero-btn mh-hero-btn-primary"
                    >
                      Download Chrome extension
                    </a>
                  ) : null}
                </div>
                <div
                  className={`m-feature-row-visual${item.id === "extension" ? " m-feature-row-visual--feed" : ""}${item.id === "tracking" ? " m-feature-row-visual--track" : ""}${item.id === "byok" ? " m-feature-row-visual--byok" : ""}`}
                  aria-hidden={item.id !== "byok" ? true : undefined}
                >
                  {item.id === "extension" ? (
                    <LinkedInFeedScroll />
                  ) : item.id === "tracking" ? (
                    <ApplicationsIsometricVisual />
                  ) : (
                    <ModelProviderVisual />
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
