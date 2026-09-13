const SCRIPT_KEY = "asd.script.v1";
const SETTINGS_KEY = "asd.settings.v1";
const FOLDER_KEY = "asd.driveFolder.v1";

export function loadScriptText(): string | null {
  try {
    return localStorage.getItem(SCRIPT_KEY);
  } catch {
    return null;
  }
}

export function saveScriptText(text: string): void {
  localStorage.setItem(SCRIPT_KEY, text);
}

export function loadFolderId(): string {
  try {
    return localStorage.getItem(FOLDER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveFolderId(id: string): void {
  localStorage.setItem(FOLDER_KEY, id);
}

export function loadSettingsJson(): string | null {
  try {
    return localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
}

export function saveSettingsJson(json: string): void {
  localStorage.setItem(SETTINGS_KEY, json);
}
