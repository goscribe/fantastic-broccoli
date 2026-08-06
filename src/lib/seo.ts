export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://scribe.study";

export const siteName = "Scribe";

export const defaultTitle =
  "Scribe — AI Study Tool for Flashcards, Worksheets & Study Sessions";

export const defaultDescription =
  "Turn your PDFs, slides, notes, and lecture audio into personalized AI study sessions — readings, AI-graded worksheets, flashcards, quizzes, and a study copilot. Free AI study tool for AP, IB, university, and exam prep.";

export const keywords = [
  "AI study tool",
  "AI study app",
  "study tools for students",
  "AI flashcard maker",
  "flashcards from PDF",
  "AI worksheet generator",
  "AI quiz generator",
  "study guide generator",
  "lecture transcription study notes",
  "spaced repetition app",
  "AP exam prep",
  "AP study tool",
  "IB exam prep",
  "IB study tool",
  "GCSE revision",
  "A-level revision",
  "university study app",
  "exam preparation",
  "active recall",
  "study session planner",
  "AI tutor",
  "study copilot",
];

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path}`;
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  logo: absoluteUrl("/logo.png"),
  sameAs: ["https://www.producthunt.com/products/scribe-19"],
};

export const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: siteUrl,
};

export const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteName,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description: defaultDescription,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export function jsonLdScriptProps(data: object) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    },
  } as const;
}
