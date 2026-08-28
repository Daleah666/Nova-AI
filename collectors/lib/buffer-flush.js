/**
 * Merges twin collector signals into Nova-AI log files.
 * Paths are relative to repo root (parent of collectors/).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const PATHS = {
  buffer: path.join(REPO_ROOT, "logs/collection-buffer.md"),
  userModel: path.join(REPO_ROOT, "logs/user-model.md"),
  behaviorLog: path.join(REPO_ROOT, "logs/behavior-log.md"),
  signalsArchive: path.join(REPO_ROOT, "logs/twin-signals.jsonl"),
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function appendSignalArchive(signal) {
  ensureDir(PATHS.signalsArchive);
  fs.appendFileSync(PATHS.signalsArchive, JSON.stringify(signal) + "\n", "utf8");
}

export function appendPendingSignal(signal) {
  const line = `- [${today()}] ${signal.category} | ${signal.signal} | ${signal.source || "local-collector"} | ${signal.confidence || "medium"}${signal.puppetVector ? ` | puppet:${signal.puppetVector}` : ""}`;
  let content = fs.readFileSync(PATHS.buffer, "utf8");

  const marker = "## Pending signals";
  const idx = content.indexOf(marker);
  if (idx === -1) return;

  const afterMarker = content.indexOf("\n", idx) + 1;
  const insertAt = content.indexOf("\n## ", afterMarker);
  const before = content.slice(0, insertAt === -1 ? content.length : insertAt);
  const after = insertAt === -1 ? "" : content.slice(insertAt);

  const updated = before.trimEnd() + "\n" + line + "\n" + after;
  fs.writeFileSync(PATHS.buffer, updated, "utf8");
}

export function incrementBufferCount() {
  let content = fs.readFileSync(PATHS.buffer, "utf8");
  const match = content.match(/\*\*Buffered signals:\*\* (\d+)/);
  const count = match ? parseInt(match[1], 10) + 1 : 1;
  content = content.replace(/\*\*Buffered signals:\*\* \d+/, `**Buffered signals:** ${count}`);
  fs.writeFileSync(PATHS.buffer, content, "utf8");
  return count;
}

export function flushToUserModel(signals) {
  if (!signals.length) return { merged: 0 };

  let userModel = fs.readFileSync(PATHS.userModel, "utf8");
  const entries = signals
    .map((s) => {
      const date = (s.timestamp || today()).slice(0, 10);
      const lines = [
        `### ${date} — ${s.category} (twin-collector)`,
        `- **Signal:** ${s.signal}`,
        `- **Source:** ${s.source || "local-collector"}`,
        `- **Category:** ${s.category}`,
        `- **Confidence:** ${s.confidence || "medium"}`,
      ];
      if (s.puppetVector) lines.push(`- **Puppet vector:** ${s.puppetVector}`);
      if (s.payload) lines.push(`- **Payload:** \`${JSON.stringify(s.payload)}\``);
      if (s.quote) lines.push(`- **Quote:** "${s.quote}"`);
      return lines.join("\n");
    })
    .join("\n\n");

  const anchor = "_New signals append above this line._";
  if (userModel.includes(anchor)) {
    userModel = userModel.replace(anchor, entries + "\n\n" + anchor);
  } else {
    userModel += "\n\n## Entries\n\n" + entries;
  }

  userModel = userModel.replace(
    /\*\*Last updated:\*\* .+/,
    `**Last updated:** ${today()}`
  );

  fs.writeFileSync(PATHS.userModel, userModel, "utf8");

  // Behavior log — one summary line per flush batch
  const topCategory = signals[0]?.category || "pattern";
  const behaviorLine = `${today()} | ${topCategory} batch (${signals.length} signals) | twin fidelity | twin-collector\n`;
  fs.appendFileSync(PATHS.behaviorLog, behaviorLine, "utf8");

  return { merged: signals.length };
}

export function clearBufferPending(signalsMerged) {
  let content = fs.readFileSync(PATHS.buffer, "utf8");
  content = content.replace(/\*\*Buffered signals:\*\* \d+/, "**Buffered signals:** 0");
  content = content.replace(
    /\*\*Last flush:\*\* .+/,
    `**Last flush:** ${today()}`
  );

  // Clear pending signals section (keep header + format line)
  content = content.replace(
    /(## Pending signals\n\n_Format:[^\n]*\n\n)([\s\S]*?)(\n## Pending predictions)/,
    "$1$3"
  );

  // Append flush log row
  const flushRow = `| ${today()} | ${signalsMerged} | twin-collector auto-flush |`;
  content = content.replace(
    /(\| Date \| Signals merged \| Notes \|\n\|[-| ]+\|\n)([\s\S]*?)(\n*$)/,
    (_, header, rows) => {
      const cleaned = rows.replace(/\| — \| — \| — \|\n?/, "");
      return header + cleaned + flushRow + "\n$3";
    }
  );

  fs.writeFileSync(PATHS.buffer, content, "utf8");
}

export function readPendingSignalCount() {
  const content = fs.readFileSync(PATHS.buffer, "utf8");
  const match = content.match(/\*\*Buffered signals:\*\* (\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export { PATHS, REPO_ROOT };
