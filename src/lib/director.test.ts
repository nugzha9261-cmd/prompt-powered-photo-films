import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it } from "vitest";

import { promptForBox, splitPromptBlock } from "./director";
import {
  getThread,
  latestOrNewThread,
  listThreads,
  resetThreadCache,
  saveMessages,
  startThread,
  titleFor,
} from "./director-threads";
import { MAX_PROMPT_LENGTH } from "./video-request";

const userMsg = (text: string): UIMessage => ({ id: `u-${text}`, role: "user", parts: [{ type: "text", text }] });

describe("prompt block in assistant replies", () => {
  it("pulls out a finished studio prompt and the text around it", () => {
    const r = splitPromptBlock("Pick One photo.\n```prompt studio\nWaves roll in at dusk.\n```\nWant it slower?");
    expect(r.before).toBe("Pick One photo.\n");
    expect(r.block).toEqual({ prompt: "Waves roll in at dusk.", target: "studio", complete: true });
    expect(r.after.trim()).toBe("Want it slower?");
  });

  it("marks an edit prompt for the edit page", () => {
    expect(splitPromptBlock("```prompt edit\nMake the sky a sunset.\n```").block?.target).toBe("edit");
  });

  it("shows a half-streamed prompt as not ready yet", () => {
    const r = splitPromptBlock("Here you go:\n```prompt studio\nThe camera slowly");
    expect(r.block).toEqual({ prompt: "The camera slowly", target: "studio", complete: false });
  });

  it("leaves ordinary replies alone", () => {
    expect(splitPromptBlock("What is in your photo?").block).toBeNull();
  });

  it("never hands the prompt box more than its limit", () => {
    expect(promptForBox("a ".repeat(2000)).length).toBe(MAX_PROMPT_LENGTH);
  });
});

describe("chats kept on this device", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetThreadCache();
  });

  it("New chat reuses an untouched chat instead of piling up blanks", () => {
    const a = startThread();
    const b = startThread();
    expect(b.id).toBe(a.id);
    expect(listThreads()).toHaveLength(1);
  });

  it("opening the assistant goes to the latest chat", () => {
    const first = startThread();
    saveMessages(first.id, [userMsg("first idea")]);
    const second = startThread();
    saveMessages(second.id, [userMsg("second idea")]);
    expect(latestOrNewThread().id).toBe(second.id);
  });

  it("saved messages come back after a reload", () => {
    const t = startThread();
    saveMessages(t.id, [userMsg("sunset over my dog")]);
    resetThreadCache();
    expect(getThread(t.id)?.messages[0]?.parts[0]).toEqual({ type: "text", text: "sunset over my dog" });
    expect(getThread(t.id)?.title).toBe("sunset over my dog");
  });

  it("titles long first messages short", () => {
    expect(titleFor([userMsg("x".repeat(80))]).length).toBe(48);
  });
});
