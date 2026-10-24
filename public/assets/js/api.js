// Calls to trusted Cloud Functions. The browser only sends ids; the server
// looks up prices, checks payments and decides access.
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { functions } from "./firebase.js";
import { demoMode } from "./config.js";

const PREVIEW_OFF = "Preview mode: payments and admin actions switch on once Firebase and Paystack are connected (see README).";

const call = (name) => async (data) => {
  if (demoMode) {
    await new Promise((r) => setTimeout(r, 500));
    // Sample clip so the learning page can be tried out. Real lessons come from getPlaybackUrl.
    if (name === "getPlaybackUrl") return { url: new URL("../video/hot-course.mp4", import.meta.url).href };
    throw Object.assign(new Error(PREVIEW_OFF), { code: "functions/failed-precondition" });
  }
  return (await httpsCallable(functions, name)(data)).data;
};

export const startCheckout = call("startCheckout");
export const verifyPayment = call("verifyPayment");
export const getPlaybackUrl = call("getPlaybackUrl");

export const adminGrantAccess = call("adminGrantAccess");
export const adminRevokeAccess = call("adminRevokeAccess");
export const adminDeleteCourse = call("adminDeleteCourse");
export const adminDeleteLesson = call("adminDeleteLesson");

export function apiMessage(err) {
  if (!err) return "Something went wrong.";
  if (err.code === "functions/unauthenticated") return "Please log in first.";
  if (err.code === "functions/permission-denied") return err.message || "You don't have access to this.";
  return err.message && !err.message.startsWith("internal") ? err.message : "Something went wrong. Please try again.";
}
