import type { ChatCompletionMessage } from "./types";

export type ChatRequestBody = {
  baseUrl: string;
  model: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
};

export class ChatRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string } | string;
    };
    if (typeof json.error === "string") return json.error;
    if (json.error?.message) return json.error.message;
  } catch {
    /* use raw text */
  }
  return text || `Request failed (${res.status})`;
}

export async function streamCompanionReply(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatCompletionMessage[];
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      baseUrl: options.baseUrl,
      model: options.model,
      messages: options.messages,
      stream: true,
    } satisfies ChatRequestBody),
    signal: options.signal,
  });

  if (!res.ok) {
    throw new ChatRequestError(await readError(res), res.status);
  }

  if (!res.body) {
    throw new ChatRequestError("No response body from the model.", 502);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let sawSse = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!trimmed.startsWith("data:")) continue;
      sawSse = true;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; message?: { content?: string } }[];
        };
        const token =
          json.choices?.[0]?.delta?.content ??
          json.choices?.[0]?.message?.content ??
          "";
        if (token) {
          full += token;
          options.onDelta(token);
        }
      } catch {
        /* ignore keepalives / comments */
      }
    }
  }

  if (!sawSse && buffer.trim()) {
    try {
      const json = JSON.parse(buffer) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      if (content) {
        options.onDelta(content);
        return content;
      }
    } catch {
      /* fall through */
    }
  }

  return full;
}
