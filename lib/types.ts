export type Character = {
  id: string;
  name: string;
  age: number;
  avatarDataUrl: string | null;
  tags: string[];
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  mesExample: string;
  creatorNotes: string;
  createdAt: number;
  updatedAt: number;
};

export type CharacterDraft = Omit<
  Character,
  "id" | "createdAt" | "updatedAt"
>;

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export type ChatThread = {
  characterId: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type AppSettings = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  userName: string;
};

export type SafetyResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
