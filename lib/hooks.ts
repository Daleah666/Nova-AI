"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";
import type { AppSettings } from "./types";

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettingsState(loadSettings());
    setReady(true);
  }, []);

  function setSettings(next: AppSettings) {
    setSettingsState(next);
    saveSettings(next);
  }

  return { settings, setSettings, ready };
}
