const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { HttpsError } = require("firebase-functions/v2/https");

if (!getApps().length) initializeApp();

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

function requireUser(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please log in first.");
  return request.auth;
}

function requireAdmin(request) {
  const a = requireUser(request);
  if (a.token.admin !== true) throw new HttpsError("permission-denied", "Admins only.");
  return a;
}

function requireString(value, name, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new HttpsError("invalid-argument", `Missing or invalid ${name}.`);
  }
  return value.trim();
}

const entitlementId = (uid, courseId) => `${uid}_${courseId}`;

async function hasActiveEntitlement(uid, courseId) {
  const snap = await db.collection("entitlements").doc(entitlementId(uid, courseId)).get();
  return snap.exists && snap.data().status === "active";
}

async function audit(actor, action, target, details = {}) {
  await db.collection("auditLog").add({
    actor,
    action,
    target,
    ...details,
    at: FieldValue.serverTimestamp(),
  });
}

module.exports = {
  db,
  auth,
  storage,
  FieldValue,
  HttpsError,
  requireUser,
  requireAdmin,
  requireString,
  entitlementId,
  hasActiveEntitlement,
  audit,
};
