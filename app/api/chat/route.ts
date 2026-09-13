import { NextRequest } from "next/server";
import { resolveChatCompletionsUrl } from "@/lib/api-url";
import type { ChatCompletionMessage } from "@/lib/types";

export const runtime = "nodejs";

const MAX_MESSAGES = 48;

type Body = {
  baseUrl?: string;
  model?: string;
  messages?: ChatCompletionMessage[];
  stream?: boolean;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ") || auth.slice(7).trim() === "") {
    return jsonError("Missing API key. Add it in Settings.", 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const model = body.model?.trim();
  if (!model) return jsonError("Model name is required.", 400);

  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (messages.length === 0) return jsonError("Messages are required.", 400);

  for (const message of messages) {
    if (
      !message ||
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string"
    ) {
      return jsonError("Each message needs a role and text content.", 400);
    }
  }

  let url: string;
  try {
    url = resolveChatCompletionsUrl(body.baseUrl ?? "");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid API URL.", 400);
  }

  const stream = body.stream !== false;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
      }),
    });
  } catch {
    return jsonError(
      "Could not reach that API URL. Check the base URL (and that the provider is running).",
      502,
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text || `Upstream error ${upstream.status}`, {
      status: upstream.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (stream && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  const data = await upstream.text();
  return new Response(data, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
