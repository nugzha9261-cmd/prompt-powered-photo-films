/** Credit rules shared by the server (charging) and the app (labels, paywall). */
export const FREE_SIGNUP_CREDITS = 2;
/** One credit buys one generated video or one edited section. */
export const CREDITS_PER_VIDEO = 1;
export const CREDITS_PER_EDIT = 1;

export const OUT_OF_CREDITS = "OUT_OF_CREDITS";

export type CreditPack = { id: string; credits: number; label: string; price: string };
/** Store product ids (RevenueCat / App Store / Google Play). Prices shown are placeholders until store products exist. */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "lumiere_credits_10", credits: 10, label: "Starter", price: "$9.99" },
  { id: "lumiere_credits_30", credits: 30, label: "Creator", price: "$24.99" },
  { id: "lumiere_credits_70", credits: 70, label: "Director", price: "$49.99" },
];

export function canAfford(balance: number | null | undefined, cost: number) {
  return (balance ?? 0) >= cost;
}
