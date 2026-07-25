import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  // Clear existing data (children first, respecting FKs)
  await prisma.service.deleteMany();
  await prisma.product.deleteMany();
  await prisma.salon.deleteMany();
  await prisma.shop.deleteMany();

  await prisma.salon.create({
    data: {
      name: "Neptune",
      contactName: "Sheila Yego",
      centreName: "Tokyo",
      description: "A cozy braiding and weaving salon in the heart of the city.",
      phone: "0705 458 457",
      phone2: "0755 458 457",
      tiktokUrl: "https://www.tiktok.com/@neptune.salon",
      whatsappNumber: "254705458457",
      latitude: -1.2921,
      longitude: 36.8219,
      services: {
        create: [
          { name: "Braids retouch", description: "you will retouch once", priceKes: 560 },
          { name: "Cornrows retouch", description: "you will retouch once", priceKes: 560 },
          { name: "Weave retouch", description: "you will retouch once", priceKes: 560 },
          { name: "Locs retouch", description: "you will retouch once", priceKes: 560 },
        ],
      },
    },
  });

  await prisma.salon.create({
    data: {
      name: "Aurora Salon",
      contactName: "Grace Wanjiru",
      centreName: "Westlands",
      description: "Full-service salon offering styling, nails, and spa treatments.",
      phone: "0711 223 344",
      phone2: "0733 445 566",
      tiktokUrl: "https://www.tiktok.com/@aurora.salon",
      whatsappNumber: "254711223344",
      latitude: -1.2648,
      longitude: 36.8027,
      services: {
        create: [
          { name: "Wash and blow dry", description: "shampoo, deep condition, and blow dry finish", priceKes: 300 },
          { name: "Full weave install", description: "closure or frontal install, styled to your liking", priceKes: 800 },
          { name: "Manicure", description: "nail shaping, cuticle care, and polish", priceKes: 450 },
          { name: "Pedicure", description: "foot soak, exfoliation, and polish", priceKes: 350 },
        ],
      },
    },
  });

  await prisma.salon.create({
    data: {
      name: "Serenity Salon",
      contactName: "Miriam Achieng",
      centreName: "Kilimani",
      description: "Relaxed atmosphere specializing in natural hair care.",
      phone: "0722 998 877",
      whatsappNumber: "254722998877",
      latitude: -1.2833,
      longitude: 36.7833,
      services: {
        create: [
          { name: "Deep conditioning treatment", description: "restores moisture to natural hair", priceKes: 500 },
          { name: "Silk press", description: "heat styling for a smooth, silky finish", priceKes: 900 },
          { name: "Twist out", description: "defined twists for natural texture", priceKes: 650 },
        ],
      },
    },
  });

  await prisma.shop.create({
    data: {
      name: "Akinyi shop",
      phone: "0722 334 455",
      whatsappNumber: "254722334455",
      latitude: -1.29,
      longitude: 36.82,
      products: {
        create: [
          { name: "Brillance Shine Shampoo", description: "it is equiped with both keratin and argan oil for extra shine", priceKes: 670 },
          { name: "Brillance Shine Conditioner", description: "it is equiped with both keratin and argan oil for extra shine", priceKes: 670 },
          { name: "Brillance Shine Hair Mask", description: "it is equiped with both keratin and argan oil for extra shine", priceKes: 670 },
        ],
      },
    },
  });

  await prisma.shop.create({
    data: {
      name: "GlowMart Beauty Supplies",
      phone: "0700 112 233",
      whatsappNumber: "254700112233",
      latitude: -1.2648,
      longitude: 36.81,
      products: {
        create: [
          { name: "Argan Oil Hair Serum", description: "lightweight serum that tames frizz and adds shine", priceKes: 450 },
          { name: "Professional Hair Dryer", description: "ionic dryer with two heat and speed settings", priceKes: 1200 },
          { name: "Nail Polish Set", description: "set of six long-lasting, chip-resistant colors", priceKes: 350 },
        ],
      },
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
