import { ApplicationsIsometricVisual } from "./ApplicationsIsometricVisual";
import { LinkedInFeedScroll } from "./LinkedInFeedScroll";
import { ModelProviderVisual } from "./ModelProviderVisual";
import { CHROME_EXTENSION_URL } from "@/lib/extensionPrompt";

const CHROME_WEB_STORE_ICON = "/chrome-web-store-icon.png";

function FeatureBulletCheck() {
  return (
    <svg
      className="m-feature-row-bullet-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM7.53044 11.9697C7.23755 11.6768 6.76268 11.6768 6.46978 11.9697C6.17689 12.2626 6.17689 12.7374 6.46978 13.0303L9.46978 16.0303C9.76268 16.3232 10.2376 16.3232 10.5304 16.0303L17.5304 9.03033C17.8233 8.73744 17.8233 8.26256 17.5304 7.96967C17.2375 7.67678 16.7627 7.67678 16.4698 7.96967L10.0001 14.4393L7.53044 11.9697Z"
        fill="currentColor"
      />
    </svg>
  );
}

const FEATURE_ROWS = [
  {
    id: "extension",
    tag: "Chrome extension",
    title: "See a job on LinkedIn?",
    titleLine2: "Apply in one click.",
    body: "OneTap detects the job automatically, writes a tailored email, and sends it without leaving LinkedIn in one click.",
    bullets: [
      "No copying and pasting job descriptions",
      "No switching between AI writing tools and Gmail",
      "Apply to more jobs in less time",
    ],
    variant: "extension" as const,
  },
  {
    id: "tracking",
    tag: "Application tracking",
    title: "Never lose track of a job application again.",
    body: "Track every application, interview, and response in one place. Stay organized, follow up on time, and always know what's next.",
    bullets: [
      "See every application and its current status",
      "Quickly find any job you've applied for",
      "Stay on top of interviews and follow-ups",
    ],
    variant: "track" as const,
  },
  {
    id: "byok",
    tag: "Bring your own AI",
    title: "Use your favorite AI model.",
    body: "Connect your own API key and pay only for what you use. Prefer not to manage API keys? Use OneTap's managed AI instead.",
    bullets: [
      "Choose the AI model you prefer",
      "Pay only for what you use",
      "No API key? Use OneTap's managed AI",
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
                  <p className="m-feature-row-tag">
                    {item.id === "extension" ? (
                      <img
                        src={CHROME_WEB_STORE_ICON}
                        alt=""
                        className="m-feature-row-tag-icon"
                      />
                    ) : null}
                    {item.tag}
                  </p>
                  <h3 className="m-h5 m-feature-row-title">
                    {item.title}
                    {"titleLine2" in item && item.titleLine2 ? (
                      <>
                        <br />
                        {item.titleLine2}
                      </>
                    ) : null}
                  </h3>
                  <p className="m-feature-row-body m-body-text">{item.body}</p>
                  <ul className="m-feature-row-bullets">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="m-body-text">
                        <FeatureBulletCheck />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  {item.id === "extension" ? (
                    <div className="m-feature-row-cta pt-8">
                      <a
                        href={CHROME_EXTENSION_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mh-hero-btn mh-hero-btn-primary"
                      >
                        Install Extension
                      </a>
                      <p className="m-feature-row-cta-note">
                        Works with Chrome, Arc, Brave, Edge, Comet, and other Chromium-based
                        browsers.
                      </p>
                    </div>
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
