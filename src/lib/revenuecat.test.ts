import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPLE_PUBLIC_SDK_KEY, loadApplePackages, purchaseWasCancelled, setPurchaseUser, supportsApplePurchases, validAppleCatalog } from "./revenuecat";

const sdk = vi.hoisted(() => ({ configured: false, userId: "", configure: vi.fn(), login: vi.fn(), logout: vi.fn(), offerings: vi.fn(), check: vi.fn() }));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  LOG_LEVEL: { ERROR: "ERROR", DEBUG: "DEBUG" },
  Purchases: {
    isConfigured: sdk.check,
    setLogLevel: vi.fn(async () => {}),
    configure: async (options: { apiKey: string; appUserID: string }) => { sdk.configure(options); sdk.configured = true; sdk.userId = options.appUserID; },
    getAppUserID: async () => ({ appUserID: sdk.userId }),
    logIn: async (options: { appUserID: string }) => { sdk.login(options); sdk.userId = options.appUserID; },
    logOut: async () => { sdk.logout(); sdk.userId = "$RCAnonymousID:test"; },
    getOfferings: sdk.offerings,
  },
}));
beforeEach(() => {
  vi.clearAllMocks(); sdk.configured = false; sdk.userId = "";
  sdk.check.mockImplementation(async () => ({ isConfigured: sdk.configured }));
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true, getPlatform: () => "ios" });
});
afterEach(async () => { await setPurchaseUser(null); vi.unstubAllGlobals(); });
describe("native purchase identity", () => {
  it("requires the correct weekly, monthly and three-month store periods", () => {
    const products = [
      { identifier: "cineflow_weekly", subscriptionPeriod: "P1W", price: 4.99 },
      { identifier: "cineflow_monthly", subscriptionPeriod: "P1M", price: 14.99 },
      { identifier: "cineflow_quarterly", subscriptionPeriod: "P3M", price: 34.99 },
    ];
    expect(validAppleCatalog(products)).toBe(true);
    expect(validAppleCatalog(products.map((product) => ({ ...product, subscriptionPeriod: "P1M" })))).toBe(false);
    expect(validAppleCatalog(products.filter((product) => product.identifier !== "cineflow_quarterly"))).toBe(false);
  });
  it("configures the supplied Apple key with the stable CineFlow account id", async () => {
    await setPurchaseUser("account-a");
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: APPLE_PUBLIC_SDK_KEY, appUserID: "account-a" });
  });
  it("deliberately switches and clears store identity", async () => {
    await setPurchaseUser("account-a");
    await setPurchaseUser("account-b");
    expect(sdk.login).toHaveBeenCalledWith({ appUserID: "account-b" });
    await setPurchaseUser(null);
    expect(sdk.logout).toHaveBeenCalledTimes(1);
  });
  it("refuses stale-account actions before talking to the store", async () => {
    await setPurchaseUser("account-b");
    await expect(loadApplePackages("account-a")).rejects.toThrow("Your account changed");
    expect(sdk.offerings).not.toHaveBeenCalled();
  });
  it("does not enable Apple checkout on Android or web", () => {
    vi.stubGlobal("Capacitor", { isNativePlatform: () => true, getPlatform: () => "android" });
    expect(supportsApplePurchases()).toBe(false);
    vi.stubGlobal("Capacitor", { isNativePlatform: () => false, getPlatform: () => "web" });
    expect(supportsApplePurchases()).toBe(false);
  });
  it("treats Apple purchase cancellation as cancellation rather than failure", () => {
    expect(purchaseWasCancelled({ code: "1" })).toBe(true);
    expect(purchaseWasCancelled({ userCancelled: true })).toBe(true);
    expect(purchaseWasCancelled({ code: "2" })).toBe(false);
  });
  it("rejects a missing native purchase plugin without waiting for Apple", async () => {
    vi.stubGlobal("Capacitor", { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: () => false });
    await expect(setPurchaseUser("account-a")).rejects.toThrow("Purchases are missing");
    expect(sdk.configure).not.toHaveBeenCalled();
  });
  it("releases a stuck account initialization so Retry can reach the store", async () => {
    vi.useFakeTimers();
    try {
      sdk.check.mockImplementationOnce(() => new Promise(() => {}));
      const init = expect(setPurchaseUser("account-a")).rejects.toThrow("Checking iPhone purchases timed out");
      await vi.advanceTimersByTimeAsync(10_000);
      await init;
      sdk.offerings.mockResolvedValue({ all: {}, current: null });
      await expect(loadApplePackages("account-a")).rejects.toThrow("no offering");
      expect(sdk.offerings).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it("allows Apple price requests 30 seconds before timing out", async () => {
    await setPurchaseUser("account-a");
    vi.useFakeTimers();
    try {
      sdk.offerings.mockImplementationOnce(() => new Promise(() => {}));
      const result = expect(loadApplePackages("account-a")).rejects.toThrow("Loading Apple prices timed out");
      await vi.advanceTimersByTimeAsync(30_000);
      await result;
    } finally { vi.useRealTimers(); }
  });
});