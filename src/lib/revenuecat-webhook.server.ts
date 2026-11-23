import { timingSafeEqual } from "node:crypto";
import { revenueCatEventSchema, subscriptionEvent } from "./subscriptions";

export function validWebhookAuthorization(actual: string | null, expected: string) {
  if (!actual || !expected) return false;
  const a = new TextEncoder().encode(actual);
  const b = new TextEncoder().encode(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handleRevenueCatWebhook(request: Request, config: { authorization: string; allowSandbox: boolean }) {
  // An unconfigured endpoint has no valid caller; reject it as unauthorized,
  // rather than reporting a server outage for unauthenticated probes.
  if (!validWebhookAuthorization(request.headers.get("authorization"), config.authorization)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 65_536) return new Response("Request too large", { status: 413 });
  const body = await request.text();
  if (body.length > 65_536) return new Response("Request too large", { status: 413 });
  let input: unknown;
  try { input = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const parsed = revenueCatEventSchema.safeParse(input);
  if (!parsed.success) return new Response("Invalid event", { status: 400 });
  if (parsed.data.event.type === "TEST") return Response.json({ received: true });
  const event = subscriptionEvent(parsed.data.event, config.allowSandbox);
  if (!event) return Response.json({ received: true, ignored: true });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: identity, error: identityError } = await supabaseAdmin.auth.admin.getUserById(event.userId);
  if (identityError || !identity.user) {
    if (identityError?.status === 404 || !identityError) return Response.json({ received: true, ignored: true });
    return new Response("Account verification unavailable", { status: 503 });
  }
  const { error } = await supabaseAdmin.rpc("apply_store_event", {
    _event_id: event.eventId, _user_id: event.userId, _environment: event.environment,
    _transaction_id: event.transactionId, _original_transaction_id: event.originalTransactionId,
    _product_id: event.productId, _event_ms: event.eventAt,
    _expires_at: new Date(event.expiresAt).toISOString(), _revoked: event.revoked, _paid: event.credits > 0,
  });
  if (error) {
    console.error("Subscription delivery failed", error.code);
    return new Response("Payment delivery unavailable", { status: 503 });
  }
  return Response.json({ received: true });
}