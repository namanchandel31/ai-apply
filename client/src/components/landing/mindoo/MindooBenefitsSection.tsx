import { SplitHeading } from "./shared";

const BENEFITS = [
  "No new systems to learn",
  "Works with your Gmail inbox",
  "No tech expertise needed",
  "Built for real job applications",
  "Your data stays yours. BYOK",
  "Apply more without burning out",
];

export function MindooBenefitsSection() {
  return (
    <section className="m-section m-benefits">
      <div className="m-spacing-xxl" />
      <div className="m-padding-global">
        <div className="m-container">
          <SplitHeading
            className="m-h3 m-ch-20 m-text-center"
            primary="Designed to fit the way you already search."
          />
          <p data-reveal="" className="m-benefits-lead m-text-center">
            OneTap doesn&apos;t replace your judgment.
            <br />
            It takes on the repeat work around applying, so you can focus on roles that
            actually fit.
          </p>

          <div data-reveal="" className="m-benefits-wheel">
            <div className="m-benefits-ring" aria-hidden />
            <ul className="m-benefits-list">
              {BENEFITS.map((label, i) => (
                <li key={label} className={`m-benefit-item m-benefit-item-${i + 1}`}>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <p data-reveal="" className="m-text-caption m-ch-44 m-text-center">
            Applications feel personal. Your search feels organized. Time goes where it
            matters most.
          </p>
        </div>
      </div>
      <div className="m-spacing-xxl" />
    </section>
  );
}
