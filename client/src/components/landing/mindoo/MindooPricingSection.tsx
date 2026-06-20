import { Link } from "react-router-dom";
import { BILLING_PLANS } from "@/lib/billingPlans";

export function MindooPricingSection() {
  return (
    <section id="pricing" className="m-section m-pricing">
      <div className="m-padding-global">
        <div className="m-container">
          <h2 data-reveal="" className="m-h3 m-pricing-title">
            Simple pricing. Unlimited applications.
          </h2>

          <div data-reveal="" className="m-pricing-grid">
            {BILLING_PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`m-pricing-card${plan.highlighted ? " is-highlighted" : ""}`}
              >
                <span
                  className={`m-pricing-badge${plan.badgeTone === "live" ? " is-live" : ""}`}
                >
                  {plan.badge}
                </span>

                <h3 className="m-pricing-plan-name">{plan.name}</h3>

                <div className="m-pricing-price-row">
                  <span className="m-pricing-price">{plan.price}</span>
                  <span className="m-pricing-price-note">{plan.priceNote}</span>
                </div>

                <p className="m-pricing-summary m-body-text">{plan.summary}</p>

                <ul className="m-pricing-features">
                  {plan.features.map((feature) => (
                    <li key={feature} className="m-body-text">
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/signup"
                  className={`m-pricing-cta${plan.highlighted ? " is-primary" : ""}`}
                >
                  Subscribe →
                </Link>
              </article>
            ))}
          </div>

          <p data-reveal="" className="m-pricing-trust m-body-text">
            Payments are handled through a secure checkout partner.
          </p>
        </div>
      </div>
    </section>
  );
}
