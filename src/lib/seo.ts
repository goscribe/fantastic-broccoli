export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://scribe.study";

export const siteName = "Scribe";

export const defaultTitle =
  "Scribe — Turn PDFs & Notes into Flashcards, Quizzes & Study Guides";

export const defaultDescription =
  "Upload your notes, slides, or PDFs and Scribe turns them into flashcards, quizzes, worksheets, and readings — one complete study session built from your own course material. Free during early access.";

export const keywords = [
  "PDF to flashcards",
  "notes to flashcards",
  "PDF to quiz",
  "AI flashcard generator",
  "AI study guide generator",
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
