export type EventTier = "business" | "product" | "operational";

export type AnalyticsContext = {
  authenticated: boolean;
  subscription_tier?: string;
  page_name?: string;
  page_path?: string;
  workflow_id?: string;
};

export type TrackOptions = {
  tier?: EventTier;
  schema_version?: number;
};
