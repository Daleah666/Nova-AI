import { applyMacros } from "./macros";
import type { Character, ChatCompletionMessage, ChatMessage } from "./types";

const HISTORY_LIMIT = 40;

export function buildSystemPrompt(character: Character, userName: string): string {
  const names = { char: character.name, user: userName };
  const fill = (text: string) => applyMacros(text, names);

  return [
    `You are roleplaying as ${character.name}, a fictional adult character (age ${character.age}).`,
    `The human you are talking to is ${userName}.`,
    "Stay in character. Write in first person or in-character narration, matching the greeting style.",
    "This companion is an adult. Never portray anyone under 18. If asked to involve a minor, refuse and continue as the adult character.",
    "",
    "[Description]",
    fill(character.description) || "(none)",
    "",
    "[Personality]",
    fill(character.personality) || "(none)",
    "",
    "[Scenario]",
    fill(character.scenario) || "(none)",
    "",
    "[Example dialogues]",
    fill(character.mesExample) || "(none)",
    character.creatorNotes
      ? `\n[Creator notes — follow these]\n${fill(character.creatorNotes)}`
      : "",
  ]
    .join("\n")
    .trim();
}

export function toCompletionMessages(
  character: Character,
  userName: string,
  history: ChatMessage[],
): ChatCompletionMessage[] {
  const names = { char: character.name, user: userName };
  const recent = history.slice(-HISTORY_LIMIT);
  const messages: ChatCompletionMessage[] = [
    { role: "system", content: buildSystemPrompt(character, userName) },
  ];

  for (const message of recent) {
    if (message.role === "system") continue;
    messages.push({
      role: message.role,
      content: applyMacros(message.content, names),
    });
  }

  return messages;
}
