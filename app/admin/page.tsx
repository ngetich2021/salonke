import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAdminOverview,
  getAllAdverts,
  getAllCustomRoles,
  getAllIssueReports,
  getAllOrders,
  getAllPayments,
  getAllSalons,
  getAllShops,
  getAllUsers,
  getAllVerificationRequests,
  getSiteVisitsByDay,
} from "@/lib/dashboard";
import {
  adminCreateCustomRoleAction,
  adminDeleteCustomRoleAction,
  adminDeleteSalonAction,
  adminDeleteShopAction,
  adminRevokeVerificationAction,
  adminSetAdvertStatusAction,
  adminSetIssueReportStatusAction,
  adminSuspendSalonAction,
  adminUnsuspendSalonAction,
  adminSuspendShopAction,
  adminUnsuspendShopAction,
} from "@/lib/actions";
import { isEligibleForDeletion } from "@/lib/suspension";
import { isVerificationActive } from "@/lib/verification";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Panel } from "@/components/Panel";
import { AdminStatNav } from "@/components/dashboard/AdminStatNav";
import { DataTable } from "@/components/DataTable";
import { ConfirmDeleteForm } from "@/components/dashboard/ConfirmDeleteForm";
import { SuspendActions } from "@/components/dashboard/SuspendActions";
import { UserActionsMenu } from "@/components/dashboard/UserActionsMenu";
import { CreateCustomRoleModal } from "@/components/dashboard/CreateCustomRoleModal";
import { DailyBarChart } from "@/components/dashboard/DailyBarChart";
import { SubmitButton } from "@/components/SubmitButton";

function mapsLink(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

const ALL_TABS = [
  "users",
  "salons",
  "shops",
  "orders",
  "adverts",
  "payments",
  "roles",
  "verification",
  "reports",
  "analytics",
] as const;
type Tab = (typeof ALL_TABS)[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const isAdmin = session.user.role === "ADMIN";
  const customRole = session.user.customRole;
  const perms = isAdmin
    ? { users: true, salons: true, shops: true, orders: true }
    : {
        users: customRole?.canViewUsers ?? false,
        salons: customRole?.canViewSalons ?? false,
        shops: customRole?.canViewShops ?? false,
        orders: customRole?.canViewOrders ?? false,
      };

  if (!isAdmin && !Object.values(perms).some(Boolean)) redirect("/");

  const tabs = ALL_TABS.filter((key) =>
    key === "roles" ||
    key === "adverts" ||
    key === "payments" ||
    key === "verification" ||
    key === "reports" ||
    key === "analytics"
      ? isAdmin
      : perms[key]
  );

  const params = await searchParams;
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: Tab = tabs.includes(tabParam as Tab) ? (tabParam as Tab) : tabs[0];

  const [
    { userCount, salonCount, shopCount, orderCount },
    users,
    salons,
    shops,
    orders,
    customRoles,
    adverts,
    payments,
    verificationRequests,
    issueReports,
    siteVisits,
  ] = await Promise.all([
    getAdminOverview(),
    perms.users ? getAllUsers() : Promise.resolve([]),
    perms.salons ? getAllSalons() : Promise.resolve([]),
    perms.shops ? getAllShops() : Promise.resolve([]),
    perms.orders ? getAllOrders() : Promise.resolve([]),
    isAdmin ? getAllCustomRoles() : Promise.resolve([]),
    isAdmin ? getAllAdverts() : Promise.resolve([]),
    isAdmin ? getAllPayments() : Promise.resolve([]),
    isAdmin ? getAllVerificationRequests() : Promise.resolve([]),
    isAdmin ? getAllIssueReports() : Promise.resolve([]),
    isAdmin ? getSiteVisitsByDay(14) : Promise.resolve([]),
  ]);

  const pendingAdvertsCount = adverts.filter((advert) => advert.status === "PENDING").length;
  const awaitingVerificationPaymentCount = verificationRequests.filter(
    (r) => r.status === "AWAITING_PAYMENT"
  ).length;
  const openReportsCount = issueReports.filter((r) => r.status === "OPEN").length;
  const siteVisitsTotal = siteVisits.reduce((sum, day) => sum + day.count, 0);
  const completedOrdersCount = orders.filter((order) => order.status === "COMPLETED").length;
  const moneyReceivedKes = payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + p.amountKes, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="text-xl font-semibold">Admin panel</h1>

      <Panel>
        <AdminStatNav
          activeTab={tab}
          stats={tabs.map((key) => ({
            key,
            label: key[0].toUpperCase() + key.slice(1),
            value: {
              users: userCount,
              salons: salonCount,
              shops: shopCount,
              orders: orderCount,
              adverts: pendingAdvertsCount,
              payments: moneyReceivedKes,
              roles: customRoles.length,
              verification: awaitingVerificationPaymentCount,
              reports: openReportsCount,
              analytics: siteVisitsTotal,
            }[key],
          }))}
        />
      </Panel>

      {tab === "users" && (
        <Panel className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Users</h2>
          <DataTable
            headers={[
              "Name",
              "Email",
              "Phone",
              "Role",
              "Staff role",
              "Pending offer",
              ...(isAdmin ? ["Actions"] : []),
            ]}
            searchPlaceholder="Search users"
            emptyText="No users yet."
            exportFilename="users"
            rows={users.map((user) => {
              const pendingRequest = user.roleRequests[0] ?? null;
              return {
                key: user.id,
                searchText: `${user.name ?? ""} ${user.email ?? ""} ${user.phone ?? ""} ${user.role}`,
                cells: [
                  user.name ?? "—",
                  user.email ?? "—",
                  user.phone ?? "—",
                  user.role,
                  user.customRole?.name ?? "—",
                  pendingRequest?.role ?? "—",
                  ...(isAdmin
                    ? [
                        user.id === session.user.id ? (
                          "—"
                        ) : (
                          <UserActionsMenu
                            key="actions"
                            userId={user.id}
                            userLabel={user.name ?? user.email ?? "this user"}
                            currentRole={user.role}
                            pendingRole={pendingRequest?.role ?? null}
                            pendingRequestId={pendingRequest?.id ?? null}
                            customRoles={customRoles}
                            currentCustomRoleId={user.customRoleId}
                          />
                        ),
                      ]
                    : []),
                ],
                values: [
                  user.name ?? "—",
                  user.email ?? "—",
                  user.phone ?? "—",
                  user.role,
                  user.customRole?.name ?? "—",
                  pendingRequest?.role ?? "—",
                  ...(isAdmin ? [""] : []),
                ],
              };
            })}
          />
        </Panel>
      )}

      {tab === "salons" && (
        <Panel className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Salons</h2>
          <DataTable
            headers={[
              "Name",
              "Centre",
              "Phone",
              "Owner",
              "Services",
              "Location",
              "Status",
              ...(isAdmin ? ["Actions"] : []),
            ]}
            searchPlaceholder="Search salons"
            emptyText="No salons yet."
            exportFilename="salons"
            rows={salons.map((salon) => ({
              key: salon.id,
              searchText: `${salon.name} ${salon.centreName} ${salon.owner?.name ?? ""} ${salon.owner?.email ?? ""} ${salon.suspended ? "suspended" : "active"}`,
              cells: [
                <span key="name">
                  {salon.name}
                  {isVerificationActive(salon) && <VerifiedBadge />}
                </span>,
                salon.centreName,
                salon.phone,
                salon.owner?.name ?? salon.owner?.email ?? "—",
                salon.services.length,
                <a
                  key="location"
                  href={mapsLink(salon.latitude, salon.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap font-medium hover:underline"
                >
                  {salon.latitude.toFixed(4)}, {salon.longitude.toFixed(4)}
                </a>,
                salon.suspended ? (
                  <span key="status" className="font-semibold text-amber-700 dark:text-amber-400">
                    Suspended {salon.suspendedAt?.toLocaleDateString()}
                  </span>
                ) : (
                  <span key="status" className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Active
                  </span>
                ),
                ...(isAdmin
                  ? [
                      <SuspendActions
                        key="actions"
                        hiddenName="salonId"
                        id={salon.id}
                        label={salon.name}
                        suspended={salon.suspended}
                        eligibleForDeletion={isEligibleForDeletion(salon.suspended, salon.suspendedAt)}
                        suspendAction={adminSuspendSalonAction}
                        unsuspendAction={adminUnsuspendSalonAction}
                        deleteAction={adminDeleteSalonAction}
                      />,
                    ]
                  : []),
              ],
              values: [
                salon.name,
                salon.centreName,
                salon.phone,
                salon.owner?.name ?? salon.owner?.email ?? "—",
                salon.services.length,
                `${salon.latitude.toFixed(4)}, ${salon.longitude.toFixed(4)}`,
                salon.suspended
                  ? `Suspended ${salon.suspendedAt?.toLocaleDateString() ?? ""}`
                  : "Active",
                ...(isAdmin ? [""] : []),
              ],
            }))}
          />
        </Panel>
      )}

      {tab === "shops" && (
        <Panel className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Shops</h2>
          <DataTable
            headers={[
              "Name",
              "Phone",
              "Owner",
              "Products",
              "Location",
              "Status",
              ...(isAdmin ? ["Actions"] : []),
            ]}
            searchPlaceholder="Search shops"
            emptyText="No shops yet."
            exportFilename="shops"
            rows={shops.map((shop) => ({
              key: shop.id,
              searchText: `${shop.name} ${shop.owner?.name ?? ""} ${shop.owner?.email ?? ""} ${shop.suspended ? "suspended" : "active"}`,
              cells: [
                <span key="name">
                  {shop.name}
                  {isVerificationActive(shop) && <VerifiedBadge />}
                </span>,
                shop.phone ?? "—",
                shop.owner?.name ?? shop.owner?.email ?? "—",
                shop.products.length,
                <a
                  key="location"
                  href={mapsLink(shop.latitude, shop.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap font-medium hover:underline"
                >
                  {shop.latitude.toFixed(4)}, {shop.longitude.toFixed(4)}
                </a>,
                shop.suspended ? (
                  <span key="status" className="font-semibold text-amber-700 dark:text-amber-400">
                    Suspended {shop.suspendedAt?.toLocaleDateString()}
                  </span>
                ) : (
                  <span key="status" className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Active
                  </span>
                ),
                ...(isAdmin
                  ? [
                      <SuspendActions
                        key="actions"
                        hiddenName="shopId"
                        id={shop.id}
                        label={shop.name}
                        suspended={shop.suspended}
                        eligibleForDeletion={isEligibleForDeletion(shop.suspended, shop.suspendedAt)}
                        suspendAction={adminSuspendShopAction}
                        unsuspendAction={adminUnsuspendShopAction}
                        deleteAction={adminDeleteShopAction}
                      />,
                    ]
                  : []),
              ],
              values: [
                shop.name,
                shop.phone ?? "—",
                shop.owner?.name ?? shop.owner?.email ?? "—",
                shop.products.length,
                `${shop.latitude.toFixed(4)}, ${shop.longitude.toFixed(4)}`,
                shop.suspended
                  ? `Suspended ${shop.suspendedAt?.toLocaleDateString() ?? ""}`
                  : "Active",
                ...(isAdmin ? [""] : []),
              ],
            }))}
          />
        </Panel>
      )}

      {tab === "orders" && (
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Orders</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Completed: <span className="font-semibold text-foreground">{completedOrdersCount}</span>
              {" · "}
              All: <span className="font-semibold text-foreground">{orders.length}</span>
            </p>
          </div>
          <DataTable
            headers={["Item", "Customer", "Place", "Amount", "Status", "Date"]}
            searchPlaceholder="Search all orders"
            emptyText="No orders yet."
            exportFilename="orders"
            rows={orders.map((order) => {
              const item = order.service ?? order.product;
              const placeListing = order.service?.salon ?? order.product?.shop;
              return {
                key: order.id,
                searchText: `${item?.name ?? ""} ${order.customer.name ?? ""} ${order.customer.email ?? ""} ${placeListing?.name ?? ""} ${order.status}`,
                cells: [
                  `${item?.name ?? "Item removed"}${order.product ? ` × ${order.quantity}` : ""}`,
                  order.customer.name ?? order.customer.email,
                  placeListing ? (
                    <span key="place">
                      {placeListing.name}
                      {isVerificationActive(placeListing) && <VerifiedBadge />}
                    </span>
                  ) : (
                    "—"
                  ),
                  `Kes ${order.amountKes}`,
                  order.status,
                  order.createdAt.toLocaleDateString(),
                ],
                values: [
                  `${item?.name ?? "Item removed"}${order.product ? ` × ${order.quantity}` : ""}`,
                  order.customer.name ?? order.customer.email,
                  placeListing?.name ?? "—",
                  order.amountKes,
                  order.status,
                  order.createdAt.toLocaleDateString(),
                ],
              };
            })}
          />
        </Panel>
      )}

      {tab === "adverts" && isAdmin && (
        <Panel className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Adverts</h2>
          <DataTable
            headers={[
              "No.",
              "Product",
              "Description",
              "Owner",
              "Phone",
              "Reach",
              "Package",
              "Campaign window",
              "Status",
              "Searches",
              "Interested",
              "Shares",
              "Share clicks",
              "Orders",
              "Revenue (Kes)",
              "Video",
              "Actions",
            ]}
            searchPlaceholder="Search adverts"
            emptyText="No adverts yet."
            exportFilename="adverts"
            stickyColumns={2}
            stickyColumnWidths={[64, 140]}
            rows={adverts.map((advert) => ({
              key: advert.id,
              searchText: `${advert.serial ?? ""} ${advert.productName} ${advert.description ?? ""} ${advert.owner.name ?? ""} ${advert.owner.email ?? ""} ${advert.phone ?? ""} ${advert.status}`,
              cells: [
                advert.serial != null ? `#${advert.serial}` : "—",
                advert.productName,
                <span
                  key="description"
                  className="block max-w-55 truncate"
                  title={advert.description ?? undefined}
                >
                  {advert.description ?? "—"}
                </span>,
                advert.owner.name ?? advert.owner.email ?? "—",
                advert.phone ?? "—",
                advert.reach === "LOCAL"
                  ? `Local (${advert.radiusKm != null ? `${advert.radiusKm}km` : "any radius"})`
                  : "Global",
                advert.packageDays != null
                  ? `${advert.packageDays}d, ${advert.repeatCount + 1}×/loop`
                  : "—",
                advert.campaignStartsAt ? (
                  <span key="window" className="whitespace-nowrap">
                    {advert.campaignStartsAt.toLocaleDateString()} –{" "}
                    {advert.campaignExpiresAt?.toLocaleDateString() ?? "—"}
                  </span>
                ) : (
                  "Not started"
                ),
                advert.status,
                advert.searchCount,
                advert._count.interests,
                advert._count.shares,
                advert.shareClickCount,
                advert._count.orders,
                advert.orderRevenueKes,
                <a
                  key="video"
                  href={advert.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline"
                >
                  Watch
                </a>,
                advert.status === "PENDING" ? (
                  <div key="actions" className="flex gap-2">
                    <form action={adminSetAdvertStatusAction}>
                      <input type="hidden" name="advertId" value={advert.id} />
                      <input type="hidden" name="status" value="APPROVED" />
                      <SubmitButton
                        pendingText="Approving…"
                        className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
                      >
                        Approve
                      </SubmitButton>
                    </form>
                    <form action={adminSetAdvertStatusAction}>
                      <input type="hidden" name="advertId" value={advert.id} />
                      <input type="hidden" name="status" value="REJECTED" />
                      <SubmitButton
                        pendingText="Rejecting…"
                        className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                      >
                        Reject
                      </SubmitButton>
                    </form>
                  </div>
                ) : advert.status === "APPROVED" ? (
                  <form key="actions" action={adminSetAdvertStatusAction}>
                    <input type="hidden" name="advertId" value={advert.id} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <SubmitButton
                      pendingText="Cancelling…"
                      className="rounded-full border border-red-600/30 px-3 py-1 text-xs font-medium text-red-600 dark:border-red-400/30 dark:text-red-400"
                    >
                      Cancel ad
                    </SubmitButton>
                  </form>
                ) : (
                  "—"
                ),
              ],
              values: [
                advert.serial != null ? `#${advert.serial}` : "—",
                advert.productName,
                advert.description ?? "—",
                advert.owner.name ?? advert.owner.email ?? "—",
                advert.phone ?? "—",
                advert.reach === "LOCAL"
                  ? `Local (${advert.radiusKm != null ? `${advert.radiusKm}km` : "any radius"})`
                  : "Global",
                advert.packageDays != null
                  ? `${advert.packageDays}d, ${advert.repeatCount + 1}x/loop`
                  : "—",
                advert.campaignStartsAt
                  ? `${advert.campaignStartsAt.toLocaleDateString()} - ${advert.campaignExpiresAt?.toLocaleDateString() ?? "—"}`
                  : "Not started",
                advert.status,
                advert.searchCount,
                advert._count.interests,
                advert._count.shares,
                advert.shareClickCount,
                advert._count.orders,
                advert.orderRevenueKes,
                advert.videoUrl,
                advert.status,
              ],
            }))}
          />
        </Panel>
      )}

      {tab === "payments" && isAdmin && (
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Payments</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Received: <span className="font-semibold text-foreground">Kes {moneyReceivedKes}</span>
              {" · "}
              All attempts: <span className="font-semibold text-foreground">{payments.length}</span>
            </p>
          </div>
          <DataTable
            headers={["Purpose", "User", "Phone", "Amount (Kes)", "Status", "Receipt", "Ad", "Date"]}
            searchPlaceholder="Search payments"
            emptyText="No payments yet."
            exportFilename="payments"
            rows={payments.map((payment) => ({
              key: payment.id,
              searchText: `${payment.purpose} ${payment.user.name ?? ""} ${payment.user.email ?? ""} ${payment.phone} ${payment.status} ${payment.mpesaReceiptNumber ?? ""}`,
              cells: [
                payment.purpose === "AD_CAMPAIGN" ? "Ad campaign" : "Verification",
                payment.user.name ?? payment.user.email ?? "—",
                payment.phone,
                payment.amountKes,
                payment.status === "SUCCESS" ? (
                  <span key="status" className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Success
                  </span>
                ) : payment.status === "FAILED" ? (
                  <span key="status" className="font-semibold text-red-600 dark:text-red-400">
                    Failed
                  </span>
                ) : (
                  <span key="status" className="font-semibold text-amber-700 dark:text-amber-400">
                    Pending
                  </span>
                ),
                payment.mpesaReceiptNumber ?? "—",
                payment.advert?.productName ?? "—",
                payment.createdAt.toLocaleDateString(),
              ],
              values: [
                payment.purpose === "AD_CAMPAIGN" ? "Ad campaign" : "Verification",
                payment.user.name ?? payment.user.email ?? "—",
                payment.phone,
                payment.amountKes,
                payment.status,
                payment.mpesaReceiptNumber ?? "—",
                payment.advert?.productName ?? "—",
                payment.createdAt.toLocaleDateString(),
              ],
            }))}
          />
        </Panel>
      )}

      {tab === "roles" && isAdmin && (
        <Panel className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Staff roles</h2>
            <CreateCustomRoleModal action={adminCreateCustomRoleAction} />
          </div>
          <DataTable
            headers={["Name", "Can view", "Staff", "Actions"]}
            searchPlaceholder="Search roles"
            emptyText="No staff roles yet."
            exportFilename="staff-roles"
            rows={customRoles.map((role) => {
              const canView = [
                role.canViewUsers && "Users",
                role.canViewSalons && "Salons",
                role.canViewShops && "Shops",
                role.canViewOrders && "Orders",
              ].filter(Boolean) as string[];
              return {
                key: role.id,
                searchText: role.name,
                cells: [
                  role.name,
                  canView.length > 0 ? canView.join(", ") : "—",
                  role._count.users,
                  <ConfirmDeleteForm
                    key="actions"
                    action={adminDeleteCustomRoleAction}
                    hiddenName="roleId"
                    hiddenValue={role.id}
                    confirmMessage={`Delete the "${role.name}" role? Staff currently assigned to it will lose this access.`}
                  />,
                ],
                values: [role.name, canView.length > 0 ? canView.join(", ") : "—", role._count.users, ""],
              };
            })}
          />
        </Panel>
      )}

      {tab === "verification" && isAdmin && (
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Verification</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Verification is automatic on payment — no review needed. This is just a log; use
              Revoke if a badge needs to be pulled back.
            </p>
          </div>
          <DataTable
            headers={["Listing", "Requested by", "Phone", "Status", "Expires", "Date", "Actions"]}
            searchPlaceholder="Search verification history"
            emptyText="No verification payments yet."
            exportFilename="verification-history"
            stickyColumns={1}
            rows={verificationRequests.map((request) => {
              const listing = request.salon ?? request.shop;
              const listingType = request.salon ? "salon" : "shop";
              const active = listing ? isVerificationActive(listing) : false;
              const expiresAt = listing?.verificationExpiresAt ?? null;
              return {
                key: request.id,
                searchText: `${listing?.name ?? ""} ${request.requestedBy.name ?? ""} ${request.requestedBy.email ?? ""} ${request.phone} ${request.status}`,
                cells: [
                  <span key="listing" className="whitespace-nowrap">
                    {listing?.name ?? "—"}{" "}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      ({listingType})
                    </span>
                  </span>,
                  request.requestedBy.name ?? request.requestedBy.email ?? "—",
                  request.phone,
                  active ? (
                    <span key="status" className="font-semibold text-purple-600 dark:text-purple-400">
                      Verified
                    </span>
                  ) : expiresAt ? (
                    <span key="status" className="font-semibold text-amber-700 dark:text-amber-400">
                      Lapsed
                    </span>
                  ) : (
                    <span key="status" className="text-zinc-500 dark:text-zinc-400">
                      Awaiting payment
                    </span>
                  ),
                  expiresAt ? expiresAt.toLocaleDateString() : "—",
                  request.createdAt.toLocaleDateString(),
                  active && listing ? (
                    <form key="actions" action={adminRevokeVerificationAction}>
                      <input type="hidden" name="listingType" value={listingType} />
                      <input type="hidden" name="listingId" value={listing.id} />
                      <SubmitButton
                        pendingText="Revoking…"
                        className="rounded-full border border-red-600/30 px-3 py-1 text-xs font-medium text-red-600 dark:border-red-400/30 dark:text-red-400"
                      >
                        Revoke
                      </SubmitButton>
                    </form>
                  ) : (
                    "—"
                  ),
                ],
                values: [
                  `${listing?.name ?? "—"} (${listingType})`,
                  request.requestedBy.name ?? request.requestedBy.email ?? "—",
                  request.phone,
                  active ? "Verified" : expiresAt ? "Lapsed" : "Awaiting payment",
                  expiresAt ? expiresAt.toLocaleDateString() : "—",
                  request.createdAt.toLocaleDateString(),
                  "",
                ],
              };
            })}
          />
        </Panel>
      )}

      {tab === "reports" && isAdmin && (
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Issue reports</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Open: <span className="font-semibold text-foreground">{openReportsCount}</span>
              {" · "}
              All: <span className="font-semibold text-foreground">{issueReports.length}</span>
            </p>
          </div>
          <DataTable
            headers={["Reporter", "Email", "Message", "Page", "Status", "Date", "Actions"]}
            searchPlaceholder="Search reports"
            emptyText="No issues reported yet."
            exportFilename="issue-reports"
            stickyColumns={1}
            rows={issueReports.map((report) => ({
              key: report.id,
              searchText: `${report.name ?? ""} ${report.email ?? ""} ${report.reporter?.name ?? ""} ${report.reporter?.email ?? ""} ${report.message} ${report.status}`,
              cells: [
                report.name ?? report.reporter?.name ?? report.reporter?.email ?? "Anonymous",
                report.email ?? report.reporter?.email ?? "—",
                <span key="message" className="block max-w-80 whitespace-pre-wrap">
                  {report.message}
                </span>,
                report.pageUrl ? (
                  <span key="page" className="whitespace-nowrap">
                    {report.pageUrl}
                  </span>
                ) : (
                  "—"
                ),
                report.status === "OPEN" ? (
                  <span key="status" className="font-semibold text-amber-700 dark:text-amber-400">
                    Open
                  </span>
                ) : (
                  <span key="status" className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Resolved
                  </span>
                ),
                report.createdAt.toLocaleDateString(),
                <form key="actions" action={adminSetIssueReportStatusAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={report.status === "OPEN" ? "RESOLVED" : "OPEN"}
                  />
                  <SubmitButton
                    pendingText="Saving…"
                    className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                  >
                    {report.status === "OPEN" ? "Mark resolved" : "Reopen"}
                  </SubmitButton>
                </form>,
              ],
              values: [
                report.name ?? report.reporter?.name ?? report.reporter?.email ?? "Anonymous",
                report.email ?? report.reporter?.email ?? "—",
                report.message,
                report.pageUrl ?? "—",
                report.status,
                report.createdAt.toLocaleDateString(),
                "",
              ],
            }))}
          />
        </Panel>
      )}

      {tab === "analytics" && isAdmin && (
        <Panel className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Site analytics</h2>
          <DailyBarChart title="Site visitors — last 14 days" data={siteVisits} />
        </Panel>
      )}
    </div>
  );
}
