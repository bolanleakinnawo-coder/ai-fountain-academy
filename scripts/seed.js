// Seeds the six launch courses into Firestore. Safe to re-run: it updates
// course details but never touches lessons, purchases or entitlements.
// Usage: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node seed.js
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const courses = require("./courses.seed.json");

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

(async () => {
  for (const { id, ...course } of courses) {
    const ref = db.collection("courses").doc(id);
    const existing = await ref.get();
    await ref.set({
      ...course,
      lessonCount: existing.exists ? existing.data().lessonCount || 0 : 0,
      totalDurationSeconds: existing.exists ? existing.data().totalDurationSeconds || 0 : 0,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    console.log(`${existing.exists ? "Updated" : "Created"}: ${course.title}`);
  }
  console.log("Done.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
