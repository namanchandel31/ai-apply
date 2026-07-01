export function resolvePageName(pathname: string): string {
  if (pathname === "/") return "landing";
  if (pathname === "/login" || pathname === "/signup") return "login";
  if (pathname === "/forgot-password") return "forgot_password";
  if (pathname === "/reset-password") return "reset_password";
  if (pathname === "/auth/callback") return "auth_callback";
  if (pathname === "/subscriptions") return "subscriptions";
  if (pathname === "/onboarding") return "onboarding";
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/applications") return "applications";
  if (pathname === "/setup") return "setup";
  if (pathname === "/settings/extension") return "settings_extension";
  if (pathname === "/referrals") return "referrals";
  if (pathname === "/support") return "support";
  if (pathname === "/privacy-policy") return "privacy";
  if (pathname === "/terms-of-service") return "terms";
  if (pathname === "/admin") return "admin";
  return "unknown";
}
