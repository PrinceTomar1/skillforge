import { createApp } from "./app";
import { env, aiIsConfigured, embeddingsUseRealProvider } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`SkillForge API listening on http://localhost:${env.port}`);
  console.log(`  AI Tutor / generation provider: ${aiIsConfigured ? `${env.aiProvider} (configured)` : "NOT CONFIGURED — set AI_PROVIDER + the matching API key in backend/.env"}`);
  console.log(`  Embedding provider: ${embeddingsUseRealProvider ? "openai (real semantic embeddings)" : "local hashing fallback (no OPENAI_API_KEY set)"}`);
});
