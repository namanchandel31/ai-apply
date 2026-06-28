type Props = {
  ready: boolean;
};

export const HERO_LEAD =
  "Upload your resume once, connect your Gmail, paste a job description, and OneTap writes and sends a personalized application from your Gmail and keeps every application organized in one place.";

export function HeroHeadline({ ready }: Props) {
  return (
    <div className={`mh-hero-headline${ready ? " is-ready" : ""}`}>
      <h1 data-hero="heading" className="mh-h1-paper">
        Apply to more jobs in less time.
      </h1>
    </div>
  );
}
