import type { Service } from "@/lib/generated/prisma/client";
import { Photo } from "@/components/Photo";
import { createOrderAction, deleteServiceAction, updateServiceAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ImageFileInput } from "@/components/ImageFileInput";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

export function ServiceTable({
  services,
  mode,
  searchPlaceholder = "Search services",
  emptyText = "No services yet.",
}: {
  services: Service[];
  mode: "owner" | "orderable" | "view";
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  return (
    <DataTable
      headers={["Photo", "Name", "Price (Kes)", "Description", "Action"]}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      exportFilename="services"
      rows={services.map((service) => ({
        key: service.id,
        searchText: `${service.name} ${service.description}`,
        cells: [
          <Photo
            key="photo"
            src={service.imageUrl}
            alt={service.name}
            className="h-12 w-16"
          />,
          service.name,
          service.priceKes,
          <span key="description" className="line-clamp-2 max-w-xs">
            {service.description}
          </span>,
          mode === "orderable" ? (
            <form key="action" action={createOrderAction}>
              <input type="hidden" name="serviceId" value={service.id} />
              <SubmitButton
                pendingText="Ordering…"
                className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
              >
                Order now
              </SubmitButton>
            </form>
          ) : mode === "owner" ? (
            <div key="action" className="flex items-center gap-3">
              <Modal
                triggerLabel="Edit"
                triggerClassName="text-xs font-medium underline"
                title="Edit service"
              >
                <form
                  action={updateServiceAction}
                  className="flex flex-col gap-2 text-sm"
                >
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input
                    name="name"
                    defaultValue={service.name}
                    required
                    className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                  />
                  <textarea
                    name="description"
                    defaultValue={service.description}
                    required
                    className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                  />
                  <input
                    name="priceKes"
                    type="number"
                    min="1"
                    defaultValue={service.priceKes}
                    required
                    className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                  />
                  <ImageFileInput
                    label="Replace photo (optional)"
                    defaultImageUrl={service.imageUrl}
                  />
                  <SubmitButton
                    pendingText="Saving…"
                    className="self-start rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
                  >
                    Save changes
                  </SubmitButton>
                </form>
              </Modal>
              <form action={deleteServiceAction}>
                <input type="hidden" name="serviceId" value={service.id} />
                <SubmitButton
                  pendingText="Deleting…"
                  className="text-xs font-medium text-red-600 underline dark:text-red-400"
                >
                  Delete
                </SubmitButton>
              </form>
            </div>
          ) : null,
        ],
        values: [service.imageUrl, service.name, service.priceKes, service.description, ""],
      }))}
    />
  );
}
