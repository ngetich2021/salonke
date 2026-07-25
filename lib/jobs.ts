import { after } from "next/server";

// Runs `task` after the response has been sent, so slow/non-essential side
// effects (e.g. sending an email) never block the request they were
// triggered from, and a failure in `task` can never fail that request.
export function runAfterResponse(task: () => Promise<void>, label: string) {
  after(async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[job:${label}] failed`, err);
    }
  });
}
