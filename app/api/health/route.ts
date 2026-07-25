import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "reachable" }, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        status: "error",
        database: "unreachable",
        message: err instanceof Error ? err.message : "unknown error",
      },
      { status: 503 }
    );
  }
}
