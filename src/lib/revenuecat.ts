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
function withTimeout<T>(task: Promise<T>, ms: number, stage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${stage} timed out. Check your connection and tap Retry.`)), ms);
    task.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}
const SETUP_WAIT = 10_000;
const STORE_WAIT = 30_000;
function nativeStep<T>(task: Promise<T>, stage: string) {
  return withTimeout(task, SETUP_WAIT, stage);
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
  const cap = (window as { Capacitor?: { isPluginAvailable?: (name: string) => boolean } }).Capacitor;
  if (cap?.isPluginAvailable && !cap.isPluginAvailable("Purchases")) {
    throw new Error("Purchases are missing from this iPhone app version. Update CineFlow in TestFlight.");
  }
  const { Purchases, LOG_LEVEL } = await nativeStep(import("@revenuecat/purchases-capacitor"), "Loading purchases");
  const { isConfigured } = await nativeStep(Purchases.isConfigured(), "Checking iPhone purchases");
  if (!isConfigured) {
    await nativeStep(Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }), "Preparing purchases");
    await nativeStep(Purchases.configure({ apiKey: APPLE_PUBLIC_SDK_KEY, appUserID: userId }), "Connecting RevenueCat");
  } else {
    const { appUserID } = await nativeStep(Purchases.getAppUserID(), "Checking purchase account");
    if (appUserID !== userId) await nativeStep(Purchases.logIn({ appUserID: userId }), "Connecting purchase account");
  }
  if (desiredUser !== userId || (await nativeStep(Purchases.getAppUserID(), "Verifying purchase account")).appUserID !== userId) {
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
    const { Purchases } = await nativeStep(import("@revenuecat/purchases-capacitor"), "Loading purchases");
    if (!(await nativeStep(Purchases.isConfigured(), "Checking iPhone purchases")).isConfigured) return;
    if (!(await nativeStep(Purchases.getAppUserID(), "Checking purchase account")).appUserID.startsWith("$RCAnonymousID:")) {
      await nativeStep(Purchases.logOut(), "Disconnecting purchase account");
    }
  });
}

export function loadApplePackages(userId: string): Promise<PurchasesPackage[]> {
  return serialized(async () => {
    const sdk = await sdkForUser(userId);
    const offerings = await withTimeout(sdk.getOfferings(), STORE_WAIT, "Loading Apple prices");
    if (desiredUser !== userId) throw new Error("Your account changed. Reopen Your credits.");
    const offering = offerings.all["default"] ?? offerings.current;
    if (!offering) throw new Error("RevenueCat returned no offering. Please contact Support.");
    const packages = offering.availablePackages.filter((pack) => subscriptionPlan(pack.product.identifier));
    if (packages.length !== 3 || !validAppleCatalog(packages.map((pack) => pack.product))) {
      throw new Error("Apple returned an incomplete subscription catalog. Please contact Support.");
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