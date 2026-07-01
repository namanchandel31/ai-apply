import { useEffect } from "react";

/** Adds `.m-visible` when elements with `[data-reveal]` enter the viewport. */
export function useMindooReveal() {
  useEffect(() => {
    const observed = new WeakSet<HTMLElement>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("m-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -5% 0px" }
    );

    const observeNode = (node: HTMLElement) => {
      if (observed.has(node)) return;
      observed.add(node);
      observer.observe(node);
    };

    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach(observeNode);
    };

    scan();

    const mutationObserver = new MutationObserver(() => {
      scan();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, []);
}
