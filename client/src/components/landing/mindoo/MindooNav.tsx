import { Link } from "react-router-dom";
import { useState } from "react";
import { OneTapBrand } from "@/components/OneTapLogomark";
import { mindooScrollTo } from "@/hooks/useMindooScroll";

const NAV_LINKS = [
  { label: "Features", id: "features" },
  { label: "How it Works", id: "how-it-works" },
  { label: "Pricing", id: "pricing" },
  { label: "FAQ", id: "faq" },
] as const;

export function MindooNav() {
  const [open, setOpen] = useState(false);

  const scrollToSection = (id: string) => {
    mindooScrollTo(id);
    setOpen(false);
  };

  return (
    <div className="m-nav-wrap m-nav-wrap--hero">
      <nav className="mindoo-landing-nav m-nav">
        <div className="m-nav-inner">
          <OneTapBrand className="m-nav-brand" logomarkClassName="m-nav-logomark" />

          <ul className="m-nav-links">
            {NAV_LINKS.map(({ label, id }) => (
              <li key={label}>
                <a
                  href={`#${id}`}
                  className="m-nav-link"
                  onClick={(event) => {
                    event.preventDefault();
                    scrollToSection(id);
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          <div className="m-nav-actions">
            <Link to="/login" className="m-btn m-btn-secondary m-nav-sign-in">
              Sign in
            </Link>
            <button
              type="button"
              className="m-btn m-btn-primary m-nav-cta"
              onClick={() => mindooScrollTo("pricing")}
            >
              Get started
            </button>
          </div>

          <button
            type="button"
            className="m-nav-toggle"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="15" height="14" viewBox="0 0 15 14" fill="none" aria-hidden className="m-nav-toggle-icon">
              <path
                d="M10.8333 11.6667V13.3333H1.66667V11.6667H10.8333ZM15 5.83333V7.5H0V5.83333H15ZM13.3333 0V1.66667H4.16667V0H13.3333Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {open ? (
          <div className="m-nav-mobile">
            {NAV_LINKS.map(({ label, id }) => (
              <a
                key={label}
                href={`#${id}`}
                className="m-nav-link"
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSection(id);
                }}
              >
                {label}
              </a>
            ))}
            <Link to="/login" className="m-btn m-btn-secondary" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <button
              type="button"
              className="m-btn m-btn-primary"
              onClick={() => scrollToSection("pricing")}
            >
              Get started
            </button>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
