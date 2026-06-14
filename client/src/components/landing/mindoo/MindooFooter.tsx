import { OneTapBrand } from "@/components/OneTapLogomark";

const FOOTER_NAV = [
  { label: "Home", href: "/" },
  { label: "Problem", href: "#problem" },
  { label: "Solution", href: "#solution" },
];

const FOOTER_LEGAL = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Contact", href: "#" },
];

export function MindooFooter() {
  return (
    <section className="m-section m-footer-section">
      <div className="m-padding-global m-footer-padding">
        <div className="m-bg-box m-footer-wrapper">
          <div className="m-footer-top">
            <OneTapBrand />

            <div className="m-footer-grid">
              <div className="m-footer-group">
                <p className="m-text-caption is-footer">navigation</p>
                {FOOTER_NAV.map(({ label, href }) => (
                  <a key={label} href={href} className="m-footer-link">
                    {label}
                  </a>
                ))}
              </div>

              <div className="m-footer-group">
                <p className="m-text-caption is-footer">legal</p>
                {FOOTER_LEGAL.map(({ label, href }) => (
                  <a key={label} href={href} className="m-footer-link">
                    {label}
                  </a>
                ))}
              </div>

              <div className="m-footer-group">
                <p className="m-text-caption is-footer">product</p>
                <a href="#how-it-works" className="m-footer-link">
                  How it works
                </a>
                <a href="#waitlist" className="m-footer-link">
                  Waitlist
                </a>
                <a href="/login" className="m-footer-link">
                  Sign in
                </a>
              </div>
            </div>
          </div>

          <div className="m-footer-art" aria-hidden>
            <div className="m-footer-cloud">☁</div>
            <OneTapBrand className="m-footer-brand-float" />
          </div>
        </div>
      </div>
    </section>
  );
}
