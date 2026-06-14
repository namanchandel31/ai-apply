import type { AuthUser } from "@/auth/AuthContext";

export function deriveNameFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0]?.trim() || "";
  const capitalize = (word: string) =>
    word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "";
  const parts = local.split(/[._+-]+/).filter(Boolean).map(capitalize);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return { firstName: "", lastName: "" };
}

export function getDisplayFirstName(user: Pick<AuthUser, "firstName" | "fullName" | "email">): string {
  if (user.firstName?.trim()) return user.firstName.trim();
  if (user.fullName?.trim()) return user.fullName.trim().split(/\s+/)[0];
  if (user.email) return deriveNameFromEmail(user.email).firstName;
  return "Account";
}

export function getUserInitials(user: Pick<AuthUser, "firstName" | "lastName" | "fullName" | "email">): string {
  const first = user.firstName?.trim() || user.fullName?.trim().split(/\s+/)[0] || "";
  const last =
    user.lastName?.trim() ||
    (user.fullName?.includes(" ") ? user.fullName.trim().split(/\s+/).slice(1).join(" ") : "");

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  if (user.email) {
    const derived = deriveNameFromEmail(user.email);
    if (derived.firstName && derived.lastName) {
      return `${derived.firstName[0]}${derived.lastName[0]}`.toUpperCase();
    }
    if (derived.firstName) {
      return derived.firstName.slice(0, 2).toUpperCase();
    }
    return user.email[0]?.toUpperCase() || "?";
  }
  return "?";
}
