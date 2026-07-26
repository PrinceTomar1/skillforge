import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  databaseUrl: required("DATABASE_URL"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  cookieName: process.env.COOKIE_NAME ?? "skillforge_token",

  aiProvider: (process.env.AI_PROVIDER ?? "none") as "anthropic" | "gemini" | "none",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-20250929",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",

  embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? "local") as "openai" | "local",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),

  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 10),

  isProduction: process.env.NODE_ENV === "production",
};

export const aiIsConfigured =
  (env.aiProvider === "anthropic" && env.anthropicApiKey.length > 0) ||
  (env.aiProvider === "gemini" && env.geminiApiKey.length > 0);
export const embeddingsUseRealProvider = env.embeddingProvider === "openai" && env.openaiApiKey.length > 0;
