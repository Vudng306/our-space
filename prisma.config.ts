import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Without this, a missing connection string surfaces as Prisma's
 * "Connection url is empty", which does not say which variable is missing or
 * where to set it. The build applies migrations, so it fails early either way
 * — it may as well say what to do about it.
 */
function databaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (url) return url;

  const onVercel = Boolean(process.env["VERCEL"]);
  const onNetlify = Boolean(process.env["NETLIFY"]);

  const where = onVercel
    ? "On Vercel: Settings → Environment Variables → add DATABASE_URL, tick Production, then redeploy.\n" +
      "  Environment variables do not apply to a build that has already run."
    : onNetlify
      ? "On Netlify: Site configuration → Environment variables → add DATABASE_URL with the\n" +
        "  Builds and Functions scopes ticked, then trigger a new deploy."
      : "Locally: copy .env.example to .env and start the database with `docker compose up -d`.";

  throw new Error(
    `DATABASE_URL is not set.\n\n` +
      `  The build runs \`prisma migrate deploy\`, so it needs the connection string\n` +
      `  before it can create the tables.\n\n  ${where}\n`,
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl(),
  },
});
