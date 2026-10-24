const { onCall } = require("firebase-functions/v2/https");
const { db, storage, auth, FieldValue, HttpsError, requireAdmin, requireString, entitlementId, audit } = require("./lib");

// Grant a user access to a course without payment (gift, support case, etc.).
exports.adminGrantAccess = onCall(async (request) => {
  const admin = requireAdmin(request);
  const uid = requireString(request.data && request.data.uid, "uid");
  const courseId = requireString(request.data && request.data.courseId, "courseId");
  const reason = requireString(request.data && request.data.reason, "reason", 500);

  const [user, course] = await Promise.all([
    auth.getUser(uid).catch(() => null),
    db.collection("courses").doc(courseId).get(),
  ]);
  if (!user) throw new HttpsError("not-found", "User not found.");
  if (!course.exists) throw new HttpsError("not-found", "Course not found.");

  const ref = db.collection("entitlements").doc(entitlementId(uid, courseId));
  const existing = await ref.get();
  await ref.set({
    uid,
    courseId,
    status: "active",
    source: existing.exists && existing.data().source === "purchase" ? "purchase" : "grant",
    grantedBy: admin.uid,
    grantReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  }, { merge: true });
  await audit(admin.uid, "grant", { uid, courseId }, { reason });
  return { ok: true };
});

exports.adminRevokeAccess = onCall(async (request) => {
  const admin = requireAdmin(request);
  const uid = requireString(request.data && request.data.uid, "uid");
  const courseId = requireString(request.data && request.data.courseId, "courseId");
  const reason = requireString(request.data && request.data.reason, "reason", 500);

  const ref = db.collection("entitlements").doc(entitlementId(uid, courseId));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "This user doesn't have that course.");
  await ref.update({
    status: "revoked",
    revokedBy: admin.uid,
    revokeReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await audit(admin.uid, "revoke", { uid, courseId }, { reason });
  return { ok: true };
});

// Deletes a course, its lessons, private video references and stored videos.
// Purchase and entitlement records are kept for the books.
exports.adminDeleteCourse = onCall({ timeoutSeconds: 300 }, async (request) => {
  const admin = requireAdmin(request);
  const courseId = requireString(request.data && request.data.courseId, "courseId");
  const courseRef = db.collection("courses").doc(courseId);
  const course = await courseRef.get();
  if (!course.exists) throw new HttpsError("not-found", "Course not found.");

  const lessons = await courseRef.collection("lessons").get();
  const batch = db.batch();
  for (const lesson of lessons.docs) {
    batch.delete(lesson.ref);
    batch.delete(db.collection("lessonAssets").doc(lesson.id));
  }
  batch.delete(courseRef);
  await batch.commit();

  await storage.bucket().deleteFiles({ prefix: `lesson-videos/${courseId}/` }).catch(() => {});
  await audit(admin.uid, "delete-course", { courseId }, { title: course.data().title });
  return { ok: true, lessonsDeleted: lessons.size };
});

// Remove one lesson and its stored video.
exports.adminDeleteLesson = onCall(async (request) => {
  const admin = requireAdmin(request);
  const courseId = requireString(request.data && request.data.courseId, "courseId");
  const lessonId = requireString(request.data && request.data.lessonId, "lessonId");
  const assetRef = db.collection("lessonAssets").doc(lessonId);
  const asset = await assetRef.get();
  if (asset.exists && asset.data().storagePath) {
    await storage.bucket().file(asset.data().storagePath).delete().catch(() => {});
  }
  await assetRef.delete();
  await db.collection("courses").doc(courseId).collection("lessons").doc(lessonId).delete();
  await audit(admin.uid, "delete-lesson", { courseId, lessonId });
  return { ok: true };
});
