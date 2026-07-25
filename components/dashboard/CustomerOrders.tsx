import { getCustomerOrders } from "@/lib/dashboard";
import { ContactIcons } from "@/components/ContactIcons";
import { updateOrderQuantityAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { OrderStatusActions } from "@/components/dashboard/OrderStatusActions";
import { DataTable } from "@/components/DataTable";
import type { OrderStatus } from "@/lib/generated/prisma/client";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Ordered",
  ACCEPTED: "Accepted",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export async function CustomerOrders({ customerId }: { customerId: string }) {
  const orders = await getCustomerOrders(customerId);
  const completedOrdersCount = orders.filter((order) => order.status === "COMPLETED").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Your orders</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Completed: <span className="font-semibold text-foreground">{completedOrdersCount}</span>
          {" · "}
          All: <span className="font-semibold text-foreground">{orders.length}</span>
        </p>
      </div>
      <DataTable
        headers={["Item", "Place", "Amount", "Status", "Date", "Actions"]}
        searchPlaceholder="Search your orders"
        emptyText="You have no orders yet."
        exportFilename="my-orders"
        rows={orders.map((order) => {
          const item = order.service ?? order.product;
          const place = order.service?.salon.name ?? order.product?.shop.name;
          const whatsappNumber =
            order.service?.salon.whatsappNumber ?? order.product?.shop.whatsappNumber;
          const phone = order.service?.salon.phone ?? order.product?.shop.phone;
          const canEditQuantity =
            !!order.product && (order.status === "PENDING" || order.status === "ACCEPTED");

          return {
            key: order.id,
            searchText: `${item?.name ?? ""} ${place ?? ""} ${STATUS_LABELS[order.status]}`,
            cells: [
              <span key="item">
                {item?.name ?? "Item removed"}
                {order.product && ` × ${order.quantity}`}
              </span>,
              place ?? "—",
              `Kes ${order.amountKes}`,
              <div key="status" className="flex flex-col gap-1">
                <span>{STATUS_LABELS[order.status]}</span>
                {order.status === "COMPLETED" && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    Pay Kes {order.amountKes} to {place}.
                  </span>
                )}
              </div>,
              order.createdAt.toLocaleDateString(),
              <div key="actions" className="flex flex-col gap-2">
                <OrderStatusActions orderId={order.id} status={order.status} viewer="customer" />
                {canEditQuantity && (
                  <form action={updateOrderQuantityAction} className="flex items-center gap-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <label className="flex items-center gap-1 text-xs">
                      Qty
                      <input
                        name="quantity"
                        type="number"
                        min="1"
                        defaultValue={order.quantity}
                        className="w-14 rounded border border-black/[.08] px-2 py-1 dark:border-white/[.145] dark:bg-transparent"
                      />
                    </label>
                    <SubmitButton
                      pendingText="Updating…"
                      className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                    >
                      Update
                    </SubmitButton>
                  </form>
                )}
                {(whatsappNumber || phone) && (
                  <ContactIcons whatsappNumber={whatsappNumber} phone={phone} />
                )}
              </div>,
            ],
            values: [
              `${item?.name ?? "Item removed"}${order.product ? ` x ${order.quantity}` : ""}`,
              place ?? "—",
              `Kes ${order.amountKes}`,
              STATUS_LABELS[order.status],
              order.createdAt.toLocaleDateString(),
              "",
            ],
          };
        })}
      />
    </div>
  );
}
