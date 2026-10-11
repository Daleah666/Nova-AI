export async function fetchCartesiaWav(transcript: string): Promise<ArrayBuffer> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (res.status === 501) {
    throw new Error("Cartesia is not configured. Using the browser voice instead.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const data = (await res.json()) as { error?: string };
      detail = data.error ?? "";
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `TTS request failed (${res.status}).`);
  }
  return res.arrayBuffer();
}

export async function decodeWav(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(data.slice(0));
  } finally {
    void ctx.close();
  }
}
