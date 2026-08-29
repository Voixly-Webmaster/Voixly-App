import {
  BRAND_NAME,
  DEFAULT_DESCRIPTION,
  LEGAL_NAME,
  MARKETING_URL,
  OG_DESCRIPTION,
  SITE_NAME,
  SUPPORT_EMAIL,
  getSiteUrl,
} from "@/lib/seo";

export function SiteJsonLd() {
  const site = getSiteUrl();
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${MARKETING_URL}/#organization`,
        name: BRAND_NAME,
        legalName: LEGAL_NAME,
        url: MARKETING_URL,
        email: SUPPORT_EMAIL,
        logo: `${site}/brand/voixly-logomark.png`,
        description:
          "A full-spectrum marketing agency — branding, SEO and AI search, web design, video, social, and podcast production.",
      },
      {
        "@type": "WebApplication",
        "@id": `${site}/#app`,
        name: SITE_NAME,
        url: site,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: DEFAULT_DESCRIPTION,
        provider: { "@id": `${MARKETING_URL}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${site}/login#webpage`,
        url: `${site}/login`,
        name: `Sign in to ${SITE_NAME}`,
        description: OG_DESCRIPTION,
        isPartOf: { "@id": `${site}/#app` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
