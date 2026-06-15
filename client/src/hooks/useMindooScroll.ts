import { useEffect } from "react";

/** Mindoo-style scroll direction tracking + smooth anchor scrolling. */
export function useMindooScroll() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-scrolling-started", "false");
    root.setAttribute("data-scrolling-direction", "up");
    root.setAttribute("data-hero-past", "false");

    let lastScrollTop = 0;
    const threshold = 10;
    const thresholdTop = 50;

    const onScroll = () => {
      const nowScrollTop = window.scrollY;

      if (Math.abs(lastScrollTop - nowScrollTop) >= threshold) {
        const direction = nowScrollTop > lastScrollTop ? "down" : "up";
        root.setAttribute("data-scrolling-direction", direction);

        const started = nowScrollTop > thresholdTop;
        root.setAttribute("data-scrolling-started", started ? "true" : "false");

        lastScrollTop = nowScrollTop;
      }

      const hero = document.querySelector('[data-hero="section"]');
      if (hero) {
        const heroBottom = hero.getBoundingClientRect().bottom;
        const pastHero = heroBottom <= 72;
        root.setAttribute("data-hero-past", pastHero ? "true" : "false");
      }
    };

    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute("data-scrolling-started");
      root.removeAttribute("data-scrolling-direction");
      root.removeAttribute("data-hero-past");
    };
  }, []);
}

export function mindooScrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
