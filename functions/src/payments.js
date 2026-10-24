const crypto = require("crypto");
const { onCall, onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {
  db, FieldValue, HttpsError, requireUser, requireString,
  entitlementId, hasActiveEntitlement,
} = require("./lib");
const paystack = require("./paystack");

const PAYSTACK_SECRET_KEY = defineSecret("PAYSTACK_SECRET_KEY");
const APP_BASE_URL = defineString("APP_BASE_URL");

// Verifies a reference with Paystack and, if valid, grants access exactly once.
async function processReference(reference, secretKey) {
  const paymentRef = db.collection("payments").doc(reference);
  const first = await paymentRef.get();
  if (!first.exists) return { status: "unknown" };
  const payment = first.data();
  if (payment.status === "success") return { status: "success", courseId: payment.courseId };

  const tx = await paystack.verifyTransaction(secretKey, reference);
  const verdict = paystack.evaluateTransaction(payment, tx);

  return db.runTransaction(async (t) => {
    const fresh = await t.get(paymentRef);
    const current = fresh.data();
    // Another webhook or verify call already finished this payment.
    if (current.status === "success") return { status: "success", courseId: current.courseId };

    if (!verdict.ok) {
      t.update(paymentRef, {
        status: verdict.status,
        failureReason: verdict.reason,
        paystackStatus: tx.status || null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: verdict.status, reason: verdict.reason, courseId: current.courseId };
    }

    const entRef = db.collection("entitlements").doc(entitlementId(current.uid, current.courseId));
    t.set(entRef, {
      uid: current.uid,
      courseId: current.courseId,
      source: "purchase",
      status: "active",
      paymentRef: reference,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    t.update(paymentRef, {
      status: "success",
      paystackStatus: tx.status,
      paidAt: tx.paid_at || null,
      channel: tx.channel || null,
      processedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    t.set(db.collection("auditLog").doc(), {
      actor: "paystack",
      action: "purchase",
      target: { uid: current.uid, courseId: current.courseId },
      reference,
      at: FieldValue.serverTimestamp(),
    });
    return { status: "success", courseId: current.courseId };
  });
}

exports.startCheckout = onCall({ secrets: [PAYSTACK_SECRET_KEY] }, async (request) => {
  const { uid, token } = requireUser(request);
  const courseId = requireString(request.data && request.data.courseId, "courseId");
  if (!token.email) throw new HttpsError("failed-precondition", "Your account needs an email address.");

  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists || courseSnap.data().status !== "published") {
    throw new HttpsError("not-found", "This course is not available.");
  }
  const course = courseSnap.data();
  if (await hasActiveEntitlement(uid, courseId)) {
    return { alreadyOwned: true, slug: course.slug };
  }

  // Price always comes from the database, never from the browser.
  const amountKobo = Number(course.priceKobo);
  const currency = course.currency || "NGN";

  if (amountKobo === 0) {
    await db.collection("entitlements").doc(entitlementId(uid, courseId)).set({
      uid, courseId, source: "free", status: "active",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { alreadyOwned: true, slug: course.slug };
  }

  const reference = `afa_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
  const base = APP_BASE_URL.value().replace(/\/$/, "");

  await db.collection("payments").doc(reference).set({
    reference,
    uid,
    email: token.email,
    courseId,
    courseTitle: course.title,
    amountKobo,
    currency,
    provider: "paystack",
    status: "initialized",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const data = await paystack.initializeTransaction(PAYSTACK_SECRET_KEY.value(), {
      email: token.email,
      amount: amountKobo,
      currency,
      reference,
      callback_url: `${base}/checkout-callback.html`,
      metadata: {
        uid,
        courseId,
        custom_fields: [{ display_name: "Course", variable_name: "course", value: course.title }],
      },
    });
    await db.collection("payments").doc(reference).update({
      status: "pending",
      accessCode: data.access_code,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { authorizationUrl: data.authorization_url, reference };
  } catch (err) {
    logger.error("Paystack initialize failed", { reference, message: err.message });
    await db.collection("payments").doc(reference).update({
      status: "failed",
      failureReason: "Could not start payment",
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw new HttpsError("unavailable", "We couldn't start the payment. Please try again.");
  }
});

// Called by the callback page. Same checks as the webhook, so access never
// depends on the redirect alone.
exports.verifyPayment = onCall({ secrets: [PAYSTACK_SECRET_KEY] }, async (request) => {
  const { uid } = requireUser(request);
  const reference = requireString(request.data && request.data.reference, "reference", 100);
  const snap = await db.collection("payments").doc(reference).get();
  if (!snap.exists || snap.data().uid !== uid) {
    throw new HttpsError("not-found", "We couldn't find that payment.");
  }
  try {
    return await processReference(reference, PAYSTACK_SECRET_KEY.value());
  } catch (err) {
    logger.error("verifyPayment failed", { reference, message: err.message });
    return { status: "pending", reason: "Still confirming with Paystack." };
  }
});

exports.paystackWebhook = onRequest({ secrets: [PAYSTACK_SECRET_KEY] }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const secret = PAYSTACK_SECRET_KEY.value();
  if (!paystack.isValidSignature(secret, req.rawBody, req.get("x-paystack-signature"))) {
    logger.warn("Rejected webhook with bad signature");
    return res.status(401).send("Invalid signature");
  }
  const event = req.body || {};
  try {
    if (event.event === "charge.success" && event.data && event.data.reference) {
      const result = await processReference(event.data.reference, secret);
      logger.info("Processed charge.success", { reference: event.data.reference, result });
    }
    return res.status(200).send("ok");
  } catch (err) {
    logger.error("Webhook processing failed", { message: err.message });
    // 500 makes Paystack retry later; processing is idempotent.
    return res.status(500).send("retry");
  }
});

exports._processReference = processReference;
