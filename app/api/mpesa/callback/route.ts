import { NextResponse } from "next/server";
import { parseStkCallback } from "@/lib/mpesa";
import { applyStkResult } from "@/lib/payments";

// Safaricom calls this directly (no session/auth) once an STK push resolves,
// success or failure — never blocking, always 200s back so Daraja doesn't
// retry-storm us, even when the payload doesn't match anything we know
// about. This is the primary confirmation path, but not the only one — if
// this route is unreachable (e.g. a dev ngrok tunnel dropped),
// getPaymentStatusAction's polling falls back to actively querying
// Safaricom instead of waiting forever (see lib/mpesa.ts queryStkStatus).
export async function POST(request: Request) {
  let result;
  try {
    result = parseStkCallback(await request.json());
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Ignored malformed payload" });
  }

  await applyStkResult(result);
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
