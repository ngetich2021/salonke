import { signIn } from "@/lib/auth";
import { GoogleButton } from "@/components/GoogleButton";

// Only ever redirect back to a same-origin relative path — `callbackUrl`
// comes straight from the URL, so accepting anything else (an absolute URL,
// or `//host/...` which browsers treat as protocol-relative) would be an
// open redirect.
function safeCallbackUrl(raw: string | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

// Auth.js redirects here (see lib/auth.ts's pages.error) with `?error=<code>`
// whenever sign-in fails — an expired or already-used OAuth callback (e.g.
// the page was refreshed, or too long was spent on Google's account picker),
// a denied consent screen, or a transient server hiccup mid-flow. None of
// these mean anything is actually broken; the fix is always just to try
// again, so that's the only message shown regardless of the specific code.
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Sign-in was cancelled.",
  OAuthAccountNotLinked:
    "That Google account's email is already linked to a different sign-in method.",
};
const DEFAULT_ERROR_MESSAGE = "Something interrupted sign-in. Please try again.";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const callbackUrlParam = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;
  const callbackUrl = safeCallbackUrl(callbackUrlParam);

  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;
  const errorMessage = errorParam ? (ERROR_MESSAGES[errorParam] ?? DEFAULT_ERROR_MESSAGE) : null;

  async function loginWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account? Continue with Google to log in.
      </p>
      {errorMessage && (
        <p className="rounded-lg border border-red-600/30 bg-red-600/[.06] p-3 text-sm text-red-700 dark:text-red-400">
          {errorMessage}
        </p>
      )}
      <form action={loginWithGoogle}>
        <GoogleButton>Continue with Google</GoogleButton>
      </form>
    </div>
  );
}
