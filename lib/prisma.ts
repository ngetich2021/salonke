import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const RETRYABLE_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
]);

const MAX_FETCH_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 30_000;

// Turso connections occasionally hit a transient connect timeout, or the
// very first DNS lookup for the host is slow enough to fail outright
// (surfaces as ENOTFOUND even though the host is valid); retrying the
// request a few times avoids failing a whole login/page load on what is
// usually a one-off network blip. The 30s timeout is applied per-attempt via
// a plain AbortSignal (not a global undici dispatcher override — that
// previously crashed unrelated requests with "controller[kState]
// .transformAlgorithm is not a function" because the standalone `undici`
// package's internals don't line up with Node's built-in fetch).
//
// The request is cloned lazily, only right before an attempt that might
// still need a retry after it. Eagerly cloning up front (the previous
// approach) tees the request body stream on every single call regardless of
// whether a retry ever happens, which under Turbopack dev triggered the same
// transformAlgorithm crash on ordinary, never-retried queries.
async function fetchWithRetry(request: Request): Promise<Response> {
  let current = request;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_FETCH_ATTEMPTS;
    const spare = isLastAttempt ? null : current.clone();

    try {
      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const signal = current.signal
        ? AbortSignal.any([current.signal, timeoutSignal])
        : timeoutSignal;
      return await fetch(new Request(current, { signal, cache: "no-store" }));
    } catch (err) {
      lastError = err;
      const code =
        (err as { cause?: { code?: string }; code?: string })?.cause?.code ??
        (err as { code?: string })?.code;
      if (!code || !RETRYABLE_CODES.has(code) || isLastAttempt) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      current = spare!;
    }
  }
  throw lastError;
}

function createPrismaClient() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
    fetch: fetchWithRetry,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
