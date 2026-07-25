import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "salon-beauty-portal",
  });

  return result.secure_url;
}

export async function uploadVideo(
  file: File
): Promise<{ url: string; publicId: string; durationSeconds: number }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "salon-beauty-portal/adverts",
    resource_type: "video",
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    durationSeconds: result.duration ?? 0,
  };
}

export async function deleteVideo(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
}
