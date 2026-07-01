import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { RazorpaySecuredBadge } from "@/components/billing/RazorpaySecuredBadge";
import { trackLandingCtaEngaged } from "@/lib/analytics/landing";
import { trackProduct } from "@/lib/analytics/track";
import { formatBillingPeriod, formatMoney } from "@/lib/subscriptionDisplay";
import { pickPrimaryPricePoint, pricingQueryOptions } from "@/queries/pricingQueries";

function planBadge(slug: string, popular: boolean) {
  if (popular) return { label: "Fastest start", tone: "live" as const };
  if (slug === "byok") return { label: "Your keys", tone: "muted" as const };
  return { label: "All inclusive", tone: "muted" as const };
}

export function MindooPricingSection() {
  const pricingQuery = useQuery(pricingQueryOptions);
  const plans = [...(pricingQuery.data?.data.plans ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section id="pricing" className="m-section m-pricing">
      <div className="m-padding-global">
        <div className="m-container">
          <h2 data-reveal="" className="m-h3 m-pricing-title">
            Simple pricing. Unlimited applications.
          </h2>

          {pricingQuery.isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : pricingQuery.isError ? (
            <p data-reveal="" className="m-body-text m-text-center text-muted-foreground">
              Unable to load plans right now. Please refresh the page.
            </p>
          ) : plans.length === 0 ? (
            <p data-reveal="" className="m-body-text m-text-center text-muted-foreground">
              Plans are not available at the moment.
            </p>
          ) : (
            <div data-reveal="" className="m-pricing-grid">
              {plans.map((plan) => {
                const pricePoint = pickPrimaryPricePoint(plan.pricePoints);
                const badge = planBadge(plan.slug, plan.popular);
                const includedFeatures = plan.features.filter((f) => f.included).map((f) => f.label);

                return (
                  <article
                    key={plan.slug}
                    className={`m-pricing-card${plan.popular ? " is-highlighted" : ""}`}
                  >
                    <span className={`m-pricing-badge${badge.tone === "live" ? " is-live" : ""}`}>
                      {badge.label}
                    </span>

                    <h3 className="m-pricing-plan-name">{plan.displayName}</h3>

                    <div className="m-pricing-price-row">
                      <span className="m-pricing-price">
                        {pricePoint ? formatMoney(pricePoint.amountPaise, pricePoint.currency) : "—"}
                      </span>
                      <span className="m-pricing-price-note">
                        {pricePoint ? formatBillingPeriod(pricePoint.durationDays).replace("/", "per") : ""}
                      </span>
                    </div>

                    {plan.description ? (
                      <p className="m-pricing-summary m-body-text">{plan.description}</p>
                    ) : null}

                    {includedFeatures.length > 0 ? (
                      <ul className="m-pricing-features">
                        {includedFeatures.map((feature) => (
                          <li key={feature} className="m-body-text">
                            {feature}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <Link
                      to={`/signup?plan=${plan.slug}`}
                      className={`m-pricing-cta${plan.popular ? " is-primary" : ""}`}
                      onClick={() => {
                        trackProduct("plan_engaged", { plan_id: plan.slug, source: "landing" });
                        trackLandingCtaEngaged("pricing_subscribe", `/signup?plan=${plan.slug}`);
                      }}
                    >
                      Subscribe →
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          <RazorpaySecuredBadge data-reveal="" variant="landing" />
        </div>
      </div>
    </section>
  );
}
