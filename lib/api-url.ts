const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.internal",
]);

export function resolveChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("API base URL is required.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("API base URL is not valid.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("API base URL must be http or https.");
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error("That API host is not allowed.");
  }

  if (url.pathname.endsWith("/chat/completions")) {
    return url.toString();
  }
  return `${trimmed}/chat/completions`;
}
