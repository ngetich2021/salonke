import { getBrandOverview } from "@/lib/dashboard";
import { OrderStatusActions } from "@/components/dashboard/OrderStatusActions";
import { DataTable } from "@/components/DataTable";
import { BrandStatsTabs } from "@/components/dashboard/BrandStatsTabs";

export async function BrandStats({ ownerId }: { ownerId: string }) {
  const { salons, shops, orders, totalRevenueKes } = await getBrandOverview(ownerId);

  if (salons.length === 0 && shops.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        You haven&apos;t created a listing yet. Use &quot;Create shop&quot;
        above to add your salon or shop.
      </p>
    );
  }

  const revenueByListing = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;
    const place = order.service?.salon.name ?? order.product?.shop.name;
    if (!place) continue;
    revenueByListing.set(place, (revenueByListing.get(place) ?? 0) + order.amountKes);
  }

  const listingsContent = (
    <div className="flex flex-col gap-2 text-sm">
      {salons.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]"
        >
          <p className="font-medium">
            {s.name}{" "}
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              (Salon)
            </span>
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {s.centreName} • {s.phone}
          </p>
        </div>
      ))}
      {shops.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]"
        >
          <p className="font-medium">
            {s.name}{" "}
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              (Shop)
            </span>
          </p>
          {s.phone && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.phone}</p>
          )}
        </div>
      ))}
    </div>
  );

  const completedOrdersCount = orders.filter((order) => order.status === "COMPLETED").length;

  const ordersContent = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
          Orders received
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Completed: <span className="font-semibold text-foreground">{completedOrdersCount}</span>
          {" · "}
          All: <span className="font-semibold text-foreground">{orders.length}</span>
        </p>
      </div>
      <DataTable
        headers={["Item", "Customer", "Amount", "Status", "Date", "Actions"]}
        searchPlaceholder="Search orders received"
        emptyText="No orders yet."
        exportFilename="orders-received"
        rows={orders.map((order) => {
          const item = order.service ?? order.product;
          return {
            key: order.id,
            searchText: `${item?.name ?? ""} ${order.customer.name ?? ""} ${order.customer.email ?? ""} ${order.status}`,
            cells: [
              <span key="item">
                {item?.name ?? "Item removed"}
                {order.product && ` × ${order.quantity}`}
              </span>,
              order.customer.name ?? order.customer.email,
              `Kes ${order.amountKes}`,
              order.status,
              order.createdAt.toLocaleDateString(),
              <OrderStatusActions key="actions" orderId={order.id} status={order.status} />,
            ],
            values: [
              `${item?.name ?? "Item removed"}${order.product ? ` x ${order.quantity}` : ""}`,
              order.customer.name ?? order.customer.email,
              `Kes ${order.amountKes}`,
              order.status,
              order.createdAt.toLocaleDateString(),
              "",
            ],
          };
        })}
      />
    </div>
  );

  const revenueContent = (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-2xl font-semibold">Kes {totalRevenueKes}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          From completed orders
        </p>
      </div>
      {revenueByListing.size > 0 && (
        <div className="flex flex-col gap-1">
          {[...revenueByListing.entries()].map(([name, amount]) => (
            <div
              key={name}
              className="flex items-center justify-between border-b border-black/[.08] py-1.5 dark:border-white/[.145]"
            >
              <span>{name}</span>
              <span className="font-medium">Kes {amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <BrandStatsTabs
      listingsCount={salons.length + shops.length}
      ordersCount={orders.length}
      totalRevenueKes={totalRevenueKes}
      listingsContent={listingsContent}
      ordersContent={ordersContent}
      revenueContent={revenueContent}
    />
  );
}
