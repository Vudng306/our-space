import { z } from "zod";

/**
 * Environment is validated once, at module load, so a misconfigured deploy
 * fails loudly at boot instead of silently at the first upload.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters — generate one with `openssl rand -base64 48`"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),

  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().default("true"),

  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(12),
  MAX_PHOTOS_PER_MOMENT: z.coerce.number().int().positive().max(30).default(10),

  SMTP_URL: z.string().optional(),
  SMTP_FROM: z.string().default("Our Space <no-reply@localhost>"),

  DISABLE_REGISTRATION: z.string().default("0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;

  if (e.STORAGE_DRIVER === "s3") {
    const missing = (["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const).filter((k) => !e[k]);
    if (missing.length) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(", ")}`);
    }
  }

  return {
    ...e,
    isProduction: e.NODE_ENV === "production",
    registrationDisabled: e.DISABLE_REGISTRATION === "1" || e.DISABLE_REGISTRATION.toLowerCase() === "true",
    s3ForcePathStyle: e.S3_FORCE_PATH_STYLE !== "false",
    maxUploadBytes: e.MAX_UPLOAD_MB * 1024 * 1024,
    appUrl: e.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""),
    /// False when the default was used, so the request can answer instead.
    appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  };
}

export const env = load();
export type Env = typeof env;
