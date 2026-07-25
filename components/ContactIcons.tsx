export function ContactIcons({
  tiktokUrl,
  whatsappNumber,
  phone,
}: {
  tiktokUrl?: string | null;
  whatsappNumber?: string | null;
  phone?: string | null;
}) {
  if (!tiktokUrl && !whatsappNumber && !phone) return null;

  return (
    <div className="flex items-center gap-3">
      {phone && (
        <a
          href={`tel:${phone}`}
          aria-label="Call"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2Z" />
          </svg>
        </a>
      )}
      {tiktokUrl && (
        <a
          href={tiktokUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="TikTok"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.6h-3.13v13.44a2.6 2.6 0 1 1-1.85-2.49v-3.19a5.75 5.75 0 1 0 5 5.7V9.5a7.13 7.13 0 0 0 4.13 1.32V7.69a4.3 4.3 0 0 1-2.75-1.87Z" />
          </svg>
        </a>
      )}
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.44 1.33 4.94L2 22l5.24-1.37a9.9 9.9 0 0 0 4.8 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm5.83 14.24c-.25.7-1.24 1.28-2.02 1.44-.55.12-1.26.21-3.67-.79-2.63-1.09-4.55-3.51-4.7-3.72-.14-.2-1.11-1.48-1.11-2.83 0-1.34.7-1.99.95-2.27.25-.27.55-.34.73-.34h.53c.17 0 .4-.06.62.48.25.6.85 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.05 1.14 1.02 2.1 1.34 2.4 1.49.3.15.47.13.65-.08.17-.2.75-.87.95-1.17.2-.3.4-.24.66-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.13.07.75-.18 1.44Z" />
          </svg>
        </a>
      )}
    </div>
  );
}
