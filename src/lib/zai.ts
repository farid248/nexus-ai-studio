import ZAI from "z-ai-web-dev-sdk";

type ZAIInstance = Awaited<ReturnType<typeof ZAI.create>>;

const globalForZai = globalThis as unknown as {
  zai: ZAIInstance | undefined;
};

/**
 * Server-only singleton for the Z-AI SDK.
 * Reused across requests to avoid re-initializing the client on every call.
 */
export async function getZai(): Promise<ZAIInstance> {
  if (!globalForZai.zai) {
    globalForZai.zai = await ZAI.create();
  }
  return globalForZai.zai;
}
