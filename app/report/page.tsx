import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { Panel } from "@/components/Panel";
import { ReportIssueForm } from "@/components/ReportIssueForm";

export const metadata: Metadata = {
  title: "Report an issue — SalonKE",
};

export default async function ReportPage() {
  const session = await auth();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold">Report an issue</h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Anyone can report a problem — a broken ad, a listing that shouldn&apos;t be up, a bug on
          the site, anything. No account needed.
        </p>
      </div>

      <Panel>
        <ReportIssueForm defaultName={session?.user?.name} defaultEmail={session?.user?.email} />
      </Panel>
    </div>
  );
}
