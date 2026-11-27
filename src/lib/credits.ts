/** Credit rules shared by the server (charging) and the app (labels, paywall). */
export const FREE_SIGNUP_CREDITS = 2;
/** Two credits buy a 5-second generation; editing is charged per section. */
export const CREDITS_PER_VIDEO = 2;
export const CREDITS_PER_EDIT = 1;

export const OUT_OF_CREDITS = "OUT_OF_CREDITS";

export type SubscriptionPlan = {
  id: string;
  label: string;
  price: string;
  period: string;
  /** Credits granted each billing period. */
  credits: number;
  badge?: string;
};
/** Store subscription product ids (RevenueCat / App Store / Google Play). */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "cineflow_weekly", label: "Weekly", price: "$4.99", period: "week", credits: 12 },
  { id: "cineflow_monthly", label: "Monthly", price: "$14.99", period: "month", credits: 50, badge: "Most popular" },
  { id: "cineflow_quarterly", label: "3 Months", price: "$34.99", period: "3 months", credits: 180, badge: "Best value" },
];

export function canAfford(balance: number | null | undefined, cost: number) {
  return (balance ?? 0) >= cost;
}

/** Server and UI must use the same duration-based charge. */
export function videoCreditCost(seconds: 5 | 10) {
  return seconds === 10 ? 4 : 2;
}
