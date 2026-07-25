import { updateOrderStatusAction } from "@/lib/actions";
import type { OrderStatus } from "@/lib/generated/prisma/client";
import { SubmitButton } from "@/components/SubmitButton";

type Viewer = "owner" | "customer";

const NEXT_ACTIONS: Partial<
  Record<OrderStatus, { status: OrderStatus; label: string; audience: Viewer | "any" }[]>
> = {
  PENDING: [
    { status: "ACCEPTED", label: "Accept", audience: "owner" },
    { status: "CANCELLED", label: "Cancel", audience: "any" },
  ],
  ACCEPTED: [
    { status: "COMPLETED", label: "Complete", audience: "owner" },
    { status: "CANCELLED", label: "Cancel", audience: "any" },
  ],
};

export function OrderStatusActions({
  orderId,
  status,
  viewer = "owner",
}: {
  orderId: string;
  status: OrderStatus;
  viewer?: Viewer;
}) {
  const actions = NEXT_ACTIONS[status]?.filter(
    (action) => action.audience === "any" || action.audience === viewer
  );
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex gap-2">
      {actions.map((action) => (
        <form key={action.status} action={updateOrderStatusAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="status" value={action.status} />
          <SubmitButton
            className={
              action.status === "CANCELLED"
                ? "rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                : "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
            }
          >
            {action.label}
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}
