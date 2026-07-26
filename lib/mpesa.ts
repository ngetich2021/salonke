// M-Pesa Daraja (Lipa Na M-Pesa Online / STK Push) integration, against the
// **production** API — this account's own production credentials are used
// directly for testing too (see lib/pricing.ts for the reduced test prices
// that make that cheap). Callback confirmation arrives asynchronously at
// app/api/mpesa/callback/route.ts, correlated by checkoutRequestId.

const BASE_URL = "https://api.safaricom.co.ke";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY!;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`M-Pesa auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: string };
  // Tokens last ~1hr (expires_in is in seconds); refresh a minute early to
  // avoid a request racing an about-to-expire token.
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
  };
  return cachedToken.value;
}

// Daraja requires 2547XXXXXXXX (no leading 0 or +). Accepts the common
// Kenyan input shapes (07..., 7..., +2547..., 2547...) and normalizes them.
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  throw new Error(`Unrecognized phone number format: ${raw}`);
}

function stkTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export async function initiateStkPush({
  phone,
  amountKes,
  accountReference,
  transactionDesc,
}: {
  phone: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}): Promise<{ merchantRequestId: string; checkoutRequestId: string }> {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const tillNumber = process.env.MPESA_TILL_NUMBER!;
  const callbackBase = process.env.MPESA_CALLBACK_URL!;

  const timestamp = stkTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const normalizedPhone = normalizeKenyanPhone(phone);
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      // Till/Buy-Goods payment — PartyB is the customer-facing till number,
      // while BusinessShortCode (used for the password above) is the
      // API-registered shortcode Safaricom issued alongside the passkey.
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: amountKes,
      PartyA: normalizedPhone,
      PartyB: tillNumber,
      PhoneNumber: normalizedPhone,
      CallBackURL: `${callbackBase}/api/mpesa/callback`,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    }),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(
      `STK push failed: ${data.errorMessage ?? data.ResponseDescription ?? res.status}`
    );
  }

  return { merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID };
}

export type StkCallbackResult =
  | {
      checkoutRequestId: string;
      merchantRequestId: string;
      success: true;
      resultCode: number;
      resultDesc: string;
      mpesaReceiptNumber: string | null;
    }
  | {
      checkoutRequestId: string;
      merchantRequestId: string;
      success: false;
      resultCode: number;
      resultDesc: string;
      mpesaReceiptNumber: null;
    };

// Parses Safaricom's asynchronous STK push callback payload. Shape (per
// Daraja docs):
// { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode,
//   ResultDesc, CallbackMetadata?: { Item: [{Name, Value}, ...] } } } }
// CallbackMetadata is present only when ResultCode === 0 (success), and
// carries Amount/MpesaReceiptNumber/TransactionDate/PhoneNumber as items.
export function parseStkCallback(body: unknown): StkCallbackResult {
  const callback = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body
    ?.stkCallback;
  if (!callback) {
    throw new Error("Malformed M-Pesa callback payload");
  }

  const resultCode = Number(callback.ResultCode);
  const checkoutRequestId = String(callback.CheckoutRequestID);
  const merchantRequestId = String(callback.MerchantRequestID);
  const resultDesc = String(callback.ResultDesc ?? "");

  if (resultCode !== 0) {
    return {
      checkoutRequestId,
      merchantRequestId,
      success: false,
      resultCode,
      resultDesc,
      mpesaReceiptNumber: null,
    };
  }

  const items =
    (callback.CallbackMetadata as { Item?: { Name: string; Value?: string | number }[] })
      ?.Item ?? [];
  const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

  return {
    checkoutRequestId,
    merchantRequestId,
    success: true,
    resultCode,
    resultDesc,
    mpesaReceiptNumber: receipt != null ? String(receipt) : null,
  };
}

// Fallback for when Safaricom's callback never arrives (e.g. a dev ngrok
// tunnel that dropped) — actively asks Daraja for the outcome of a given
// STK push instead of only waiting to be told. Returns null while the
// transaction is still awaiting the customer's PIN entry, which Safaricom
// signals as an HTTP error response rather than a ResultCode, so a query
// that's simply "too early" must not be mistaken for a failure. Note the
// query endpoint's success response never includes the M-Pesa receipt
// number (only the original callback payload does) — a payment resolved
// this way keeps mpesaReceiptNumber null even though it did succeed.
export async function queryStkStatus(checkoutRequestId: string): Promise<StkCallbackResult | null> {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const timestamp = stkTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    // Still being processed (customer hasn't responded to the prompt yet) —
    // not a failure, just "don't know yet".
    return null;
  }

  const resultCode = Number(data.ResultCode);
  if (Number.isNaN(resultCode)) return null;
  const merchantRequestId = String(data.MerchantRequestID ?? "");
  const resultDesc = String(data.ResultDesc ?? data.ResponseDescription ?? "");

  // Queried too soon (typically the very first poll, seconds after the push,
  // before the customer has even entered their PIN), Safaricom responds
  // ResultCode 4999 / "The transaction is still under processing" as an
  // ordinary HTTP 200 rather than the HTTP error `!res.ok` above catches —
  // this is "don't know yet," not a failure. Treating it as terminal FAILED
  // is what let a since-successful payment get stuck FAILED forever: once
  // applyStkResult writes a non-PENDING status, it no-ops on the real
  // callback that arrives moments later with the actual outcome.
  if (resultCode === 4999 || /still.*processing/i.test(resultDesc)) {
    return null;
  }

  if (resultCode === 0) {
    return {
      checkoutRequestId,
      merchantRequestId,
      success: true,
      resultCode,
      resultDesc,
      mpesaReceiptNumber: null,
    };
  }
  return {
    checkoutRequestId,
    merchantRequestId,
    success: false,
    resultCode,
    resultDesc,
    mpesaReceiptNumber: null,
  };
}
