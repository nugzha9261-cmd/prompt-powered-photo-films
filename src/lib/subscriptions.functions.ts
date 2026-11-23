import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { premiumIsActive } from "./subscriptions";
import { z } from "zod";

export const getSubscriptionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const allowSandbox = process.env["REVENUECAT_ALLOW_SANDBOX"] === "true";
    const { data, error } = await context.supabase.from("store_subscriptions")
      .select("product_id, expires_at, revoked, environment")
      .eq("user_id", context.userId)
      .order("expires_at", { ascending: false });
    if (error) throw new Error("Couldn't check your subscription. Please try again.");
    const active = data?.find((row) => (row.environment === "PRODUCTION" || allowSandbox) && premiumIsActive(row.expires_at, row.revoked));
    return {
      premium: Boolean(active), productId: active?.product_id ?? null, expiresAt: active?.expires_at ?? null,
      checkoutReady: Boolean(process.env["REVENUECAT_WEBHOOK_AUTH"]),
    };
  });

export const getPaymentDelivery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ transactionId: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("store_payments")
      .select("credits, environment").eq("user_id", context.userId).eq("transaction_id", data.transactionId);
    if (error) throw new Error("Couldn't check payment delivery.");
    const payment = rows?.find((row) => row.environment === "PRODUCTION" || process.env["REVENUECAT_ALLOW_SANDBOX"] === "true");
    return { delivered: Boolean(payment), credits: payment?.credits ?? 0 };
  });