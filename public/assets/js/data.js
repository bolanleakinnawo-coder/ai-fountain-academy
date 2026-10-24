// All Firestore reads and user-owned writes used by the public site and dashboard.
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, setDoc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";
import { demoMode } from "./config.js";
import { DEMO_COURSES, demoLessons } from "./demo.js";

/* ---------- Preview mode: sample data, nothing saved ---------- */
const demoCourses = DEMO_COURSES
  .map((c) => ({ ...c, lessonCount: (c.contents || []).length }))
  .sort((a, b) => a.sortOrder - b.sortOrder);
const demoProgress = {};
const demoProfile = { fullName: "", lastLesson: null };
const demoOwned = () => ({ [demoCourses[0].id]: { courseId: demoCourses[0].id, status: "active", source: "purchase" } });
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

const withId = (snap) => ({ id: snap.id, ...snap.data() });

export async function listPublishedCourses() {
  if (demoMode) { await wait(); return demoCourses; }
  const q = query(collection(db, "courses"), where("status", "==", "published"), orderBy("sortOrder", "asc"));
  return (await getDocs(q)).docs.map(withId);
}

export async function getCourseBySlug(slug) {
  if (demoMode) { await wait(); return demoCourses.find((c) => c.slug === slug) || null; }
  const q = query(collection(db, "courses"), where("status", "==", "published"), where("slug", "==", slug), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : withId(snap.docs[0]);
}

export async function listPublishedLessons(courseId) {
  if (demoMode) { await wait(200); const c = demoCourses.find((x) => x.id === courseId); return c ? demoLessons(c) : []; }
  const q = query(collection(db, "courses", courseId, "lessons"), where("status", "==", "published"), orderBy("order", "asc"));
  return (await getDocs(q)).docs.map(withId);
}

/** Map of courseId -> entitlement for the signed-in user. */
export async function getMyEntitlements(uid) {
  if (demoMode) { return demoOwned(); }
  const q = query(collection(db, "entitlements"), where("uid", "==", uid));
  const map = {};
  (await getDocs(q)).docs.forEach((d) => { map[d.data().courseId] = withId(d); });
  return map;
}

export async function getEntitlement(uid, courseId) {
  if (demoMode) { return demoOwned()[courseId] || null; }
  const snap = await getDoc(doc(db, "entitlements", `${uid}_${courseId}`));
  return snap.exists() ? withId(snap) : null;
}

export async function getMyPayments(uid) {
  if (demoMode) { return []; }
  const q = query(collection(db, "payments"), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(50));
  return (await getDocs(q)).docs.map(withId);
}

export async function getProfile(uid) {
  if (demoMode) { const u = JSON.parse(sessionStorage.getItem("afa_demo_user") || "{}"); return { id: uid, ...demoProfile, fullName: demoProfile.fullName || u.name || "Demo Learner", email: u.email }; }
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? withId(snap) : null;
}

export function updateProfileName(uid, fullName) {
  if (demoMode) { demoProfile.fullName = fullName; return wait(300); }
  return updateDoc(doc(db, "users", uid), { fullName, updatedAt: serverTimestamp() });
}

/** Map of lessonId -> progress for one course. */
export async function getCourseProgress(uid, courseId) {
  if (demoMode) { const m = {}; Object.entries(demoProgress).forEach(([k, v]) => { if (v.courseId === courseId) m[k] = v; }); return m; }
  const q = query(collection(db, "progress", uid, "lessons"), where("courseId", "==", courseId));
  const map = {};
  (await getDocs(q)).docs.forEach((d) => { map[d.id] = d.data(); });
  return map;
}

/** Map of courseId -> number of completed lessons. */
export async function getCompletedCounts(uid) {
  if (demoMode) { const c = {}; Object.values(demoProgress).forEach((v) => { if (v.completed) c[v.courseId] = (c[v.courseId] || 0) + 1; }); return c; }
  const q = query(collection(db, "progress", uid, "lessons"), where("completed", "==", true));
  const counts = {};
  (await getDocs(q)).docs.forEach((d) => {
    const c = d.data().courseId;
    counts[c] = (counts[c] || 0) + 1;
  });
  return counts;
}

export function saveProgress(uid, lessonId, data) {
  if (demoMode) { demoProgress[lessonId] = { courseId: data.courseId, completed: !!data.completed, positionSeconds: data.positionSeconds || 0 }; return Promise.resolve(); }
  return setDoc(doc(db, "progress", uid, "lessons", lessonId), {
    courseId: data.courseId,
    completed: !!data.completed,
    positionSeconds: Math.max(0, Math.floor(data.positionSeconds || 0)),
    lastAccessedAt: serverTimestamp(),
  });
}

export function saveLastLesson(uid, info) {
  if (demoMode) { demoProfile.lastLesson = info; return Promise.resolve(); }
  return updateDoc(doc(db, "users", uid), {
    lastLesson: { ...info, at: serverTimestamp() },
  });
}

export async function getSiteSettings() {
  if (demoMode) { return {}; }
  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    return snap.exists() ? snap.data() : {};
  } catch {
    return {};
  }
}
