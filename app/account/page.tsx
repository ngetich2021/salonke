import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getLatestVerificationRequest,
  getOwnedSalon,
  getOwnedShop,
  getPendingRoleRequest,
  getUserProfile,
} from "@/lib/dashboard";
import {
  addServiceAction,
  addProductAction,
  createListingAction,
  createAdvertAction,
  updateProfileAction,
  deleteAccountAction,
} from "@/lib/actions";
import { Panel } from "@/components/Panel";
import { ServiceTable } from "@/components/ServiceTable";
import { ProductTable } from "@/components/ProductTable";
import { CustomerOrders } from "@/components/dashboard/CustomerOrders";
import { BrandStats } from "@/components/dashboard/BrandStats";
import { MyAdverts } from "@/components/dashboard/MyAdverts";
import { AdvertAnalytics } from "@/components/dashboard/AdvertAnalytics";
import { CampaignPerformancePanels } from "@/components/dashboard/CampaignPerformancePanels";
import { SubmitButton } from "@/components/SubmitButton";
import { Modal } from "@/components/Modal";
import { ImageFileInput } from "@/components/ImageFileInput";
import { AccountSettings } from "@/components/AccountSettings";
import { VerificationSettings, type VerificationListing } from "@/components/VerificationSettings";
import { AccountTabs } from "@/components/AccountTabs";
import { CreateListingModal } from "@/components/CreateListingModal";
import { CreateAdvertModal } from "@/components/CreateAdvertModal";

const TABS = [
  { key: "services", label: "Services" },
  { key: "products", label: "Products" },
  { key: "orders", label: "Orders" },
  { key: "adverts", label: "Adverts" },
  { key: "visits", label: "Visits" },
  { key: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/account");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  async function respondRoleRequestAction(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user) return;

    const requestId = String(formData.get("requestId"));
    const decision = String(formData.get("decision"));

    const request = await prisma.roleRequest.findUnique({
      where: { id: requestId },
    });
    if (
      !request ||
      request.userId !== current.user.id ||
      request.status !== "PENDING"
    ) {
      return;
    }

    if (decision === "accept") {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: current.user.id },
          data: { role: request.role },
        }),
        prisma.roleRequest.update({
          where: { id: requestId },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        }),
      ]);
    } else {
      await prisma.roleRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
    }
    revalidatePath("/account");
  }

  const pendingRequest = await getPendingRoleRequest(session.user.id);
  const isAdmin = session.user.role === "ADMIN";
  const [ownedSalon, ownedShop] = await Promise.all([
    getOwnedSalon(session.user.id),
    getOwnedShop(session.user.id),
  ]);

  const ownsListing = !!ownedSalon || !!ownedShop;

  const [latestSalonRequest, latestShopRequest] = await Promise.all([
    ownedSalon ? getLatestVerificationRequest({ salonId: ownedSalon.id }) : Promise.resolve(null),
    ownedShop ? getLatestVerificationRequest({ shopId: ownedShop.id }) : Promise.resolve(null),
  ]);
  const verificationListings: VerificationListing[] = [
    ...(ownedSalon
      ? [
          {
            type: "salon" as const,
            id: ownedSalon.id,
            name: ownedSalon.name,
            verified: ownedSalon.verified,
            verifiedAt: ownedSalon.verifiedAt,
            awaitingPayment: latestSalonRequest?.status === "AWAITING_PAYMENT",
          },
        ]
      : []),
    ...(ownedShop
      ? [
          {
            type: "shop" as const,
            id: ownedShop.id,
            name: ownedShop.name,
            verified: ownedShop.verified,
            verifiedAt: ownedShop.verifiedAt,
            awaitingPayment: latestShopRequest?.status === "AWAITING_PAYMENT",
          },
        ]
      : []),
  ];
  const tabs =
    isAdmin && !ownsListing
      ? TABS.filter(({ key }) => key === "settings" || key === "adverts" || key === "visits")
      : TABS;

  const params = await searchParams;
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: Tab = tabs.some(({ key }) => key === tabParam)
    ? (tabParam as Tab)
    : tabs[0].key;

  const profile = await getUserProfile(session.user.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <Panel className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>Signed in as {session.user.name ?? session.user.email}</p>
        <form action={signOutAction}>
          <SubmitButton pendingText="Signing out…" className="text-xs hover:underline">
            Sign out
          </SubmitButton>
        </form>
      </Panel>

      {pendingRequest && (
        <Panel className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            An admin has offered you the{" "}
            <span className="font-semibold">{pendingRequest.role}</span>{" "}
            role.
          </p>
          <div className="flex gap-2">
            <form action={respondRoleRequestAction}>
              <input type="hidden" name="requestId" value={pendingRequest.id} />
              <input type="hidden" name="decision" value="accept" />
              <SubmitButton
                className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background"
              >
                Accept
              </SubmitButton>
            </form>
            <form action={respondRoleRequestAction}>
              <input type="hidden" name="requestId" value={pendingRequest.id} />
              <input type="hidden" name="decision" value="decline" />
              <SubmitButton
                className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium dark:border-white/[.145]"
              >
                Decline
              </SubmitButton>
            </form>
          </div>
        </Panel>
      )}

      <AccountTabs
        tabs={tabs}
        activeTab={tab}
        adminHref={isAdmin || session.user.customRole ? "/admin" : undefined}
      />

      {(!isAdmin || ownsListing) && (
        <>
          {tab === "services" &&
            (ownedSalon ? (
              <Panel className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-semibold">{ownedSalon.name}</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {ownedSalon.centreName} • {ownedSalon.phone}
                  </p>
                </div>

                {ownedSalon.suspended && (
                  <p className="rounded-lg border border-amber-600/30 bg-amber-600/[.06] p-3 text-xs text-amber-700 dark:text-amber-400">
                    This salon is suspended by an admin and won&apos;t appear in customer search
                    until it&apos;s unsuspended.
                  </p>
                )}

                <Modal triggerLabel="Add service" title="Add a service">
                  <form action={addServiceAction} className="flex flex-col gap-3 text-sm">
                    <input
                      name="name"
                      placeholder="Service name"
                      required
                      className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                    />
                    <textarea
                      name="description"
                      placeholder="Description"
                      required
                      className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                    />
                    <input
                      name="priceKes"
                      type="number"
                      min="1"
                      placeholder="Price (Kes)"
                      required
                      className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                    />
                    <ImageFileInput />
                    <SubmitButton
                      pendingText="Adding…"
                      className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
                    >
                      Add service
                    </SubmitButton>
                  </form>
                </Modal>

                <ServiceTable
                  services={ownedSalon.services}
                  mode="owner"
                  searchPlaceholder="Search your services"
                  emptyText="No services yet."
                />
              </Panel>
            ) : (
              <Panel className="flex flex-col gap-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Create or manage your salon listing.
                </p>
                <CreateListingModal
                  triggerLabel="Create shop"
                  initialType="salon"
                  action={createListingAction}
                />
              </Panel>
            ))}

          {tab === "products" &&
            (ownedShop ? (
              <Panel className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-semibold">{ownedShop.name}</h2>
                  {ownedShop.phone && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {ownedShop.phone}
                    </p>
                  )}
                </div>

                {ownedShop.suspended && (
                  <p className="rounded-lg border border-amber-600/30 bg-amber-600/[.06] p-3 text-xs text-amber-700 dark:text-amber-400">
                    This shop is suspended by an admin and won&apos;t appear in customer search
                    until it&apos;s unsuspended.
                  </p>
                )}

                <Modal triggerLabel="Add product" title="Add a product">
                  <form action={addProductAction} className="flex flex-col gap-3 text-sm">
                    <input
                      name="name"
                      placeholder="Product name"
                      required
                      className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                    />
                    <textarea
                      name="description"
                      placeholder="Description"
                      required
                      className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                    />
                    <input
                      name="priceKes"
                      type="number"
                      min="1"
                      placeholder="Price (Kes)"
                      required
                      className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                    />
                    <ImageFileInput />
                    <SubmitButton
                      pendingText="Adding…"
                      className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
                    >
                      Add product
                    </SubmitButton>
                  </form>
                </Modal>

                <ProductTable
                  products={ownedShop.products}
                  mode="owner"
                  searchPlaceholder="Search your products"
                  emptyText="No products yet."
                />
              </Panel>
            ) : (
              <Panel className="flex flex-col gap-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Create or manage your beauty shop listing.
                </p>
                <CreateListingModal
                  triggerLabel="Open shop"
                  initialType="shop"
                  action={createListingAction}
                />
              </Panel>
            ))}

          {tab === "orders" && (
            <div className="flex flex-col gap-6">
              {(ownedSalon || ownedShop) && (
                <Panel>
                  <BrandStats ownerId={session.user.id} />
                </Panel>
              )}
              <Panel>
                <CustomerOrders customerId={session.user.id} />
              </Panel>
            </div>
          )}
        </>
      )}

      {tab === "adverts" && (
        <div className="flex flex-col gap-4">
          <CampaignPerformancePanels ownerId={session.user.id} />

          <Panel className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Advertise a product</h2>
              <CreateAdvertModal
                action={createAdvertAction}
                initialLat={profile.latitude}
                initialLng={profile.longitude}
                initialPhone={profile.phone}
              />
            </div>
            <MyAdverts ownerId={session.user.id} />
          </Panel>
        </div>
      )}

      {tab === "visits" && (
        <Panel className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">Your ad&apos;s visitors</h2>
          <AdvertAnalytics ownerId={session.user.id} />
        </Panel>
      )}

      {tab === "settings" && (
        <Panel className="flex flex-col gap-6">
          <AccountSettings
            phone={profile.phone}
            latitude={profile.latitude}
            longitude={profile.longitude}
            ownsListing={ownsListing}
            updateProfileAction={updateProfileAction}
            deleteAccountAction={deleteAccountAction}
          />
          <VerificationSettings listings={verificationListings} initialPhone={profile.phone} />
        </Panel>
      )}
    </div>
  );
}
