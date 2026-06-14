import { SplitHeading } from "./shared";

const TRUST_CARDS = [
  {
    title: "Transparent by design.",
    body: "No black boxes. Every draft, score, and send is visible before it goes out — full control over what recruiters see.",
    gradient: "linear-gradient(160deg, #dbeafe 0%, #eff6ff 100%)",
  },
  {
    title: "Proven in real workflows.",
    body: "Built for high-volume job seekers applying daily. Async pipeline, retry paths, and honest status on every application.",
    gradient: "linear-gradient(160deg, #dcfce7 0%, #f0fdf4 100%)",
  },
  {
    title: "Built for your data.",
    body: "BYOK for AI providers. Gmail app passwords stored per-user. Your resume and credentials never leave your control.",
    gradient: "linear-gradient(160deg, #fce7f3 0%, #fdf2f8 100%)",
  },
];

export function MindooTrustSection() {
  return (
    <section id="trust" className="m-section m-trust">
      <div className="m-spacing-xxl" />
      <div className="m-padding-global">
        <div className="m-container">
          <div className="m-trust-inner">
            <SplitHeading
              className="m-h3 m-ch-20 m-text-center"
              primary="Highest trust standards, through and through."
            />

            <div className="m-trust-grid">
              {TRUST_CARDS.map((card) => (
                <article key={card.title} data-reveal="" className="m-trust-card">
                  <div className="m-trust-img" style={{ background: card.gradient }} aria-hidden />
                  <div className="m-trust-copy">
                    <h3 className="m-h5">{card.title}</h3>
                    <p className="m-body-secondary">{card.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="m-spacing-xxl" />
    </section>
  );
}
