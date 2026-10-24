import { pageReady, setLoading, wordmark, icon, $ } from "../ui.js";
import { login, loginWithGoogle, redirectIfSignedIn, destinationFor, authMessage } from "../auth.js";
import { EMAIL_RE, fieldError, clearErrors, showAlert, setupPasswordToggles, keepNextParam } from "../forms.js";

$("[data-wordmark]").outerHTML = wordmark();
$("#google-btn").innerHTML = `${icon.google} Continue with Google`;
setupPasswordToggles();
keepNextParam();
redirectIfSignedIn().finally(pageReady);

const form = $("#login-form");
const alertEl = $("#form-alert");
const submit = $("#submit");
["email", "password"].forEach((n) => form[n].addEventListener("input", () => fieldError(form, n, "")));

async function go(user) {
  submit.classList.add("is-success");
  location.replace(await destinationFor(user));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors(form);
  showAlert(alertEl, "");
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  let ok = true;
  if (!EMAIL_RE.test(email)) { fieldError(form, "email", "Please enter a valid email address."); ok = false; }
  if (!password) { fieldError(form, "password", "Please enter your password."); ok = false; }
  if (!ok) return;
  setLoading(submit, true);
  try {
    await go(await login(email, password));
  } catch (err) {
    showAlert(alertEl, authMessage(err));
    setLoading(submit, false);
  }
});

$("#google-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  setLoading(btn, true);
  try { await go(await loginWithGoogle()); }
  catch (err) { showAlert(alertEl, authMessage(err)); setLoading(btn, false); }
});
