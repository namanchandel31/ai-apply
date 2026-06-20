import { useEffect, useRef, useState, type ReactNode } from "react";

export function AnimatedWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ").filter(Boolean);
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="mh-h1-word"
          style={{ animationDelay: `${i * 0.03}s` }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

export function Reveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "h2" | "p" | "section";
}) {
  return (
    <Tag data-reveal="" className={className}>
      {children}
    </Tag>
  );
}

export function SplitHeading({
  tertiary,
  primary,
  className,
}: {
  tertiary?: string;
  primary: string;
  className?: string;
}) {
  return (
    <h2 data-reveal="" className={className}>
      {tertiary ? (
        <span className="m-split-heading-tertiary m-title-tertiary">{tertiary}</span>
      ) : null}
      {tertiary ? (
        <span className="m-split-heading-primary">{primary}</span>
      ) : (
        primary
      )}
    </h2>
  );
}

export function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}
