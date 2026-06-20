export type PlanId = "byok" | "onetap_llm";

export type BillingPlan = {
  id: PlanId;
  badge: string;
  badgeTone: "muted" | "live";
  name: string;
  price: string;
  priceNote: string;
  summary: string;
  features: string[];
  highlighted: boolean;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "byok",
    badge: "Your keys",
    badgeTone: "muted",
    name: "Bring your own AI",
    price: "₹99",
    priceNote: "per month",
    summary:
      "Connect your provider and pay token costs directly. Full control over which models you use and what you spend.",
    features: [
      "Unlimited applications",
      "OpenAI, Gemini, Groq, or OpenRouter",
      "You pay your provider for tokens",
      "Chrome extension, Gmail sending, and tracking",
    ],
    highlighted: false,
  },
  {
    id: "onetap_llm",
    badge: "Fastest start",
    badgeTone: "live",
    name: "OneTap LLM",
    price: "₹149",
    priceNote: "per month",
    summary: "Skip API setup and start applying in minutes. OneTap hosted models are included.",
    features: [
      "Unlimited applications",
      "No API key setup required",
      "OneTap-hosted LLM included",
      "Chrome extension, Gmail sending, and tracking",
    ],
    highlighted: true,
  },
];
