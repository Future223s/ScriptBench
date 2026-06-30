import { rmSync } from "node:fs";
import { resolve } from "node:path";

const nextDir = resolve(process.cwd(), ".next");

try {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("[startup] cleared .next cache");
} catch (error) {
  console.warn("[startup] failed to clear .next cache:", error instanceof Error ? error.message : String(error));
}
