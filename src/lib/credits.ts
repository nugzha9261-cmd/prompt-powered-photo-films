/** Credit rules shared by the server (charging) and the app (labels, paywall). */
export const FREE_SIGNUP_CREDITS = 2;
/** One credit buys one generated video or one edited section. */
export const CREDITS_PER_VIDEO = 1;
export const CREDITS_PER_EDIT = 1;

export const OUT_OF_CREDITS = "OUT_OF_CREDITS";

export type SubscriptionPlan = {
  id: string;
  label: string;
  price: string;
  period: string;
  /** Videos granted each billing period. */
  credits: number;
  badge?: string;
};
/** Store subscription product ids (RevenueCat / App Store / Google Play). */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "lumiere_weekly", label: "Weekly", price: "$4.99", period: "week", credits: 12 },
  { id: "lumiere_monthly", label: "Monthly", price: "$14.99", period: "month", credits: 50, badge: "Most popular" },
  { id: "lumiere_quarterly", label: "3 Months", price: "$34.99", period: "3 months", credits: 180, badge: "Best value" },
];

export function canAfford(balance: number | null | undefined, cost: number) {
  return (balance ?? 0) >= cost;
}

/** Free credits claimable once per day (does not stack across missed days). */
export const DAILY_FREE_CREDITS = 1;
export const DAILY_CLAIM_HOURS = 24;

/** Milliseconds until the daily credit can be claimed again (0 = available now). */
export function dailyClaimWait(lastClaim: string | null | undefined, now = Date.now()) {
  if (!lastClaim) return 0;
  return Math.max(0, new Date(lastClaim).getTime() + DAILY_CLAIM_HOURS * 3600_000 - now);
}
