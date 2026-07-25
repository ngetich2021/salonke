export function Photo({
  src,
  alt,
  className = "",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={`object-cover ${className}`} />
    );
  }

  return (
    <div
      aria-label={alt}
      className={`flex items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 ${className}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5-4 4-3-3-6 6" />
      </svg>
    </div>
  );
}
