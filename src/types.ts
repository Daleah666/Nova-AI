export type AudioMode = "silent" | "binaural";
export type VisualSource = "built-in" | "local" | "drive";
export type VoiceEngine = "cartesia" | "speech-synthesis" | "carrier-only" | "none";

export type ScriptTemplateId =
  | "girly-default"
  | "soft-bimbo"
  | "body-femme"
  | "calm-drop"
  | "blank";

export interface ScriptTemplate {
  id: ScriptTemplateId;
  name: string;
  blurb: string;
  optional: boolean;
  lines: string[];
}

export interface VisualItem {
  id: string;
  name: string;
  src: string;
  source: VisualSource;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  mediaPath?: string;
}

export interface ServerConfig {
  googleClientId: string;
  hasGoogleApiKey: boolean;
  hasCartesia: boolean;
}

export interface SessionSettings {
  audioMode: AudioMode;
  includeVoice: boolean;
  flashHz: number;
  carrierHz: number;
  beatHz: number;
  silentVoiceGain: number;
  voicedGain: number;
  carrierGain: number;
}
