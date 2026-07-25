import { PhoneButton } from "@/components/PhoneButton";

export function Footer() {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-black/[.08] py-4 text-center text-xs text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
      <p>
        developed with love by kwenik developers.{" "}
        <PhoneButton phone="0704 876 954" className="underline underline-offset-2" />
      </p>
      <p className="flex items-center gap-3">
        <a href="/terms" className="underline underline-offset-2">
          Terms and Conditions
        </a>
        <a href="/report" className="underline underline-offset-2">
          Report an issue
        </a>
      </p>
    </footer>
  );
}
