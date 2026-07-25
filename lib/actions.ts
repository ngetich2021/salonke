"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CoordinatesSchema,
  CreateAdvertSchema,
  CreateItemSchema,
  CreateListingSchema,
  CreateOrderSchema,
  CustomRoleNameSchema,
  IssueReportSchema,
  OrderQuantitySchema,
  RenewAdCampaignSchema,
  RequestVerificationSchema,
  UpdateProfileSchema,
} from "@/lib/validations";
import { getOwnedSalon, getOwnedShop } from "@/lib/dashboard";
import { getShopsForAdvert } from "@/lib/nearest";
import { isEligibleForDeletion, SUSPENSION_DELETE_ELIGIBLE_DAYS } from "@/lib/suspension";
import { haversineKm } from "@/lib/geo";
import { uploadImage, uploadVideo, deleteVideo } from "@/lib/cloudinary";
import { extractYouTubeId } from "@/lib/youtube";
import { sendMail } from "@/lib/mail";
import { runAfterResponse } from "@/lib/jobs";
import { chargeAdCampaign, activateOrExtendCampaign } from "@/lib/campaign";
import { chargeVerification } from "@/lib/verification";
import { queryStkStatus } from "@/lib/mpesa";
import { applyStkResult } from "@/lib/payments";
import type { Role } from "@/lib/generated/prisma/client";
import type { CreateListingState } from "@/components/CreateListingForm";

const MAX_ADVERT_VIDEO_SECONDS = 30;

const ASSIGNABLE_ROLES: Role[] = ["CUSTOMER", "BRAND", "ADMIN"];

export async function createListingAction(
  _prevState: CreateListingState,
  formData: FormData
): Promise<CreateListingState> {
  const current = await auth();
  if (!current?.user) {
    return { error: "Not authorized." };
  }
  if (current.user.role !== "BRAND" && current.user.role !== "CUSTOMER") {
    return { error: "Not authorized." };
  }

  const parsed = CreateListingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      error: firstIssue
        ? `${firstIssue.path.join(".") || "form"}: ${firstIssue.message}`
        : "Invalid listing details.",
    };
  }
  const data = parsed.data;
  const wantsSalon = data.type === "salon" || data.type === "both";
  const wantsShop = data.type === "shop" || data.type === "both";

  if (wantsSalon && (!data.contactName || !data.centreName)) {
    return { error: "Contact name and centre name are required for a salon." };
  }

  if (wantsSalon) {
    const existing = await getOwnedSalon(current.user.id);
    if (existing) return { error: "You already have a salon listing." };
    await prisma.salon.create({
      data: {
        ownerId: current.user.id,
        name: data.name,
        contactName: data.contactName!,
        centreName: data.centreName!,
        phone: data.phone,
        whatsappNumber: data.whatsappNumber || null,
        tiktokUrl: data.tiktokUrl || null,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

  if (wantsShop) {
    const existing = await getOwnedShop(current.user.id);
    if (existing) return { error: "You already have a shop listing." };
    await prisma.shop.create({
      data: {
        ownerId: current.user.id,
        name: data.name,
        phone: data.phone,
        whatsappNumber: data.whatsappNumber || null,
        tiktokUrl: data.tiktokUrl || null,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

  if (current.user.role === "CUSTOMER") {
    await prisma.user.update({
      where: { id: current.user.id },
      data: { role: "BRAND" },
    });
  }

  if (wantsSalon) revalidateTag("salons", { expire: 0 });
  if (wantsShop) revalidateTag("shops", { expire: 0 });
  revalidatePath("/account");
  revalidatePath("/salons");
  revalidatePath("/shops");
  return { success: true };
}

export async function addServiceAction(formData: FormData) {
  const current = await auth();
  if (!current?.user || current.user.role !== "BRAND") {
    throw new Error("Not authorized");
  }
  const salon = await getOwnedSalon(current.user.id);
  if (!salon) {
    throw new Error("No salon found for this account");
  }

  const parsed = CreateItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid service details");
  }

  const image = formData.get("image");
  const imageUrl =
    image instanceof File && image.size > 0 ? await uploadImage(image) : null;

  await prisma.service.create({
    data: { salonId: salon.id, ...parsed.data, imageUrl },
  });
  revalidateTag("salons", { expire: 0 });
  revalidatePath("/salons");
  revalidatePath("/account");
}

export async function addProductAction(formData: FormData) {
  const current = await auth();
  if (!current?.user || current.user.role !== "BRAND") {
    throw new Error("Not authorized");
  }
  const shop = await getOwnedShop(current.user.id);
  if (!shop) {
    throw new Error("No shop found for this account");
  }

  const parsed = CreateItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid product details");
  }

  const image = formData.get("image");
  const imageUrl =
    image instanceof File && image.size > 0 ? await uploadImage(image) : null;

  await prisma.product.create({
    data: { shopId: shop.id, ...parsed.data, imageUrl },
  });
  revalidateTag("shops", { expire: 0 });
  revalidatePath("/shops");
  revalidatePath("/account");
}

export async function updateServiceAction(formData: FormData) {
  const current = await auth();
  if (!current?.user || current.user.role !== "BRAND") {
    throw new Error("Not authorized");
  }
  const salon = await getOwnedSalon(current.user.id);
  if (!salon) {
    throw new Error("No salon found for this account");
  }

  const serviceId = String(formData.get("serviceId"));
  if (!salon.services.some((service) => service.id === serviceId)) {
    throw new Error("Service not found");
  }

  const parsed = CreateItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid service details");
  }

  const image = formData.get("image");
  const imageUrl =
    image instanceof File && image.size > 0 ? await uploadImage(image) : undefined;

  await prisma.service.update({
    where: { id: serviceId },
    data: { ...parsed.data, ...(imageUrl ? { imageUrl } : {}) },
  });
  revalidateTag("salons", { expire: 0 });
  revalidatePath("/salons");
  revalidatePath("/account");
}

export async function updateProductAction(formData: FormData) {
  const current = await auth();
  if (!current?.user || current.user.role !== "BRAND") {
    throw new Error("Not authorized");
  }
  const shop = await getOwnedShop(current.user.id);
  if (!shop) {
    throw new Error("No shop found for this account");
  }

  const productId = String(formData.get("productId"));
  if (!shop.products.some((product) => product.id === productId)) {
    throw new Error("Product not found");
  }

  const parsed = CreateItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid product details");
  }

  const image = formData.get("image");
  const imageUrl =
    image instanceof File && image.size > 0 ? await uploadImage(image) : undefined;

  await prisma.product.update({
    where: { id: productId },
    data: { ...parsed.data, ...(imageUrl ? { imageUrl } : {}) },
  });
  revalidateTag("shops", { expire: 0 });
  revalidatePath("/shops");
  revalidatePath("/account");
}

export async function deleteServiceAction(formData: FormData) {
  const current = await auth();
  if (!current?.user || current.user.role !== "BRAND") {
    throw new Error("Not authorized");
  }
  const salon = await getOwnedSalon(current.user.id);
  if (!salon) {
    throw new Error("No salon found for this account");
  }

  const serviceId = String(formData.get("serviceId"));
  if (!salon.services.some((service) => service.id === serviceId)) {
    throw new Error("Service not found");
  }

  await prisma.service.delete({ where: { id: serviceId } });
  revalidateTag("salons", { expire: 0 });
  revalidatePath("/salons");
  revalidatePath("/account");
}

export async function deleteProductAction(formData: FormData) {
  const current = await auth();
  if (!current?.user || current.user.role !== "BRAND") {
    throw new Error("Not authorized");
  }
  const shop = await getOwnedShop(current.user.id);
  if (!shop) {
    throw new Error("No shop found for this account");
  }

  const productId = String(formData.get("productId"));
  if (!shop.products.some((product) => product.id === productId)) {
    throw new Error("Product not found");
  }

  await prisma.product.delete({ where: { id: productId } });
  revalidateTag("shops", { expire: 0 });
  revalidatePath("/shops");
  revalidatePath("/account");
}

export async function createOrderAction(formData: FormData) {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const productId = formData.get("productId");
  const serviceId = formData.get("serviceId");

  if (typeof productId === "string" && productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found");

    const parsed = CreateOrderSchema.safeParse({
      quantity: formData.get("quantity") || 1,
      latitude: formData.get("latitude") || undefined,
      longitude: formData.get("longitude") || undefined,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid order details");
    }
    const { quantity, latitude, longitude } = parsed.data;

    // Present only when this order came from an advert's "Interested"
    // shop-match list (AdvertPlayer) — lets ad-campaign effectiveness be
    // reported without affecting ordinary product orders (ProductTable),
    // which never send these fields.
    const advertIdRaw = formData.get("advertId");
    const advertId = typeof advertIdRaw === "string" && advertIdRaw ? advertIdRaw : undefined;

    await prisma.order.create({
      data: {
        customerId: current.user.id,
        productId: product.id,
        quantity,
        amountKes: product.priceKes * quantity,
        advertId,
        latitude,
        longitude,
      },
    });
  } else if (typeof serviceId === "string" && serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new Error("Service not found");
    await prisma.order.create({
      data: {
        customerId: current.user.id,
        serviceId: service.id,
        amountKes: service.priceKes,
      },
    });
  } else {
    throw new Error("Missing product or service");
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function updateOrderQuantityAction(formData: FormData) {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const orderId = String(formData.get("orderId"));
  const parsedQuantity = OrderQuantitySchema.safeParse(formData.get("quantity") || 1);
  if (!parsedQuantity.success) {
    throw new Error(parsedQuantity.error.issues[0]?.message ?? "Invalid quantity");
  }
  const quantity = parsedQuantity.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: true },
  });
  if (!order) {
    throw new Error("Order not found");
  }
  if (order.customerId !== current.user.id) {
    throw new Error("Not authorized");
  }
  if (!order.product) {
    throw new Error("Quantity only applies to product orders");
  }
  if (order.status !== "PENDING" && order.status !== "ACCEPTED") {
    throw new Error("Order can no longer be changed");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { quantity, amountKes: order.product.priceKes * quantity },
  });

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function updateProfileAction(formData: FormData) {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const parsed = UpdateProfileSchema.safeParse({
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    throw new Error("Invalid phone number");
  }

  const latRaw = String(formData.get("latitude") ?? "").trim();
  const lngRaw = String(formData.get("longitude") ?? "").trim();
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (latRaw && lngRaw) {
    const coords = CoordinatesSchema.safeParse({ lat: latRaw, lng: lngRaw });
    if (!coords.success) {
      throw new Error("Invalid location");
    }
    latitude = coords.data.lat;
    longitude = coords.data.lng;
  }

  const phone = parsed.data.phone || null;

  await prisma.user.update({
    where: { id: current.user.id },
    data: { phone, latitude, longitude },
  });

  // Salon/Shop require a non-null phone and coordinates, so only propagate
  // fields the user actually set — an empty phone or unset location here
  // just means "no personal contact info," not "clear my listing's."
  const listingUpdate: { phone?: string; latitude?: number; longitude?: number } = {};
  if (phone) listingUpdate.phone = phone;
  if (latitude != null && longitude != null) {
    listingUpdate.latitude = latitude;
    listingUpdate.longitude = longitude;
  }

  if (Object.keys(listingUpdate).length > 0) {
    await prisma.$transaction([
      prisma.salon.updateMany({ where: { ownerId: current.user.id }, data: listingUpdate }),
      prisma.shop.updateMany({ where: { ownerId: current.user.id }, data: listingUpdate }),
    ]);
    revalidateTag("salons", { expire: 0 });
    revalidateTag("shops", { expire: 0 });
  }
  // A moved location can change which viewers a LOCAL advert's radius
  // reaches — the cached approved-adverts list embeds the owner's lat/lng.
  if (latitude != null && longitude != null) {
    revalidateTag("approved-adverts", { expire: 0 });
  }

  revalidatePath("/account");
  revalidatePath("/salons");
  revalidatePath("/shops");
}

export async function deleteAccountAction() {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  await prisma.$transaction([
    prisma.salon.deleteMany({ where: { ownerId: current.user.id } }),
    prisma.shop.deleteMany({ where: { ownerId: current.user.id } }),
    prisma.user.delete({ where: { id: current.user.id } }),
  ]);
  revalidateTag("salons", { expire: 0 });
  revalidateTag("shops", { expire: 0 });
  revalidateTag("approved-adverts", { expire: 0 });

  await signOut({ redirectTo: "/" });
}

const ASSIGNABLE_STATUSES = ["ACCEPTED", "COMPLETED", "CANCELLED"] as const;

export async function updateOrderStatusAction(formData: FormData) {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status"));
  if (!ASSIGNABLE_STATUSES.includes(status as (typeof ASSIGNABLE_STATUSES)[number])) {
    throw new Error("Invalid status");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      service: { include: { salon: true } },
      product: { include: { shop: true } },
    },
  });
  if (!order) {
    throw new Error("Order not found");
  }

  const ownerId = order.service?.salon.ownerId ?? order.product?.shop.ownerId;
  const isOwner = !!ownerId && ownerId === current.user.id;
  const isAdmin = current.user.role === "ADMIN";
  const isCustomer = order.customerId === current.user.id;

  const isAllowed = isOwner || isAdmin || (isCustomer && status === "CANCELLED");
  if (!isAllowed) {
    throw new Error("Not authorized");
  }
  if (order.status !== "PENDING" && order.status !== "ACCEPTED") {
    throw new Error("Order can no longer be changed");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: status as (typeof ASSIGNABLE_STATUSES)[number] },
  });

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/");
}

async function requireAdmin() {
  const current = await auth();
  if (!current?.user || current.user.role !== "ADMIN") {
    throw new Error("Not authorized");
  }
  return current.user;
}

export async function adminDeleteUserAction(formData: FormData) {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId"));
  if (userId === admin.id) {
    throw new Error("Use account settings to delete your own account");
  }

  await prisma.$transaction([
    prisma.salon.deleteMany({ where: { ownerId: userId } }),
    prisma.shop.deleteMany({ where: { ownerId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  revalidateTag("salons", { expire: 0 });
  revalidateTag("shops", { expire: 0 });
  revalidateTag("approved-adverts", { expire: 0 });

  revalidatePath("/admin");
}

export async function adminSuspendSalonAction(formData: FormData) {
  await requireAdmin();

  const salonId = String(formData.get("salonId"));
  await prisma.salon.update({
    where: { id: salonId },
    data: { suspended: true, suspendedAt: new Date() },
  });
  revalidateTag("salons", { expire: 0 });

  revalidatePath("/admin");
  revalidatePath("/salons");
}

export async function adminUnsuspendSalonAction(formData: FormData) {
  await requireAdmin();

  const salonId = String(formData.get("salonId"));
  await prisma.salon.update({
    where: { id: salonId },
    data: { suspended: false, suspendedAt: null },
  });
  revalidateTag("salons", { expire: 0 });

  revalidatePath("/admin");
  revalidatePath("/salons");
}

// Only reachable once a salon has been suspended for 3+ months — admins
// can otherwise only suspend/unsuspend a listing, never delete it outright.
export async function adminDeleteSalonAction(formData: FormData) {
  await requireAdmin();

  const salonId = String(formData.get("salonId"));
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) {
    throw new Error("Salon not found");
  }
  if (!isEligibleForDeletion(salon.suspended, salon.suspendedAt)) {
    throw new Error(
      `Salon must be suspended for ${SUSPENSION_DELETE_ELIGIBLE_DAYS} days before it can be deleted`
    );
  }

  await prisma.salon.delete({ where: { id: salonId } });
  revalidateTag("salons", { expire: 0 });

  revalidatePath("/admin");
  revalidatePath("/salons");
}

export async function adminSuspendShopAction(formData: FormData) {
  await requireAdmin();

  const shopId = String(formData.get("shopId"));
  await prisma.shop.update({
    where: { id: shopId },
    data: { suspended: true, suspendedAt: new Date() },
  });
  revalidateTag("shops", { expire: 0 });

  revalidatePath("/admin");
  revalidatePath("/shops");
}

export async function adminUnsuspendShopAction(formData: FormData) {
  await requireAdmin();

  const shopId = String(formData.get("shopId"));
  await prisma.shop.update({
    where: { id: shopId },
    data: { suspended: false, suspendedAt: null },
  });
  revalidateTag("shops", { expire: 0 });

  revalidatePath("/admin");
  revalidatePath("/shops");
}

// Only reachable once a shop has been suspended for 3+ months — see
// adminDeleteSalonAction above.
export async function adminDeleteShopAction(formData: FormData) {
  await requireAdmin();

  const shopId = String(formData.get("shopId"));
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new Error("Shop not found");
  }
  if (!isEligibleForDeletion(shop.suspended, shop.suspendedAt)) {
    throw new Error(
      `Shop must be suspended for ${SUSPENSION_DELETE_ELIGIBLE_DAYS} days before it can be deleted`
    );
  }

  await prisma.shop.delete({ where: { id: shopId } });
  revalidateTag("shops", { expire: 0 });

  revalidatePath("/admin");
  revalidatePath("/shops");
}

export async function adminOfferRoleAction(formData: FormData) {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId"));
  const role = String(formData.get("role"));
  if (userId === admin.id) {
    throw new Error("Use account settings to manage your own account");
  }
  if (!ASSIGNABLE_ROLES.includes(role as Role)) {
    throw new Error("Invalid role");
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    throw new Error("User not found");
  }
  if (target.role === role) {
    throw new Error("User already has this role");
  }

  const existing = await prisma.roleRequest.findFirst({
    where: { userId, status: "PENDING" },
  });
  if (existing) {
    await prisma.roleRequest.update({
      where: { id: existing.id },
      data: { role: role as Role, createdAt: new Date() },
    });
  } else {
    await prisma.roleRequest.create({
      data: { userId, role: role as Role },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/account");
}

export async function adminCancelRoleRequestAction(formData: FormData) {
  await requireAdmin();

  const requestId = String(formData.get("requestId"));
  const request = await prisma.roleRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") {
    return;
  }

  await prisma.roleRequest.delete({ where: { id: requestId } });

  revalidatePath("/admin");
  revalidatePath("/account");
}

export async function adminCreateCustomRoleAction(formData: FormData) {
  await requireAdmin();

  const parsedName = CustomRoleNameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    throw new Error(parsedName.error.issues[0]?.message ?? "Invalid role name");
  }

  await prisma.customRole.create({
    data: {
      name: parsedName.data,
      canViewUsers: formData.get("canViewUsers") === "on",
      canViewSalons: formData.get("canViewSalons") === "on",
      canViewShops: formData.get("canViewShops") === "on",
      canViewOrders: formData.get("canViewOrders") === "on",
    },
  });

  revalidatePath("/admin");
}

export async function adminDeleteCustomRoleAction(formData: FormData) {
  await requireAdmin();

  const roleId = String(formData.get("roleId"));
  await prisma.$transaction([
    prisma.user.updateMany({ where: { customRoleId: roleId }, data: { customRoleId: null } }),
    prisma.customRole.delete({ where: { id: roleId } }),
  ]);

  revalidatePath("/admin");
}

export async function adminAssignCustomRoleAction(formData: FormData) {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId"));
  const roleId = String(formData.get("roleId") ?? "");
  if (userId === admin.id) {
    throw new Error("Use account settings to manage your own account");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { customRoleId: roleId || null },
  });

  revalidatePath("/admin");
}

export async function createAdvertAction(formData: FormData): Promise<{ paymentId: string }> {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const parsed = CreateAdvertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid advert details");
  }

  const reach = formData.get("reach") === "GLOBAL" ? "GLOBAL" : "LOCAL";

  const radiusRaw = String(formData.get("radiusKm") ?? "").trim();
  const radiusKm = radiusRaw ? Number(radiusRaw) : null;
  if (radiusKm != null && (!Number.isFinite(radiusKm) || radiusKm <= 0)) {
    throw new Error("Invalid radius");
  }

  const youtubeUrlRaw = parsed.data.videoUrl?.trim();
  const videoFile = formData.get("video");
  const hasYoutubeLink = !!youtubeUrlRaw;
  const hasVideoFile = videoFile instanceof File && videoFile.size > 0;

  if (hasYoutubeLink === hasVideoFile) {
    throw new Error(
      hasYoutubeLink
        ? "Provide either a YouTube link or a video file, not both"
        : "A video is required"
    );
  }

  let videoUrl: string;
  if (hasYoutubeLink) {
    const videoId = extractYouTubeId(youtubeUrlRaw!);
    if (!videoId) {
      throw new Error("Enter a valid YouTube video URL");
    }
    videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  } else {
    const { url, publicId, durationSeconds } = await uploadVideo(videoFile as File);
    if (durationSeconds > MAX_ADVERT_VIDEO_SECONDS) {
      await deleteVideo(publicId);
      throw new Error(`Video must be ${MAX_ADVERT_VIDEO_SECONDS} seconds or shorter`);
    }
    videoUrl = url;
  }

  const { _max } = await prisma.advert.aggregate({ _max: { serial: true } });
  const serial = (_max.serial ?? 100) + 1;

  const writes = [];

  if (reach === "LOCAL") {
    const coords = CoordinatesSchema.safeParse({
      lat: formData.get("latitude"),
      lng: formData.get("longitude"),
    });
    if (!coords.success) {
      throw new Error("Location is required for a local ad");
    }
    writes.push(
      prisma.user.update({
        where: { id: current.user.id },
        data: { latitude: coords.data.lat, longitude: coords.data.lng },
      })
    );
  }

  writes.push(
    prisma.advert.create({
      data: {
        ownerId: current.user.id,
        productName: parsed.data.productName,
        description: parsed.data.description || null,
        phone: parsed.data.phone,
        videoUrl,
        reach,
        radiusKm: reach === "LOCAL" ? radiusKm : null,
        serial,
        packageDays: parsed.data.packageDays,
        repeatCount: parsed.data.repeatCount,
      },
    })
  );

  const results = await prisma.$transaction(writes);
  const advert = results[results.length - 1] as { id: string; productName: string };

  const { paymentId } = await chargeAdCampaign({
    advertId: advert.id,
    userId: current.user.id,
    phone: parsed.data.phone,
    packageDays: parsed.data.packageDays,
    repeatCount: parsed.data.repeatCount,
    productName: advert.productName,
  });

  revalidatePath("/account");
  return { paymentId };
}

// Lets an advertiser pay again to continue an already-approved ad campaign
// (new package terms are allowed, e.g. more days or repeats) — deliberately
// does NOT touch Advert.status, so this never re-enters admin review.
// activateOrExtendCampaign (fired from the M-Pesa callback once this
// Payment confirms) is what actually extends campaignExpiresAt.
export async function renewAdCampaignAction(formData: FormData): Promise<{ paymentId: string }> {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const advertId = String(formData.get("advertId"));
  const advert = await prisma.advert.findUnique({ where: { id: advertId } });
  if (!advert || advert.ownerId !== current.user.id) {
    throw new Error("Advert not found");
  }
  if (advert.status !== "APPROVED") {
    throw new Error("Only an already-approved ad can be renewed");
  }

  const parsed = RenewAdCampaignSchema.safeParse({
    packageDays: formData.get("packageDays"),
    repeatCount: formData.get("repeatCount"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid renewal details");
  }
  const { packageDays, repeatCount, phone } = parsed.data;

  await prisma.advert.update({ where: { id: advertId }, data: { packageDays, repeatCount } });
  // advert.status is already known APPROVED (checked above) — the global ad
  // reel's getApprovedAdverts() is cached indefinitely and keyed off this
  // tag, so without this a renewed repeatCount/packageDays would update the
  // row in the database but the live reel would keep showing the ad at its
  // pre-renewal repeat count until something else happened to invalidate it.
  revalidateTag("approved-adverts", { expire: 0 });

  const { paymentId } = await chargeAdCampaign({
    advertId,
    userId: current.user.id,
    phone,
    packageDays,
    repeatCount,
    productName: advert.productName,
  });

  revalidatePath("/account");
  return { paymentId };
}

export async function deleteAdvertAction(formData: FormData) {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const advertId = String(formData.get("advertId"));
  const advert = await prisma.advert.findUnique({ where: { id: advertId } });
  if (!advert || advert.ownerId !== current.user.id) {
    throw new Error("Advert not found");
  }

  await prisma.advert.delete({ where: { id: advertId } });
  if (advert.status === "APPROVED") revalidateTag("approved-adverts", { expire: 0 });
  revalidatePath("/account");
}

export async function findShopsForAdvertAction(
  advertId: string,
  lat: number | null,
  lng: number | null
) {
  const { advert, matches } = await getShopsForAdvert(advertId, lat, lng);
  if (!advert) {
    return { reach: null as null, matches: [] };
  }

  return {
    reach: advert.reach,
    matches: matches.map((m) => ({
      shopId: m.shop.id,
      shopName: m.shop.name,
      phone: m.shop.phone,
      whatsappNumber: m.shop.whatsappNumber,
      tiktokUrl: m.shop.tiktokUrl,
      productId: m.product.id,
      productName: m.product.name,
      priceKes: m.product.priceKes,
      distanceKm: m.distanceKm,
    })),
  };
}

// Fired when a viewer taps "Interested" on an advert (which also triggers
// the shop search above) — powers the admin campaign-effectiveness view.
// Anonymous-callable, same as findShopsForAdvertAction: the reel is shown to
// signed-out visitors too.
export async function recordAdvertInterestAction(
  advertId: string,
  lat: number | null,
  lng: number | null
) {
  const current = await auth();
  const advert = await prisma.advert.findUnique({
    where: { id: advertId },
    include: { owner: true },
  });
  if (!advert) return;

  const distanceKm =
    lat != null && lng != null && advert.owner.latitude != null && advert.owner.longitude != null
      ? haversineKm(lat, lng, advert.owner.latitude, advert.owner.longitude)
      : null;

  await prisma.advertInterest.create({
    data: {
      advertId,
      userId: current?.user?.id ?? null,
      latitude: lat,
      longitude: lng,
      distanceKm,
    },
  });
}

// Fired the moment a viewer clicks any share option (native share sheet, a
// platform link, or copy-link) — counts as "shared" regardless of what they
// do afterward, since a browser can't reliably confirm completion once a
// platform's own share window opens. Anonymous-callable, same as the other
// advert-engagement actions. The returned id becomes the `ref` on the
// tracked link, so a later open of that link can be counted as a completed,
// "shared fully" reach via recordAdvertShareClickAction below.
export async function recordAdvertShareAction(advertId: string, platform: string) {
  const current = await auth();
  const share = await prisma.advertShare.create({
    data: { advertId, platform, userId: current?.user?.id ?? null },
  });
  return { shareId: share.id };
}

// Fired when someone opens a tracked share link (?ref=<shareId>) — this is
// the "shared fully" signal: proof the share actually reached another
// viewer, not just that the sharer clicked a button.
export async function recordAdvertShareClickAction(shareId: string) {
  await prisma.advertShare
    .update({ where: { id: shareId }, data: { clickCount: { increment: 1 } } })
    .catch(() => {});
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

const SITE_VISIT_COOKIE = "sk_visited";

// Fired on every page load (see VisitTracker) — powers the admin-only "site
// visitors by day" panel. Counts a device once per UTC day no matter how
// many pages it visits that day (a cookie remembers the last day this
// device was already counted), so someone browsing 50 times in one day
// shows up as 1 visitor for that day, not 50. Anonymous-callable and
// best-effort: a failed write must never surface to the visitor or block
// rendering.
export async function recordSiteVisitAction() {
  const date = todayUtc();
  const cookieStore = await cookies();
  if (cookieStore.get(SITE_VISIT_COOKIE)?.value === date) {
    return;
  }

  await prisma.dailyVisit
    .upsert({ where: { date }, create: { date, count: 1 }, update: { count: { increment: 1 } } })
    .catch(() => {});

  cookieStore.set(SITE_VISIT_COOKIE, date, {
    maxAge: 60 * 60 * 24 * 400, // ~400 days — the practical browser cap on cookie lifetime
    sameSite: "lax",
  });
}

// Fired whenever an advert becomes the one showing in the media player (see
// AdvertPlayer) — powers the advertiser-facing "your ad's visitors by day"
// panel. Same best-effort, anonymous-callable shape as recordSiteVisitAction.
export async function recordAdvertViewAction(advertId: string) {
  const date = todayUtc();
  await prisma.advertDailyView
    .upsert({
      where: { advertId_date: { advertId, date } },
      create: { advertId, date, count: 1 },
      update: { count: { increment: 1 } },
    })
    .catch(() => {});
}

// Admin-only status changes. Unlike order/role transitions elsewhere, this is
// intentionally allowed from any current status — an admin can reject a
// pending ad, or pull ("cancel") one that's already APPROVED and live (e.g.
// a broken video, or just at their discretion) at any time.
export async function adminSetAdvertStatusAction(formData: FormData) {
  await requireAdmin();

  const advertId = String(formData.get("advertId"));
  const status = String(formData.get("status"));
  if (status !== "APPROVED" && status !== "REJECTED" && status !== "CANCELLED") {
    throw new Error("Invalid status");
  }

  // No free tier: an ad can only go live once its campaign package has
  // actually been paid for (STK push confirmed via the M-Pesa callback) —
  // this is the enforcement point, since createAdvertAction always charges
  // on submission but the confirmation itself arrives asynchronously.
  const successfulPayment =
    status === "APPROVED"
      ? await prisma.payment.findFirst({
          where: { advertId, purpose: "AD_CAMPAIGN", status: "SUCCESS" },
          orderBy: { createdAt: "desc" },
        })
      : null;
  if (status === "APPROVED" && !successfulPayment) {
    throw new Error("Cannot approve — payment for this ad campaign hasn't been confirmed yet");
  }

  const advert = await prisma.advert.update({
    where: { id: advertId },
    data: { status },
    include: { owner: true },
  });
  revalidateTag("approved-adverts", { expire: 0 });

  if (status === "APPROVED" && successfulPayment) {
    await activateOrExtendCampaign(advert, successfulPayment);
  }

  if (status === "APPROVED" && advert.owner.email) {
    const to = advert.owner.email;
    const productName = advert.productName;
    // Deferred until after the response is sent — an SMTP round-trip (or a
    // failure in one) must never block this action or the revalidation
    // below, which is what made approving several adverts back-to-back feel
    // slow and made some approvals silently skip their revalidation.
    runAfterResponse(
      () =>
        sendMail({
          to,
          subject: "Your advert is live",
          text: `Good news — your advert for "${productName}" has been approved and is now live for customers to find.`,
        }),
      "advert-approved-email"
    );
  }

  revalidatePath("/admin");
  revalidatePath("/shops");
}

// Polled by components/PaymentPoller.tsx while an STK push is in flight —
// Safaricom's confirmation arrives asynchronously at
// app/api/mpesa/callback/route.ts, so the client has nothing to await
// directly and just checks back every few seconds. Scoped to the
// payment's own owner so a guessed/leaked id can't be used to snoop on
// someone else's payment status.
export async function getPaymentStatusAction(paymentId: string) {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== current.user.id) {
    throw new Error("Payment not found");
  }

  // The M-Pesa callback (app/api/mpesa/callback/route.ts) is the primary
  // confirmation path, but it depends on MPESA_CALLBACK_URL actually being
  // reachable from the internet (a dev ngrok tunnel dropping is enough to
  // break it) — so a still-PENDING payment actively asks Safaricom directly
  // as a fallback instead of polling a row that'll never change on its own.
  // Best-effort: a query failure just means "still don't know," not an
  // error surfaced to the poller.
  if (payment.status === "PENDING" && payment.checkoutRequestId) {
    try {
      const result = await queryStkStatus(payment.checkoutRequestId);
      if (result) {
        const resolved = await applyStkResult(result);
        if (resolved) return { status: resolved.status };
      }
    } catch {
      // fall through to the stale status below
    }
  }

  return { status: payment.status };
}

// Lets a salon or shop owner get their own listing verified from account
// settings — just phone + payment, no document or admin review; paying IS
// the verification (see markVerificationPaymentPaid). One request at a time
// per listing — a listing that's already verified, or already has a
// payment in flight, can't submit another until that resolves.
export async function requestVerificationAction(formData: FormData) {
  const current = await auth();
  if (!current?.user) {
    throw new Error("Not authorized");
  }

  const parsed = RequestVerificationSchema.safeParse({
    listingType: formData.get("listingType"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { listingType, phone } = parsed.data;

  const listing =
    listingType === "salon"
      ? await getOwnedSalon(current.user.id)
      : await getOwnedShop(current.user.id);
  if (!listing) {
    throw new Error(`You don't own a ${listingType}`);
  }
  if (listing.verified) {
    throw new Error("This listing is already verified");
  }

  const existing = await prisma.verificationRequest.findFirst({
    where: {
      [listingType === "salon" ? "salonId" : "shopId"]: listing.id,
      status: { in: ["AWAITING_PAYMENT", "PENDING"] },
    },
  });
  if (existing) {
    throw new Error("A verification request for this listing is already in progress");
  }

  const { paymentId } = await chargeVerification({
    userId: current.user.id,
    salonId: listingType === "salon" ? listing.id : undefined,
    shopId: listingType === "shop" ? listing.id : undefined,
    phone,
    listingName: listing.name,
  });

  return { paymentId };
}

// Admin-only: revokes a verified badge (e.g. the listing turned out to be
// misrepresented, or is being abused) — verification itself is automatic on
// payment (see markVerificationPaymentPaid), so there's nothing to approve
// here, only an override to take it back.
export async function adminRevokeVerificationAction(formData: FormData) {
  await requireAdmin();

  const listingType = String(formData.get("listingType"));
  const listingId = String(formData.get("listingId"));
  if (listingType !== "salon" && listingType !== "shop") {
    throw new Error("Invalid listing");
  }

  if (listingType === "salon") {
    await prisma.salon.update({ where: { id: listingId }, data: { verified: false } });
  } else {
    await prisma.shop.update({ where: { id: listingId }, data: { verified: false } });
  }

  revalidatePath("/admin");
  revalidatePath("/salons");
  revalidatePath("/shops");
}

// Anyone can file one — anonymous visitors included, so this deliberately
// doesn't require auth. Logged-in reporters get linked (reporterId) so an
// admin can follow up via their account; name/email are still accepted
// separately since an anonymous reporter has no account to pull those from.
export async function submitIssueReportAction(formData: FormData): Promise<{ success: true }> {
  const current = await auth();
  const parsed = IssueReportSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    pageUrl: formData.get("pageUrl"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid report");
  }

  await prisma.issueReport.create({
    data: {
      reporterId: current?.user?.id ?? null,
      name: parsed.data.name || current?.user?.name || null,
      email: parsed.data.email || current?.user?.email || null,
      message: parsed.data.message,
      pageUrl: parsed.data.pageUrl || null,
    },
  });

  return { success: true };
}

// Admin-only: marks a report dealt with, or reopens one closed by mistake.
export async function adminSetIssueReportStatusAction(formData: FormData) {
  await requireAdmin();

  const reportId = String(formData.get("reportId"));
  const status = String(formData.get("status"));
  if (status !== "OPEN" && status !== "RESOLVED") {
    throw new Error("Invalid status");
  }

  await prisma.issueReport.update({ where: { id: reportId }, data: { status } });
  revalidatePath("/admin");
}
