// Gives an existing account the admin role (an Auth custom claim).
// The user must sign out and back in afterwards.
// Usage: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node make-admin.js you@example.com
//        add --remove to take the role away.
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const email = process.argv[2];
const remove = process.argv.includes("--remove");
if (!email) {
  console.error("Usage: node make-admin.js <email> [--remove]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });

(async () => {
  const user = await getAuth().getUserByEmail(email);
  const claims = { ...(user.customClaims || {}) };
  if (remove) delete claims.admin; else claims.admin = true;
  await getAuth().setCustomUserClaims(user.uid, claims);
  console.log(`${remove ? "Removed admin from" : "Made admin:"} ${email}. Sign out and back in to apply.`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
