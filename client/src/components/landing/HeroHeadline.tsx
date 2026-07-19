type Props = {
  ready: boolean;
};

export const HERO_LEAD =
  "OneTap writes personalized applications from your résumé, sends them from your Gmail, and keeps your entire job search in one place.";

export function HeroHeadline({ ready }: Props) {
  return (
    <div className={`mh-hero-headline${ready ? " is-ready" : ""}`}>
      <h1 data-hero="heading" className="mh-h1-paper">
        Better job applications. Less busywork.
      </h1>
    </div>
  );
}
