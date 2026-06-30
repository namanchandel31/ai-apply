import { useEffect, useRef } from "react";
import {
  trackLandingScrollDepth,
  trackLandingSectionViewed,
} from "@/lib/analytics/landing";

const SECTIONS = ["problem", "features", "how-it-works", "pricing", "faq", "get-started"] as const;
const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;

export function useLandingAnalytics() {
  const seenSections = useRef(new Set<string>());
  const seenScroll = useRef(new Set<number>());

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    for (const id of SECTIONS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
            if (seenSections.current.has(id)) continue;
            seenSections.current.add(id);
            trackLandingSectionViewed(id);
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(el);
      observers.push(observer);
    }

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY;
      const height = doc.scrollHeight - window.innerHeight;
      if (height <= 0) return;
      const percent = Math.min(100, Math.round((scrollTop / height) * 100));
      for (const threshold of SCROLL_THRESHOLDS) {
        if (percent >= threshold && !seenScroll.current.has(threshold)) {
          seenScroll.current.add(threshold);
          trackLandingScrollDepth(threshold);
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}
