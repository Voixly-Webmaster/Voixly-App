export const SITE_NAME = "Voixly ClientHub";
export const SHORT_NAME = "ClientHub";
export const BRAND_NAME = "Voixly";
export const LEGAL_NAME = "Voixly Digital Marketing";
export const MARKETING_URL = "https://voixly.com";
export const SUPPORT_EMAIL = "info@voixly.com";

export const DEFAULT_TITLE = "ClientHub | Voixly";
export const TITLE_TEMPLATE = "%s | Voixly ClientHub";

export const DEFAULT_DESCRIPTION =
  "Voixly ClientHub is the secure client portal and operations hub for billing, projects, files, and support — built by Voixly Digital Marketing.";

export const LOGIN_TITLE = "Sign in";
export const LOGIN_DESCRIPTION =
  "Sign in to Voixly ClientHub to review invoices, track projects, share files, and message your team in one secure place.";

export const OG_TITLE = "Voixly ClientHub";
export const OG_DESCRIPTION =
  "Your secure portal for billing, projects, files, and support — powered by Voixly.";

export const KEYWORDS = [
  "Voixly",
  "Voixly ClientHub",
  "client portal",
  "Voixly login",
  "client billing portal",
  "project updates",
  "Voixly Digital Marketing",
];

export function getMetadataBase(): URL {
  const raw =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "https://app.voixly.com";
  try {
    return new URL(raw.replace(/\/$/, ""));
  } catch {
    return new URL("https://app.voixly.com");
  }
}

export function getSiteUrl(): string {
  return getMetadataBase().origin;
}
