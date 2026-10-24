// Thin Paystack API client plus the pure checks we run on every transaction.
const crypto = require("crypto");

const API = "https://api.paystack.co";

async function call(secretKey, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status !== true) {
    const err = new Error(body.message || `Paystack request failed (${res.status})`);
    err.paystack = body;
    throw err;
  }
  return body.data;
}

function initializeTransaction(secretKey, payload) {
  return call(secretKey, "/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function verifyTransaction(secretKey, reference) {
  return call(secretKey, `/transaction/verify/${encodeURIComponent(reference)}`);
}

// Paystack signs webhook bodies with HMAC-SHA512 of the raw body using the secret key.
function isValidSignature(secretKey, rawBody, signature) {
  if (!signature || !rawBody) return false;
  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Decide what a verified Paystack transaction means for our payment record.
// Returns { ok: true } only when everything matches the order we created.
function evaluateTransaction(payment, tx) {
  if (!tx || tx.reference !== payment.reference) {
    return { ok: false, status: "failed", reason: "Reference mismatch" };
  }
  const meta = tx.metadata || {};
  if (meta.uid !== payment.uid || meta.courseId !== payment.courseId) {
    return { ok: false, status: "failed", reason: "Metadata does not match this order" };
  }
  switch (tx.status) {
    case "success":
      break;
    case "abandoned":
      return { ok: false, status: "abandoned", reason: "Payment was not completed" };
    case "ongoing":
    case "pending":
    case "processing":
    case "queued":
      return { ok: false, status: "pending", reason: "Payment is still processing" };
    case "reversed":
      return { ok: false, status: "reversed", reason: "Payment was reversed" };
    default:
      return { ok: false, status: "failed", reason: tx.gateway_response || "Payment failed" };
  }
  if (Number(tx.amount) !== Number(payment.amountKobo)) {
    return { ok: false, status: "failed", reason: `Amount mismatch: paid ${tx.amount}, expected ${payment.amountKobo}` };
  }
  if (String(tx.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
    return { ok: false, status: "failed", reason: `Currency mismatch: ${tx.currency}` };
  }
  return { ok: true, status: "success" };
}

module.exports = { initializeTransaction, verifyTransaction, isValidSignature, evaluateTransaction };
