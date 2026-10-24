import { pageReady, setLoading, wordmark, $ } from "../ui.js";
import { resetPassword } from "../auth.js";
import { EMAIL_RE, fieldError, showAlert } from "../forms.js";

$("[data-wordmark]").outerHTML = wordmark();
pageReady();

const form = $("#reset-form");
const alertEl = $("#form-alert");
const submit = $("#submit");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  fieldError(form, "email", "");
  const email = form.email.value.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) { fieldError(form, "email", "Please enter a valid email address."); return; }
  setLoading(submit, true);
  try {
    await resetPassword(email);
  } catch (err) {
    // Don't reveal whether an account exists; only surface connection problems.
    if (err.code === "auth/network-request-failed" || err.code === "auth/too-many-requests") {
      showAlert(alertEl, "We couldn't send the email right now. Please try again in a minute.");
      setLoading(submit, false);
      return;
    }
  }
  setLoading(submit, false);
  showAlert(alertEl, `If an account exists for ${email}, a reset link is on its way. Check your inbox and spam folder.`, "success");
  form.reset();
});
