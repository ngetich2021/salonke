export function LoadingSpinner() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-4 border-black/[.08] dark:border-white/[.145]" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-foreground" />
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    </div>
  );
}
