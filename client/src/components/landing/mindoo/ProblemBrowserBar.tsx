type BrowserTab = {
  id: string;
  label: string;
  domain: string;
  active?: boolean;
};

const TABS: BrowserTab[] = [
  { id: "gmail", label: "Inbox (14) - mail.google.com", domain: "mail.google.com" },
  { id: "notion-tracker", label: "Job Search Tracker", domain: "notion.so" },
  {
    id: "stripe-jd",
    label: "Senior Software Engineer - Stripe",
    domain: "stripe.com",
    active: true,
  },
  { id: "linkedin-feed", label: "(14) Feed | LinkedIn", domain: "linkedin.com" },
  { id: "chatgpt", label: "Tailor email for Stripe role", domain: "chatgpt.com" },
  { id: "docs", label: "SWE Cover Letter - Google Docs", domain: "docs.google.com" },
  { id: "sheets", label: "Q2 Applications - Google Sheets", domain: "sheets.google.com" },
  { id: "notion-careers", label: "Software Engineer | Notion Careers", domain: "notion.so" },
  { id: "claude", label: "Rewrite outreach - Claude", domain: "claude.ai" },
  {
    id: "indeed",
    label: "Remote software engineer jobs | Indeed",
    domain: "indeed.com",
  },
  {
    id: "glassdoor",
    label: "Stripe Software Engineer Salaries | Glassdoor",
    domain: "glassdoor.com",
  },
  { id: "greenhouse", label: "Stripe - Senior Software Engineer", domain: "boards.greenhouse.io" },
];

function tabFaviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function TabFavicon({ domain }: { domain: string }) {
  return (
    <img
      className="m-problem-tab-favicon"
      src={tabFaviconUrl(domain)}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
    />
  );
}

export function ProblemBrowserBar() {
  return (
    <div data-reveal="" className="m-problem-browser" aria-hidden>
      <div className="m-problem-browser-frame">
        <div className="m-problem-browser-toolbar">
          <div className="m-problem-browser-controls">
            <span className="m-problem-browser-dot is-red" />
            <span className="m-problem-browser-dot is-yellow" />
            <span className="m-problem-browser-dot is-green" />
          </div>

          <div className="m-problem-browser-tabs-wrap">
            <div className="m-problem-browser-tabs">
              {TABS.map((tab, index) => (
                <div
                  key={tab.id}
                  className={`m-problem-browser-tab${tab.active ? " is-active" : ""}${index === TABS.length - 1 ? " is-last" : ""}`}
                >
                  <TabFavicon domain={tab.domain} />
                  <span className="m-problem-browser-tab-label">{tab.label}</span>
                  <span className="m-problem-browser-tab-close">×</span>
                </div>
              ))}
              <button type="button" className="m-problem-browser-new-tab" tabIndex={-1}>
                +
              </button>
            </div>
            <div className="m-problem-browser-tabs-fade" />
          </div>
        </div>
      </div>
    </div>
  );
}
