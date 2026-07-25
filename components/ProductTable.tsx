import type { Product } from "@/lib/generated/prisma/client";
import { Photo } from "@/components/Photo";
import { createOrderAction, deleteProductAction, updateProductAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ImageFileInput } from "@/components/ImageFileInput";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

export function ProductTable({
  products,
  mode,
  searchPlaceholder = "Search products",
  emptyText = "No products yet.",
}: {
  products: Product[];
  mode: "owner" | "orderable" | "view";
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  return (
    <DataTable
      headers={["Photo", "Name", "Price (Kes)", "Description", "Action"]}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      exportFilename="products"
      rows={products.map((product) => ({
        key: product.id,
        searchText: `${product.name} ${product.description}`,
        cells: [
          <Photo
            key="photo"
            src={product.imageUrl}
            alt={product.name}
            className="h-12 w-16"
          />,
          product.name,
          product.priceKes,
          <span key="description" className="line-clamp-2 max-w-xs">
            {product.description}
          </span>,
          mode === "orderable" ? (
            <form key="action" className="flex items-center gap-2" action={createOrderAction}>
              <input type="hidden" name="productId" value={product.id} />
              <label className="flex items-center gap-1 text-xs">
                Qty
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue={1}
                  className="w-14 rounded border border-black/[.08] px-2 py-1 dark:border-white/[.145] dark:bg-transparent"
                />
              </label>
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
                title="Edit product"
              >
                <form
                  action={updateProductAction}
                  className="flex flex-col gap-2 text-sm"
                >
                  <input type="hidden" name="productId" value={product.id} />
                  <input
                    name="name"
                    defaultValue={product.name}
                    required
                    className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                  />
                  <textarea
                    name="description"
                    defaultValue={product.description}
                    required
                    className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                  />
                  <input
                    name="priceKes"
                    type="number"
                    min="1"
                    defaultValue={product.priceKes}
                    required
                    className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
                  />
                  <ImageFileInput
                    label="Replace photo (optional)"
                    defaultImageUrl={product.imageUrl}
                  />
                  <SubmitButton
                    pendingText="Saving…"
                    className="self-start rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
                  >
                    Save changes
                  </SubmitButton>
                </form>
              </Modal>
              <form action={deleteProductAction}>
                <input type="hidden" name="productId" value={product.id} />
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
        values: [product.imageUrl, product.name, product.priceKes, product.description, ""],
      }))}
    />
  );
}
