// Firebase web config. These values are public by design (security comes from
// Firestore/Storage rules and Cloud Functions). Copy them from:
// Firebase console > Project settings > Your apps > Web app.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Region your Cloud Functions are deployed to.
export const functionsRegion = "us-central1";

// Preview mode: while the config above still has the YOUR_... placeholders, the
// site runs on built-in sample data so you can click through every page.
// Nothing is saved and payments are switched off. It turns off by itself
// as soon as you paste your real Firebase config.
export const demoMode = firebaseConfig.apiKey.startsWith("YOUR_");

// Talk to the local Firebase emulators when served by `firebase emulators:start` (port 5000).
export const useEmulators = !demoMode && ["localhost", "127.0.0.1"].includes(location.hostname) && location.port === "5000";

// Contact details shown in the footer and contact page.
export const site = {
  name: "AI Fountain Academy",
  supportEmail: "support@aifountainacademy.com",
  whatsapp: "",
};
