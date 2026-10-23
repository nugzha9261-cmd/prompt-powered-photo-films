import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { APICallError, convertToModelMessages, streamText, validateUIMessages, type UIMessage } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./ai/run-id";
import { DIRECTOR_HISTORY_LIMIT, DIRECTOR_INSTRUCTIONS, DIRECTOR_MAX_MESSAGE_CHARS } from "./director";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const bodySchema = z.object({
  threadId: z.string().min(1).max(100),
  messages: z.array(z.unknown()).min(1).max(500),
});

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** Signed-in users only: the assistant spends workspace AI credits. */
async function verifyUser(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.split(".").length !== 3) return null;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const supabase = createClient(url, key, {
    global: {
      // Publishable keys are opaque, not JWTs: send them as apikey only.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

function friendlyError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    let message: string | undefined;
    try {
      message = (JSON.parse(error.responseBody ?? "{}") as { message?: string }).message;
    } catch {
      message = undefined;
    }
    console.error("AI Director gateway error", error.statusCode, error.responseBody);
    if (error.statusCode === 402) return "The AI Director is out of AI credits right now. Please try again later.";
    if (error.statusCode === 429) return "The AI Director is busy. Wait a moment and send your message again.";
    if (error.statusCode === 403) return message ?? "The AI Director isn't available right now.";
    return message ?? "The AI Director couldn't answer. Please try again.";
  }
  console.error("AI Director error", error);
  return "The AI Director couldn't answer. Please try again.";
}

export async function handleDirectorChat(request: Request): Promise<Response> {
  const userId = await verifyUser(request);
  if (!userId) return text("Please sign in again to chat with the AI Director.", 401);

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return text("The AI Director is not configured.", 500);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return text("That message couldn't be read.", 400);

  let messages: UIMessage[];
  try {
    messages = await validateUIMessages({ messages: parsed.data.messages });
  } catch {
    return text("That conversation couldn't be read. Start a new chat.", 400);
  }
  const last = messages.at(-1);
  const lastText = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
  if (last?.role !== "user" || !lastText.trim()) return text("Type a message first.", 400);
  if (lastText.length > DIRECTOR_MAX_MESSAGE_CHARS) {
    return text(`Keep your message under ${DIRECTOR_MAX_MESSAGE_CHARS} characters.`, 400);
  }

  const recent = messages.slice(-DIRECTOR_HISTORY_LIMIT);
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: DIRECTOR_INSTRUCTIONS,
    messages: await convertToModelMessages(recent),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      onError: friendlyError,
    }),
    runIdFetch,
  );
}
