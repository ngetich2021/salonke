"use client";

import { useRef, useState } from "react";

// Keeps the first 3 and last 2 digits and blanks out the rest — enough to
// recognize a number you already know without exposing the whole thing to
// anyone just scrolling past.
function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 5) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 3)} •••• ${trimmed.slice(-2)}`;
}

// A phone number never renders in the clear by default — public pages only
// ever show this masked form. On a phone (checked client-side only, so
// server and first client render always agree and never mismatch), tapping
// it goes straight to the dialer since there's nothing useful to read on
// screen anyway. On desktop/tablet, where there's no dialer to hand off to,
// tapping just reveals the digits in place.
export function PhoneButton({ phone, className }: { phone: string; className?: string }) {
  const [revealed, setRevealed] = useState(false);
  const isMobileRef = useRef(false);
  const checkedRef = useRef(false);

  function handleClick() {
    if (!checkedRef.current) {
      checkedRef.current = true;
      isMobileRef.current = /Android|iPhone|iPod|Windows Phone/i.test(navigator.userAgent);
    }
    if (isMobileRef.current) {
      window.location.href = `tel:${phone}`;
    } else {
      setRevealed(true);
    }
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      📞 {revealed ? phone : maskPhone(phone)}
    </button>
  );
}
