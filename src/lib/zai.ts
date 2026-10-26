import fs from "fs/promises";
import os from "os";
import path from "path";
import ZAI from "z-ai-web-dev-sdk";

type ZAIInstance = Awaited<ReturnType<typeof ZAI.create>>;

const globalForZai = globalThis as unknown as {
  zai: ZAIInstance | undefined;
  zaiConfigMtimeMs: number | undefined;
  zaiConfigToken: string | null | undefined;
};

/**
 * Same search order and validity rule as the SDK's own loadConfig():
 * project dir → home dir → /etc. The first file that parses and has both
 * baseUrl and apiKey wins.
 */
const CONFIG_PATHS = [
  path.join(process.cwd(), ".z-ai-config"),
  path.join(os.homedir(), ".z-ai-config"),
  "/etc/.z-ai-config",
];

interface ConfigSignature {
  mtimeMs: number;
  token: string | null;
}

async function readConfigSignature(): Promise<ConfigSignature | null> {
  for (const filePath of CONFIG_PATHS) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as {
        baseUrl?: string;
        apiKey?: string;
        token?: string;
      };
      if (parsed.baseUrl && parsed.apiKey) {
        const stats = await fs.stat(filePath);
        return {
          mtimeMs: Math.floor(stats.mtimeMs),
          token: typeof parsed.token === "string" ? parsed.token : null,
        };
      }
    } catch {
      // Missing or mid-rewrite — keep searching, exactly like the SDK.
    }
  }
  return null;
}

/**
 * Server-only singleton for the Z-AI SDK.
 *
 * The sandbox (re)writes `.z-ai-config` while the dev server keeps running,
 * so a client cached earlier can go stale — e.g. it was built before a token
 * was provisioned, and then every API call fails with
 * `401 {"error":"missing X-Token header"}`.
 *
 * To stay resilient, each call re-reads the config file's mtime and token and
 * transparently rebuilds the cached client whenever they change. Reading a
 * ~300-byte file per request is negligible next to an actual model call.
 */
export async function getZai(): Promise<ZAIInstance> {
  const signature = await readConfigSignature();
  const cached = globalForZai.zai;

  const cacheIsValid =
    cached !== undefined &&
    signature !== null &&
    globalForZai.zaiConfigMtimeMs === signature.mtimeMs &&
    globalForZai.zaiConfigToken === signature.token;

  if (cached && cacheIsValid) {
    return cached;
  }

  const instance = await ZAI.create();
  globalForZai.zai = instance;
  globalForZai.zaiConfigMtimeMs = signature?.mtimeMs;
  globalForZai.zaiConfigToken = signature?.token;
  return instance;
}

/**
 * Force the next getZai() call to rebuild the client from disk.
 * Call this after an auth failure (401) before retrying once.
 */
export function invalidateZai(): void {
  globalForZai.zai = undefined;
  globalForZai.zaiConfigMtimeMs = undefined;
  globalForZai.zaiConfigToken = undefined;
}

/**
 * True when an SDK error looks like an authentication/authorization failure
 * (stale or missing token) — the case where rebuilding the client can help.
 */
export function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("status 401") || message.includes("missing X-Token");
}
