import { createFileRoute } from "@tanstack/react-router";
import { handleRevenueCatWebhook } from "@/lib/revenuecat-webhook.server";

export const Route = createFileRoute("/api/public/revenuecat")({
  server: { handlers: {
    POST: async ({ request }) => handleRevenueCatWebhook(request, {
      authorization: process.env["REVENUECAT_WEBHOOK_AUTH"] ?? "",
      allowSandbox: process.env["REVENUECAT_ALLOW_SANDBOX"] === "true",
    }),
  } },
});