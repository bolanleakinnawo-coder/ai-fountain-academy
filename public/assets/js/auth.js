// Session helpers. Page redirects here are for user experience only; the real
// protection is enforced by Firestore rules and Cloud Functions.
import {
  onAuthStateChanged, signOut as fbSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { demoMode } from "./config.js";

// Preview mode keeps a pretend session in this browser tab only.
function demoUser() {
  try {
    const u = JSON.parse(sessionStorage.getItem("afa_demo_user") || "null");
    return u ? { uid: "demo", email: u.email, displayName: u.name, getIdTokenResult: async () => ({ claims: {} }) } : null;
  } catch { return null; }
}
function demoSignIn(email, name) {
  sessionStorage.setItem("afa_demo_user", JSON.stringify({ email: email || "demo@example.com", name: name || "Demo Learner" }));
  return new Promise((r) => setTimeout(() => r(demoUser()), 600));
}

setPersistence(auth, browserLocalPersistence).catch(() => {});

let resolved = false;
const ready = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (!resolved) { resolved = true; resolve(user); }
  });
});

/** Resolves with the signed-in user (or null) once Firebase has restored the session. */
export function currentUser() {
  if (demoMode) return Promise.resolve(demoUser());
  return resolved ? Promise.resolve(auth.currentUser) : ready;
}

export function onUserChange(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function isAdmin(user, forceRefresh = false) {
  if (!user) return false;
  const token = await user.getIdTokenResult(forceRefresh);
  return token.claims.admin === true;
}

/** The current page as a path relative to the site root, e.g. "course.html?slug=x".
 *  Works on a web server, in a subfolder and when opened straight from disk. */
export function currentPagePath() {
  const root = new URL(".", document.baseURI).href;
  const href = location.href.split("#")[0];
  return href.startsWith(root) ? href.slice(root.length) : "dashboard.html";
}

function loginUrl() {
  return `login.html?next=${encodeURIComponent(currentPagePath())}`;
}

/** Redirects to login when signed out. Resolves with the user otherwise. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    location.replace(loginUrl());
    return new Promise(() => {});
  }
  return user;
}

/** Redirects non-admins to the dashboard. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdmin(user, true))) {
    location.replace("dashboard.html");
    return new Promise(() => {});
  }
  return user;
}

/** For login/signup pages: send already signed-in users on. */
export async function redirectIfSignedIn() {
  const user = await currentUser();
  if (user) location.replace(await destinationFor(user));
}

export async function destinationFor(user) {
  const next = new URLSearchParams(location.search).get("next");
  // Only same-site relative paths, never another website.
  if (next && !/^[a-z][a-z0-9+.-]*:/i.test(next) && !next.startsWith("//") && !next.startsWith("/")) return next;
  return (await isAdmin(user)) ? "admin/index.html" : "dashboard.html";
}

async function ensureProfile(user, fullName) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      fullName: (fullName || user.displayName || user.email.split("@")[0]).slice(0, 79),
      email: user.email,
      createdAt: serverTimestamp(),
    });
  }
}

export async function register({ fullName, email, password }) {
  if (demoMode) return demoSignIn(email, fullName);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: fullName });
  await ensureProfile(cred.user, fullName);
  return cred.user;
}

export async function login(email, password) {
  if (demoMode) return demoSignIn(email, email.split("@")[0]);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  if (demoMode) return demoSignIn("demo@example.com", "Demo Learner");
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  await ensureProfile(cred.user);
  return cred.user;
}

export function resetPassword(email) {
  if (demoMode) return Promise.resolve();
  return sendPasswordResetEmail(auth, email, { url: `${location.origin}/login` });
}

export async function signOut() {
  if (demoMode) { sessionStorage.removeItem("afa_demo_user"); location.href = "index.html"; return; }
  await fbSignOut(auth);
  location.href = "index.html";
}

/** Turns Firebase error codes into friendly sentences. */
export function authMessage(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/email-already-in-use": "An account with this email already exists. Log in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Please choose a stronger password.",
    "auth/invalid-credential": "That email and password don't match. Please try again.",
    "auth/wrong-password": "That email and password don't match. Please try again.",
    "auth/user-not-found": "That email and password don't match. Please try again.",
    "auth/too-many-requests": "Too many attempts. Please wait a minute and try again.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
    "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
    "auth/user-disabled": "This account has been disabled. Please contact support.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
