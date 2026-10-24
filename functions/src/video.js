const { onCall } = require("firebase-functions/v2/https");
const { defineInt } = require("firebase-functions/params");
const { db, storage, HttpsError, requireUser, requireString, hasActiveEntitlement } = require("./lib");

const PLAYBACK_URL_MINUTES = defineInt("PLAYBACK_URL_MINUTES", { default: 120 });

// Returns a short-lived signed URL for one lesson video, only after checking:
// 1. the caller is signed in, 2. course and lesson exist and are published,
// 3. the caller has an active entitlement (or is an admin).
exports.getPlaybackUrl = onCall(async (request) => {
  const { uid, token } = requireUser(request);
  const courseId = requireString(request.data && request.data.courseId, "courseId");
  const lessonId = requireString(request.data && request.data.lessonId, "lessonId");
  const isAdmin = token.admin === true;

  const courseRef = db.collection("courses").doc(courseId);
  const [course, lesson, asset] = await Promise.all([
    courseRef.get(),
    courseRef.collection("lessons").doc(lessonId).get(),
    db.collection("lessonAssets").doc(lessonId).get(),
  ]);

  if (!course.exists || !lesson.exists) throw new HttpsError("not-found", "Lesson not found.");
  if (!isAdmin && (course.data().status !== "published" || lesson.data().status !== "published")) {
    throw new HttpsError("not-found", "Lesson not found.");
  }
  if (!isAdmin && !(await hasActiveEntitlement(uid, courseId))) {
    throw new HttpsError("permission-denied", "You don't have access to this course.");
  }
  if (!asset.exists || asset.data().courseId !== courseId || !asset.data().storagePath) {
    throw new HttpsError("failed-precondition", "This lesson's video isn't ready yet.");
  }

  const minutes = PLAYBACK_URL_MINUTES.value();
  const [url] = await storage
    .bucket()
    .file(asset.data().storagePath)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + minutes * 60 * 1000,
    });

  return { url, expiresInSeconds: minutes * 60 };
});
