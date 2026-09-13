import type { DriveFileMeta, ServerConfig } from "../types";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

export async function fetchServerConfig(): Promise<ServerConfig> {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("config");
    return (await res.json()) as ServerConfig;
  } catch {
    return {
      googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
      hasGoogleApiKey: false,
      hasCartesia: false,
    };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

export async function requestDriveToken(clientId: string): Promise<string> {
  await loadScript(GIS_SRC);
  const gis = window.google?.accounts.oauth2;
  if (!gis) throw new Error("Google Identity Services did not load.");

  return new Promise((resolve, reject) => {
    const client = gis.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "Google sign-in was cancelled."));
          return;
        }
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export async function listDriveImagesWithToken(
  folderId: string,
  accessToken: string,
): Promise<DriveFileMeta[]> {
  const q = `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false and mimeType contains 'image/'`;
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name,mimeType)");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive list failed (${res.status}). Check the folder ID and access.`);
  }
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files ?? [];
}

export async function fetchDriveBlob(fileId: string, accessToken: string): Promise<Blob> {
  const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Could not download Drive file ${fileId}.`);
  return res.blob();
}

export async function listDriveImagesWithApiKey(folderId: string): Promise<DriveFileMeta[]> {
  const res = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}`);
  const data = (await res.json()) as { ok?: boolean; error?: string; files?: DriveFileMeta[] };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Drive API key listing failed.");
  }
  return data.files ?? [];
}

export function extractFolderId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  const fromOpen = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromOpen) return fromOpen[1];
  return trimmed;
}
