import type { ScriptTemplate } from "../types";

function lines(...rows: string[]): string[] {
  return rows.map((row) => row.trim()).filter(Boolean);
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "girly-default",
    name: "Girly default",
    blurb: "Stay as feminine as possible — the app’s default goal. Fully editable.",
    optional: false,
    lines: lines(
      "I stay soft and girly in every moment",
      "My voice is sweet, high, and pretty",
      "I choose the feminine option every time",
      "Pink, gloss, and pretty things feel like me",
      "My body language stays dainty and open",
      "I love feeling pretty in my own skin",
      "Girly thoughts come easily and stay",
      "I keep my mind on beauty, softness, and play",
      "I feel feminine from my breath to my fingertips",
      "I let myself be cute without apology",
      "My default is girl, always girl",
      "I return to this girly feeling with ease",
    ),
  },
  {
    id: "soft-bimbo",
    name: "Soft bimbofication",
    blurb: "Optional adult template. Empty-headed, pretty, self-directed. Edit or skip.",
    optional: true,
    lines: lines(
      "I love being a pretty airhead on purpose",
      "Thinking less makes me feel cute and light",
      "I crave gloss, pink, and easy pleasure",
      "My head stays floaty while my body stays girly",
      "I giggle, I pose, I stay deliciously simple",
      "Pretty is my favorite kind of smart",
      "I drop into doll-soft focus for this session",
      "I choose bimbo fun for me, only me",
      "Empty and sparkly feels so good right now",
      "I obey this script because I picked it",
      "I am a cute, horny, happy girl in training",
      "I keep this mood until I tap stop",
    ),
  },
  {
    id: "body-femme",
    name: "Body & femme",
    blurb: "Soft body-feeling and presentation. No medical claims.",
    optional: true,
    lines: lines(
      "My posture melts into something pretty",
      "I feel curves, softness, and a girly sway",
      "My hands stay graceful when they move",
      "I enjoy how feminine my body can feel",
      "Clothes, scent, and skin all read as girl",
      "I inhabit a cute, plush, feminine shape",
      "Every breath rounds me into something softer",
      "I like the way girly movement lives in me",
      "My reflection matches the girl I keep choosing",
      "I hold this femme body-feeling with care",
    ),
  },
  {
    id: "calm-drop",
    name: "Calm drop",
    blurb: "Trance-adjacent settling. You start it; you stop it.",
    optional: true,
    lines: lines(
      "I drop into this session because I started it",
      "My breathing slows and my shoulders ease",
      "I follow the rhythm I chose on purpose",
      "Soft focus feels safe while I am here",
      "I can stop whenever I want to stop",
      "Each cycle takes me a little deeper in",
      "I stay present enough to tap the big stop",
      "Calm and girly can live in the same breath",
      "I let the carrier hold me while I float",
      "I return to the room the moment I stop",
    ),
  },
  {
    id: "blank",
    name: "Blank",
    blurb: "Empty editor. Write your own lines, one idea each.",
    optional: false,
    lines: [],
  },
];

export const DEFAULT_TEMPLATE_ID = "girly-default" as const;

export function templateById(id: string): ScriptTemplate {
  return SCRIPT_TEMPLATES.find((t) => t.id === id) ?? SCRIPT_TEMPLATES[0];
}

export function scriptToText(lines: string[]): string {
  return [
    "# Subliminal Deployer script",
    "# Adult, self-use only. One idea per line. Edit freely.",
    "",
    ...lines,
    "",
  ].join("\n");
}

export function textToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0 && !row.startsWith("#"));
}

export function linesToSpeech(lines: string[]): string {
  const spoken = lines.filter(Boolean);
  if (!spoken.length) return "";
  return spoken.map((line) => (line.endsWith(".") ? line : `${line}.`)).join(" ");
}
