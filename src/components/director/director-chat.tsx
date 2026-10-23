import { useChat } from "@ai-sdk/react";
import { useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Check, Clapperboard, Copy, Film, Scissors } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import directorMark from "@/assets/director-mark.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DIRECTOR_MAX_MESSAGE_CHARS, promptForBox, splitPromptBlock, type PromptBlock } from "@/lib/director";
import { saveMessages } from "@/lib/director-threads";

const STARTERS = [
  "Bring an old photo of my grandparents to life",
  "Turn 3 holiday photos into a travel montage",
  "Make my product photo look like a TV ad",
  "Change the sky in my clip to a sunset",
];

export function DirectorChat({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/director",
        body: { threadId },
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "The AI Director couldn't answer. Check your connection and try again."),
  });

  const busy = status === "submitted" || status === "streaming";

  // Keep this chat on the device; skip mid-stream writes.
  useEffect(() => {
    if (status !== "streaming") saveMessages(threadId, messages);
  }, [messages, status, threadId]);

  useEffect(() => {
    if (!busy) textarea.current?.focus();
  }, [busy]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (trimmed.length > DIRECTOR_MAX_MESSAGE_CHARS) {
      toast.error(`Keep your message under ${DIRECTOR_MAX_MESSAGE_CHARS} characters.`);
      return;
    }
    void sendMessage({ text: trimmed });
  };

  const lastId = messages.at(-1)?.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0">
        <ConversationContent className="gap-6 px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center">
              <img src={directorMark} alt="" width={96} height={96} className="size-24" />
              <h2 className="mt-3 font-display text-4xl">Your AI Director</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Say what you want in your own words. I&apos;ll ask a couple of questions and write a
                ready-to-use prompt for the studio.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const streamingThis = status === "streaming" && m.id === lastId;
              return (
                <Message from={m.role} key={m.id}>
                  <MessageContent className="text-[0.95rem] leading-relaxed group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                    {m.parts.map((part, i) => {
                      if (part.type === "reasoning") {
                        if (!part.text.trim()) return null;
                        return (
                          <Reasoning
                            key={i}
                            isStreaming={streamingThis && i === m.parts.length - 1}
                            className="mb-1 text-muted-foreground"
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      }
                      if (part.type !== "text") return null;
                      if (m.role === "user") {
                        return (
                          <p key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </p>
                        );
                      }
                      return <AssistantText key={i} text={part.text} />;
                    })}
                  </MessageContent>
                </Message>
              );
            })
          )}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm">
              <img src={directorMark} alt="" width={20} height={20} className="size-5" />
              <Shimmer>Thinking about your shot…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3 sm:p-4">
        <PromptInput
          onSubmit={(msg) => send(msg.text)}
          className="bg-background/60"
        >
          <PromptInputTextarea
            ref={textarea}
            autoFocus
            maxLength={DIRECTOR_MAX_MESSAGE_CHARS}
            placeholder="Describe your photo and the video you imagine…"
            className="text-base"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={() => void stop()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function AssistantText({ text }: { text: string }) {
  const { before, block, after } = splitPromptBlock(text);
  return (
    <>
      {before.trim() && <MessageResponse>{before}</MessageResponse>}
      {block && <PromptCard block={block} />}
      {after.trim() && <MessageResponse>{after}</MessageResponse>}
    </>
  );
}

function PromptCard({ block }: { block: PromptBlock }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const prompt = promptForBox(block.prompt);

  const use = (target: "studio" | "edit") => {
    if (target === "studio") void navigate({ to: "/studio", search: { prompt } });
    else void navigate({ to: "/edit", search: { prompt } });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the text and copy it instead.");
    }
  };

  const other = block.target === "studio" ? "edit" : "studio";

  return (
    <div className="my-1 rounded-md border border-primary/50 bg-film p-4">
      <p className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.2em] text-primary">
        <Clapperboard className="size-3.5" /> Your prompt
      </p>
      <p className="mt-2 whitespace-pre-wrap font-display text-xl leading-snug text-foreground">
        {prompt || "…"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" disabled={!block.complete} onClick={() => use(block.target)}>
          {block.target === "studio" ? <Film /> : <Scissors />}
          {block.target === "studio" ? "Use in Studio" : "Use for video edit"}
        </Button>
        <Button size="sm" variant="outline" disabled={!block.complete} onClick={() => use(other)}>
          {other === "studio" ? "Use in Studio instead" : "Use for video edit instead"}
        </Button>
        <Button size="sm" variant="ghost" disabled={!block.complete} onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
