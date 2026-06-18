export type TrackerStatusColor =
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red";

export type TrackerStatusOption = {
  id: string;
  name: string;
  color: TrackerStatusColor | string;
  stage?: number | null;
  system?: boolean;
};

/** System-assigned when application is ready for manual send. */
export const EMAIL_READY_TRACKER_STATUS_ID = "ts_email_ready";

/** System-assigned when application email is sent or auto-apply is enabled. */
export const EMAIL_SENT_TRACKER_STATUS_ID = "ts_email_sent";

/** All built-in default statuses (cannot be deleted). */
export const SYSTEM_TRACKER_STATUS_IDS = new Set([
  "ts_email_ready",
  "ts_email_sent",
  "ts_screening",
  "ts_interviewing",
  "ts_offer",
  "ts_withdrawn",
  "ts_ghosted",
  "ts_rejected",
  "ts_accepted",
]);

export function isSystemTrackerStatus(option: Pick<TrackerStatusOption, "id" | "system">) {
  return option.system === true || SYSTEM_TRACKER_STATUS_IDS.has(option.id);
}

export function sortTrackerStatusOptions(options: TrackerStatusOption[]): TrackerStatusOption[] {
  const system = options
    .filter((o) => isSystemTrackerStatus(o))
    .sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0));
  const custom = options
    .filter((o) => !isSystemTrackerStatus(o))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return [...system, ...custom];
}

export const TRACKER_STATUS_COLOR_STYLES: Record<
  TrackerStatusColor,
  { dot: string; text: string }
> = {
  gray: { dot: "bg-[#9B9A97]", text: "text-[#9B9A97]" },
  brown: { dot: "bg-[#64473A]", text: "text-[#64473A]" },
  orange: { dot: "bg-[#D9730D]", text: "text-[#D9730D]" },
  yellow: { dot: "bg-[#DFAB01]", text: "text-[#B58900]" },
  green: { dot: "bg-[#0F7B6C]", text: "text-[#0F7B6C]" },
  blue: { dot: "bg-[#0B6E99]", text: "text-[#0B6E99]" },
  purple: { dot: "bg-[#6940A5]", text: "text-[#6940A5]" },
  pink: { dot: "bg-[#AD1A72]", text: "text-[#AD1A72]" },
  red: { dot: "bg-[#E03E3E]", text: "text-[#E03E3E]" },
};

export function trackerStatusStyle(color: TrackerStatusColor | string | undefined) {
  if (color && color in TRACKER_STATUS_COLOR_STYLES) {
    return TRACKER_STATUS_COLOR_STYLES[color as TrackerStatusColor];
  }
  return TRACKER_STATUS_COLOR_STYLES.gray;
}
