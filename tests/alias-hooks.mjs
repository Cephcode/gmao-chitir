// Hooks de résolution pour les tests (voir register.mjs).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUB = pathToFileURL(path.join(ROOT, "tests/stubs/supabase-server.mjs")).href;

export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/supabase/server") return { url: STUB, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const base = path.join(ROOT, specifier.slice(2));
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
