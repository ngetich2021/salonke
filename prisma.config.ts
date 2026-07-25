import "dotenv/config";
import { defineConfig } from "prisma/config";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: tursoAuthToken ? `${tursoUrl}?authToken=${tursoAuthToken}` : tursoUrl,
  },
});
