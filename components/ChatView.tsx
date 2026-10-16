"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { streamCompanionReply } from "@/lib/chat-client";
import {
  clearChat,
  createGreetingMessages,
  getCharacter,
  getChat,
  newId,
  saveChat,
} from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { applyMacros } from "@/lib/macros";
import { toCompletionMessages } from "@/lib/prompt";
import { hasApiKey } from "@/lib/settings";
import type { Character, ChatMessage } from "@/lib/types";
import { Avatar } from "./Avatar";

export function ChatView({ characterId }: { characterId: string }) {
  const { settings, ready } = useSettings();
  const [character, setCharacter] = useState<Character | null | undefined>(
    undefined,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await getCharacter(characterId);
      if (cancelled) return;
      setCharacter(found);
      if (!found) return;
      const thread = await getChat(characterId);
      if (cancelled) return;
      if (thread.messages.length === 0 && found.firstMes.trim()) {
        const seeded = createGreetingMessages(found.firstMes);
        await saveChat({
          characterId,
          messages: seeded,
          updatedAt: Date.now(),
        });
        setMessages(seeded);
      } else {
        setMessages(thread.messages);
      }
    })().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Could not open chat.");
        setCharacter(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function persist(next: ChatMessage[]) {
    setMessages(next);
    await saveChat({
      characterId,
      messages: next,
      updatedAt: Date.now(),
    });
  }

  async function onReset() {
    if (!character) return;
    if (!window.confirm("Clear this chat and start from the greeting?")) return;
    await clearChat(characterId);
    const seeded = createGreetingMessages(character.firstMes);
    await persist(seeded);
    setError("");
  }

  async function onSend(event?: React.FormEvent) {
    event?.preventDefault();
    if (!character || sending) return;
    const text = input.trim();
    if (!text) return;
    if (!hasApiKey(settings)) {
      setError("Add an API key in Settings before chatting.");
      return;
    }

    setError("");
    setInput("");
    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    const pending: ChatMessage = {
      id: newId(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    const history = [...messages, userMessage];
    setMessages([...history, pending]);
    setSending(true);

    try {
      const payload = toCompletionMessages(character, settings.userName, history);
      const reply = await streamCompanionReply({
        apiKey: settings.apiKey,
        baseUrl: settings.apiBaseUrl,
        model: settings.model,
        messages: payload,
        onDelta: (chunk) => {
          pending.content += chunk;
          setMessages([...history, { ...pending, content: pending.content }]);
        },
      });
      pending.content = reply || pending.content;
      if (!pending.content.trim()) {
        pending.content = "…";
      }
      await persist([...history, pending]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The model request failed.");
      await persist(history);
    } finally {
      setSending(false);
    }
  }

  if (character === undefined || !ready) {
    return <p className="text-fog">Opening chat…</p>;
  }
  if (!character) {
    return (
      <p className="text-fog">
        Character not found. <Link href="/">Back to library</Link>
      </p>
    );
  }

  const names = { char: character.name, user: settings.userName };

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={character.name} src={character.avatarDataUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-2xl">{character.name}</h1>
          <p className="text-xs text-fog">
            {settings.model || "no model"} · {character.age}
          </p>
        </div>
        <Link href={`/characters/${character.id}`} className="text-sm text-fog hover:text-ink">
          Profile
        </Link>
        <button type="button" onClick={onReset} className="text-sm text-fog hover:text-ink">
          Reset chat
        </button>
      </div>

      {!hasApiKey(settings) && (
        <p className="rounded-xl border border-brass/40 bg-panel px-4 py-3 text-sm">
          Chat needs an OpenAI-compatible key.{" "}
          <Link href="/settings" className="text-sky underline">
            Open Settings
          </Link>
        </p>
      )}

      {error && (
        <pre className="whitespace-pre-wrap rounded-xl border border-rose/40 bg-panel px-4 py-3 text-sm text-rose">
          {error}
        </pre>
      )}

      <div className="grid min-h-[50vh] gap-4 rounded-2xl border border-line bg-panel p-4">
        {messages.map((message) => {
          const mine = message.role === "user";
          return (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                mine
                  ? "ml-auto bg-sky/15 text-ink"
                  : "bg-paper font-display text-[15px] text-ink/95"
              }`}
            >
              <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-fog">
                {mine ? settings.userName : character.name}
              </p>
              {applyMacros(message.content, names) || (sending && !mine ? "…" : "")}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSend} className="flex gap-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void onSend();
            }
          }}
          rows={2}
          placeholder={`Message ${character.name}…`}
          className="min-h-[3rem] flex-1 resize-y rounded-2xl border border-line bg-panel px-4 py-3 outline-none focus:border-sky"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="self-end rounded-full bg-sky px-4 py-2 font-medium text-paper disabled:opacity-50"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
