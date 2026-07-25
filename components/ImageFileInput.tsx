"use client";

import { useState, type ChangeEvent } from "react";
import { Photo } from "@/components/Photo";

export function ImageFileInput({
  name = "image",
  label = "Photo (optional)",
  defaultImageUrl,
}: {
  name?: string;
  label?: string;
  defaultImageUrl?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(defaultImageUrl ?? null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : (defaultImageUrl ?? null));
  }

  return (
    <label className="flex flex-col gap-2">
      {label}
      <input
        name={name}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="rounded border border-black/[.08] px-3 py-2 text-xs text-zinc-700 dark:border-white/[.145] dark:bg-transparent dark:text-zinc-300 file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-background"
      />
      {preview && (
        <Photo src={preview} alt="Preview" className="h-24 w-24 rounded-lg" />
      )}
    </label>
  );
}
