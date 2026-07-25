"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from "react";

export type ModalHandle = {
  close: () => void;
};

export const Modal = forwardRef<
  ModalHandle,
  {
    triggerLabel: string;
    triggerClassName?: string;
    title?: string;
    children: ReactNode;
  }
>(function Modal({ triggerLabel, triggerClassName, title, children }, ref) {
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({ close: () => setOpen(false) }));

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
        }
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-black/[.08] bg-white p-6 shadow-xl dark:border-white/[.145] dark:bg-zinc-900"
          >
            <div className="mb-4 flex items-center justify-between">
              {title && <h2 className="text-sm font-semibold">{title}</h2>}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-zinc-500 hover:bg-black/[.04] hover:text-foreground dark:hover:bg-white/[.08]"
              >
                ✕
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
});
