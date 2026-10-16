import type { AppSettings } from "./types";

const STORAGE_KEY = "character-companion.settings.v1";

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  userName: "You",
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      apiBaseUrl: parsed.apiBaseUrl?.trim() || DEFAULT_SETTINGS.apiBaseUrl,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: parsed.model?.trim() || DEFAULT_SETTINGS.model,
      userName: parsed.userName?.trim() || DEFAULT_SETTINGS.userName,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function hasApiKey(settings: AppSettings): boolean {
  return settings.apiKey.trim().length > 0;
}
