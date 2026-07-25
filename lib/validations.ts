import { z } from "zod";
import { extractYouTubeId } from "@/lib/youtube";

export const CoordinatesSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const ShopQuerySchema = z.string().trim().min(1).max(100);

// How many nearest results a customer asked to browse (shops or salons) —
// absent/invalid means "just show the single nearest one" (see nearest.ts's
// MAX_RESULT_LIMIT for the upper bound this is clamped to).
export const ResultCountSchema = z.coerce.number().int().min(1).max(50);

export const PageNumberSchema = z.coerce.number().int().min(1);

export const ListingTypeSchema = z.enum(["salon", "shop", "both"]);

// Shared wherever a bare contact number is collected on its own (not as
// part of a bigger form schema that already has its own phone field) —
// renewals, verification — so the length/required rule (and its message)
// can't drift between them.
export const PhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .max(30, "Phone number is too long");

// Applies everywhere a quantity is entered for a product order — a cap
// exists mainly to keep amountKes (priceKes * quantity) from overflowing
// into a nonsensical order total, not because 999 of anything is realistic.
export const OrderQuantitySchema = z.coerce.number().int().min(1).max(999);

export const CreateListingSchema = z.object({
  type: ListingTypeSchema,
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(30),
  whatsappNumber: z.string().trim().max(30).optional(),
  tiktokUrl: z.string().trim().max(200).optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  contactName: z.string().trim().max(100).optional(),
  centreName: z.string().trim().max(100).optional(),
});

// Upper bound is a sanity cap (10 million Kes), not a business rule — just
// enough to keep a mistyped extra digit from creating a nonsensical listing.
const MAX_PRICE_KES = 10_000_000;

export const CreateItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  priceKes: z.coerce.number().int().positive().max(MAX_PRICE_KES),
});

export const CreateOrderSchema = z.object({
  quantity: OrderQuantitySchema,
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const UpdateProfileSchema = z.object({
  phone: z.string().trim().max(30),
});

export const IssueReportSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(1000),
  pageUrl: z.string().trim().max(300).optional(),
});

export const CreateAdvertSchema = z.object({
  productName: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  phone: PhoneSchema,
  packageDays: z.coerce.number().int().min(1).max(365),
  repeatCount: z.coerce.number().int().min(0).max(20),
  videoUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || extractYouTubeId(v) !== null, "Enter a valid YouTube video URL")
    .optional(),
});

export const RenewAdCampaignSchema = z.object({
  packageDays: z.coerce.number().int().min(1, "Package must run at least 1 day").max(365),
  repeatCount: z.coerce.number().int().min(0).max(20, "Repeats must be 20 or fewer"),
  phone: PhoneSchema,
});

export const RequestVerificationSchema = z.object({
  listingType: z.enum(["salon", "shop"]),
  phone: PhoneSchema,
});

export const CustomRoleNameSchema = z.string().trim().min(1, "Role name is required").max(50);
