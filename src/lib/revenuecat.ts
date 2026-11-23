import type { CustomerInfo, MakePurchaseResult, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { isNativeApp } from "./native";
import { subscriptionPlan } from "./subscriptions";
import { SUBSCRIPTION_PLANS } from "./credits";

// RevenueCat public client key, intentionally safe to ship in the iPhone app.
export const APPLE_PUBLIC_SDK_KEY = "appl_JnBUAzVTGUsqZtVZSaONpxFRote";
const STORE_PERIODS: Record<string, string> = { cineflow_weekly: "P1W", cineflow_monthly: "P1M", cineflow_quarterly: "P3M" };

export function validAppleCatalog(products: { identifier: string; subscriptionPeriod: string | null; price: number }[]) {
  return SUBSCRIPTION_PLANS.every((plan) => products.filter((product) =>
    product.identifier === plan.id && product.subscriptionPeriod === STORE_PERIODS[plan.id] && product.price > 0,
  ).length === 1);
}
let desiredUser: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

export function supportsApplePurchases() {
  if (!isNativeApp()) return false;
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() === "ios";
}

async function sdkForUser(userId: string) {
  if (!supportsApplePurchases()) throw new Error("Apple purchases are available in the iPhone app.");
  if (desiredUser !== userId) throw new Error("Your account changed. Reopen Your credits.");
  const { Purchases, LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
  const { isConfigured } = await Purchases.isConfigured();
  if (!isConfigured) {
    await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey: APPLE_PUBLIC_SDK_KEY, appUserID: userId });
  } else {
    const { appUserID } = await Purchases.getAppUserID();
    if (appUserID !== userId) await Purchases.logIn({ appUserID: userId });
  }
  if (desiredUser !== userId || (await Purchases.getAppUserID()).appUserID !== userId) {
    throw new Error("Your account changed. Reopen Your credits.");
  }
  return Purchases;
}

/** One auth provider updates this identity; no checkout may run anonymously. */
export function setPurchaseUser(userId: string | null) {
  desiredUser = userId;
  return serialized(async () => {
    if (!supportsApplePurchases()) return;
    if (userId) { if (desiredUser === userId) await sdkForUser(userId); return; }
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    if (!(await Purchases.isConfigured()).isConfigured) return;
    if (!(await Purchases.getAppUserID()).appUserID.startsWith("$RCAnonymousID:")) await Purchases.logOut();
  });
}

export function loadApplePackages(userId: string): Promise<PurchasesPackage[]> {
  return serialized(async () => {
    const sdk = await sdkForUser(userId);
    const offerings = await sdk.getOfferings();
    const offering = offerings.all["default"];
    if (!offering) throw new Error("Subscriptions couldn't load. Please try again later.");
    const packages = offering.availablePackages.filter((pack) => subscriptionPlan(pack.product.identifier));
    if (packages.length !== 3 || !validAppleCatalog(packages.map((pack) => pack.product))) {
      throw new Error("Subscriptions couldn't load. Please try again later.");
    }
    return packages;
  });
}

export function purchaseApplePackage(userId: string, pack: PurchasesPackage): Promise<MakePurchaseResult> {
  return serialized(async () => {
    if (!subscriptionPlan(pack.product.identifier)) throw new Error("This subscription is unavailable.");
    const sdk = await sdkForUser(userId);
    return sdk.purchasePackage({ aPackage: pack });
  });
}

export function restoreApplePurchases(userId: string): Promise<CustomerInfo> {
  return serialized(async () => (await (await sdkForUser(userId)).restorePurchases()).customerInfo);
}

export function manageAppleSubscription(userId: string) {
  return serialized(async () => {
    const { customerInfo } = await (await sdkForUser(userId)).getCustomerInfo();
    const url = customerInfo.managementURL;
    const parsed = url ? new URL(url) : null;
    window.location.assign(parsed?.protocol === "https:" && parsed.hostname === "apps.apple.com"
      ? parsed.href : "https://apps.apple.com/account/subscriptions");
  });
}

export function purchaseWasCancelled(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return ("userCancelled" in error && error.userCancelled === true) || ("code" in error && String(error.code) === "1");
}