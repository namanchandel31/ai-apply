import { Link } from "react-router-dom";

const FOOTER_LINKS = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Support", href: "/support" },
  { label: "Sign in", href: "/login" },
] as const;

export function MindooFooter() {
  const year = new Date().getFullYear();

  return (
    <footer id="footer" className="m-footer-bar">
      <div className="m-padding-global">
        <div className="m-container">
          <p className="m-footer-line m-body-text">
            <span className="m-footer-copy">© {year} OneTap</span>
            {FOOTER_LINKS.map((link) => (
              <span key={link.href} className="m-footer-line-item">
                <span className="m-footer-sep" aria-hidden>
                  ·
                </span>
                <Link to={link.href} className="m-footer-line-link">
                  {link.label}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
