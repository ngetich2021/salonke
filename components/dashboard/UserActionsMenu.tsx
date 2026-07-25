"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  adminAssignCustomRoleAction,
  adminCancelRoleRequestAction,
  adminDeleteUserAction,
  adminOfferRoleAction,
} from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { Role } from "@/lib/generated/prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: "Customer",
  BRAND: "Brand",
  ADMIN: "Admin",
};

const ALL_ROLES: Role[] = ["CUSTOMER", "BRAND", "ADMIN"];

const selectClassName =
  "min-w-0 flex-1 rounded-lg border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]";

export function UserActionsMenu({
  userId,
  userLabel,
  currentRole,
  pendingRole,
  pendingRequestId,
  customRoles,
  currentCustomRoleId,
}: {
  userId: string;
  userLabel: string;
  currentRole: Role;
  pendingRole: Role | null;
  pendingRequestId: string | null;
  customRoles: { id: string; name: string }[];
  currentCustomRoleId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const offerableRoles = ALL_ROLES.filter((role) => role !== currentRole);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.right - 256 });
    }
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${userLabel}`}
        className="rounded-full px-2 py-1 text-zinc-500 hover:bg-black/[.04] hover:text-foreground dark:hover:bg-white/[.08]"
      >
        ⋮
      </button>

      {/* Closed shows nothing beyond the trigger above; everything below
          only renders while `open` — collapsed as native <select> dropdowns
          (not one button per role/custom role) so this stays a small popover
          no matter how many custom roles an admin has created. */}
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: position.top, left: position.left }}
            className="z-50 w-64 rounded-xl border border-black/[.08] bg-white p-2 text-sm shadow-lg dark:border-white/[.145] dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-1 border-b border-black/[.08] pb-2 dark:border-white/[.145]">
              <p className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Offer a role
              </p>
              <form
                action={adminOfferRoleAction}
                onSubmit={() => setOpen(false)}
                className="flex items-center gap-1.5 px-1"
              >
                <input type="hidden" name="userId" value={userId} />
                <select name="role" defaultValue="" required className={selectClassName}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {offerableRoles.map((role) => (
                    <option key={role} value={role} disabled={role === pendingRole}>
                      {ROLE_LABELS[role]}
                      {role === pendingRole && " (offered)"}
                    </option>
                  ))}
                </select>
                <SubmitButton
                  pendingText="…"
                  className="rounded-lg border border-black/[.08] px-2 py-1.5 text-xs font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
                >
                  Offer
                </SubmitButton>
              </form>

              {pendingRequestId && (
                <form
                  action={adminCancelRoleRequestAction}
                  onSubmit={() => setOpen(false)}
                  className="px-1"
                >
                  <input type="hidden" name="requestId" value={pendingRequestId} />
                  <button
                    type="submit"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-black/[.04] dark:hover:bg-white/[.08]"
                  >
                    Cancel pending offer
                  </button>
                </form>
              )}
            </div>

            {customRoles.length > 0 && (
              <div className="flex flex-col gap-1 border-b border-black/[.08] py-2 dark:border-white/[.145]">
                <p className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Staff role
                </p>
                <form
                  action={adminAssignCustomRoleAction}
                  onSubmit={() => setOpen(false)}
                  className="flex items-center gap-1.5 px-1"
                >
                  <input type="hidden" name="userId" value={userId} />
                  <select
                    name="roleId"
                    defaultValue={currentCustomRoleId ?? ""}
                    className={selectClassName}
                  >
                    <option value="">No staff role</option>
                    {customRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <SubmitButton
                    pendingText="…"
                    className="rounded-lg border border-black/[.08] px-2 py-1.5 text-xs font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
                  >
                    Set
                  </SubmitButton>
                </form>
              </div>
            )}

            <form
              action={adminDeleteUserAction}
              onSubmit={(e) => {
                if (
                  !confirm(
                    `Delete ${userLabel}? This also deletes any salon or shop they own. This can't be undone.`
                  )
                ) {
                  e.preventDefault();
                  return;
                }
                setOpen(false);
              }}
              className="pt-2"
            >
              <input type="hidden" name="userId" value={userId} />
              <button
                type="submit"
                role="menuitem"
                className="w-full rounded-lg px-2 py-1.5 text-left text-red-600 hover:bg-red-600/10 dark:text-red-400"
              >
                Delete
              </button>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
