// Serves Silent Ideas on port 5173. Installs studio dependencies once.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const studio = join(root, "studio");

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, { cwd: studio, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(" ")} exited ${code}`));
    });
  });
}

if (!existsSync(join(studio, "node_modules"))) {
  await run(["ci"]);
}

const child = spawn("npm", ["run", "dev"], { cwd: studio, stdio: "inherit" });
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
