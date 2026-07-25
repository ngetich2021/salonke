import Link from "next/link";
import { Suspense } from "react";
import { auth, signOut } from "@/lib/auth";
import { Panel } from "@/components/Panel";
import { CustomerOrders } from "@/components/dashboard/CustomerOrders";
import { BrandStats } from "@/components/dashboard/BrandStats";
import { SubmitButton } from "@/components/SubmitButton";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <Suspense fallback={<AccountSectionFallback />}>
        <AccountSection />
      </Suspense>
    </div>
  );
}

function AccountSectionFallback() {
  return (
    <Panel className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-black/[.08] border-t-foreground dark:border-white/[.145]" />
      Loading your account…
    </Panel>
  );
}

async function AccountSection() {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  if (!session?.user) {
    return (
      <Panel className="space-y-2 text-sm">
        <p>
          Need and account with us ? :{" "}
          <Link href="/signup" className="font-semibold hover:underline">
            sign up
          </Link>
        </p>
        <p>
          Already have an account? :{" "}
          <Link href="/login" className="font-semibold hover:underline">
            Login
          </Link>
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>Signed in as {session.user.name ?? session.user.email}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/account" className="hover:underline">
            Account
          </Link>
          <form action={signOutAction}>
            <SubmitButton pendingText="Signing out…" className="text-xs hover:underline">
              Sign out
            </SubmitButton>
          </form>
        </div>
      </Panel>

      <Panel>
        <CustomerOrders customerId={session.user.id} />
      </Panel>
      {session.user.role === "BRAND" && (
        <Panel>
          <BrandStats ownerId={session.user.id} />
        </Panel>
      )}
    </div>
  );
}
