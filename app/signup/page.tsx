import { signIn } from "@/lib/auth";
import { GoogleButton } from "@/components/GoogleButton";

export default function SignupPage() {
  async function signupWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/account" });
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Sign up instantly with Google. Once you&apos;re in, you can advertise
        your salon or shop, or request admin access from your account.
      </p>
      <form action={signupWithGoogle}>
        <GoogleButton>Sign up with Google</GoogleButton>
      </form>
    </div>
  );
}
