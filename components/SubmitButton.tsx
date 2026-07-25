"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
