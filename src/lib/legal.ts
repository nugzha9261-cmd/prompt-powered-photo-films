// Set only to the owner's confirmed public support address.
export const SUPPORT_EMAIL: string | null = "studio@nexonelabs.com";
export const LEGAL_UPDATED = "November 22, 2026";

export function legalHead(title: string, description: string) {
  return { meta: [
    { title: `${title} — CineFlow AI` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — CineFlow AI` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] };
}