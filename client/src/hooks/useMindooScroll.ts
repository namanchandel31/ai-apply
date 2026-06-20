import { useEffect } from "react";

const NAV_THRESHOLD = 72;

function updateHeroBackgroundOpacity() {
  const root = document.documentElement;
  const shell = document.querySelector(".mh-top-shell");
  const problem = document.getElementById("problem");

  if (shell) {
    root.style.setProperty(
      "--hero-bg-height",
      `${shell.getBoundingClientRect().height}px`,
    );
  }

  if (!problem) {
    root.style.setProperty("--hero-bg-opacity", "1");
    return;
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const problemTop = problem.getBoundingClientRect().top;
  const fadeStart = window.innerHeight;
  const fadeEnd = window.innerHeight * 0.35;

  let opacity = 1;
  if (problemTop >= fadeStart) {
    opacity = 1;
  } else if (problemTop <= fadeEnd) {
    opacity = 0;
  } else {
    opacity = (problemTop - fadeEnd) / (fadeStart - fadeEnd);
  }

  if (reduceMotion) {
    opacity = problemTop < fadeStart ? 0 : 1;
  }

  root.style.setProperty("--hero-bg-opacity", String(opacity));
}

/** Mindoo-style scroll direction tracking + smooth anchor scrolling. */
export function useMindooScroll() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-scrolling-started", "false");
    root.setAttribute("data-scrolling-direction", "up");
    root.setAttribute("data-hero-past", "false");
    root.style.setProperty("--hero-bg-opacity", "1");

    let lastScrollTop = 0;
    const threshold = 10;
    let rafId: number | null = null;

    const syncHeroBackground = () => {
      rafId = null;
      updateHeroBackgroundOpacity();
    };

    const onScroll = () => {
      const nowScrollTop = window.scrollY;

      root.setAttribute(
        "data-scrolling-started",
        nowScrollTop > 8 ? "true" : "false",
      );

      if (Math.abs(lastScrollTop - nowScrollTop) >= threshold) {
        const direction = nowScrollTop > lastScrollTop ? "down" : "up";
        root.setAttribute("data-scrolling-direction", direction);
        lastScrollTop = nowScrollTop;
      }

      const hero = document.querySelector('[data-hero="section"]');
      if (hero) {
        const heroBottom = hero.getBoundingClientRect().bottom;
        const pastHero = heroBottom <= NAV_THRESHOLD;
        root.setAttribute("data-hero-past", pastHero ? "true" : "false");
      }

      if (rafId === null) {
        rafId = window.requestAnimationFrame(syncHeroBackground);
      }
    };

    const onResize = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(syncHeroBackground);
      }
    };

    onScroll();
    updateHeroBackgroundOpacity();

    document.addEventListener("click", handleMindooAnchorClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      document.removeEventListener("click", handleMindooAnchorClick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      root.removeAttribute("data-scrolling-started");
      root.removeAttribute("data-scrolling-direction");
      root.removeAttribute("data-hero-past");
      root.style.removeProperty("--hero-bg-opacity");
      root.style.removeProperty("--hero-bg-height");
    };
  }, []);
}

export function mindooScrollTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

function handleMindooAnchorClick(event: MouseEvent) {
  const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='#']");
  if (!anchor || anchor.getAttribute("href") === "#") return;

  const hash = anchor.getAttribute("href")?.slice(1);
  if (!hash || !document.getElementById(hash)) return;

  event.preventDefault();
  mindooScrollTo(hash);
}
