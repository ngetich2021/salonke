"use client";

import { useRef, useState, type ChangeEvent } from "react";

export function VideoFileInput({
  name = "video",
  label = "Product video",
  maxSeconds = 30,
}: {
  name?: string;
  label?: string;
  maxSeconds?: number;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setPreview(null);
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (probe.duration > maxSeconds) {
        setError(`Video must be ${maxSeconds} seconds or shorter.`);
        if (inputRef.current) inputRef.current.value = "";
        URL.revokeObjectURL(objectUrl);
      } else {
        setPreview(objectUrl);
      }
    };
    probe.src = objectUrl;
  }

  return (
    <label className="flex flex-col gap-2">
      {label} (max {maxSeconds}s)
      <input
        ref={inputRef}
        name={name}
        type="file"
        accept="video/*"
        required
        onChange={handleChange}
        className="rounded border border-black/[.08] px-3 py-2 text-xs text-zinc-700 dark:border-white/[.145] dark:bg-transparent dark:text-zinc-300 file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-background"
      />
      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
      {preview && (
        <video src={preview} controls className="h-40 w-full rounded-lg bg-black" />
      )}
    </label>
  );
}
