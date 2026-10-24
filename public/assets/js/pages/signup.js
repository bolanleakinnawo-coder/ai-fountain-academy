import { pageReady, setLoading, wordmark, icon, $ } from "../ui.js";
import { register, loginWithGoogle, redirectIfSignedIn, destinationFor, authMessage } from "../auth.js";
import { EMAIL_RE, fieldError, clearErrors, showAlert, passwordScore, setupPasswordToggles, keepNextParam } from "../forms.js";

$("[data-wordmark]").outerHTML = wordmark();
$("#google-btn").innerHTML = `${icon.google} Continue with Google`;
setupPasswordToggles();
keepNextParam();
redirectIfSignedIn().finally(pageReady);

const form = $("#signup-form");
const alertEl = $("#form-alert");
const submit = $("#submit");
const strength = $("#strength");

form.password.addEventListener("input", () => { strength.dataset.score = passwordScore(form.password.value); });
["fullName", "email", "password", "confirm"].forEach((n) => form[n].addEventListener("input", () => fieldError(form, n, "")));

function validate() {
  clearErrors(form);
  const v = {
    fullName: form.fullName.value.trim(),
    email: form.email.value.trim().toLowerCase(),
    password: form.password.value,
    confirm: form.confirm.value,
  };
  let ok = true;
  const fail = (n, m) => { fieldError(form, n, m); ok = false; };
  if (v.fullName.length < 2) fail("fullName", "Please enter your full name.");
  if (!v.email) fail("email", "Please enter your email address.");
  else if (!EMAIL_RE.test(v.email)) fail("email", "That email address doesn't look right.");
  if (v.password.length < 8) fail("password", "Use at least 8 characters.");
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) fail("password", "Include at least one letter and one number.");
  if (!v.confirm) fail("confirm", "Please confirm your password.");
  else if (v.confirm !== v.password) fail("confirm", "Passwords don't match.");
  return ok ? v : null;
}

function success(user) {
  $(".auth-card").innerHTML = `
    <div class="form-success">
      <span class="tick">${icon.check}</span>
      <h1 class="h2">You're in!</h1>
      <p class="muted">Account created. Taking you to your dashboard…</p>
    </div>`;
  destinationFor(user).then((to) => setTimeout(() => location.replace(to), 900));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showAlert(alertEl, "");
  const v = validate();
  if (!v) { form.querySelector(".has-error input")?.focus(); return; }
  setLoading(submit, true);
  try {
    const user = await register(v);
    success(user);
  } catch (err) {
    console.error(err);
    if (err.code === "auth/email-already-in-use") fieldError(form, "email", authMessage(err));
    else showAlert(alertEl, authMessage(err));
    setLoading(submit, false);
  }
});

$("#google-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  setLoading(btn, true);
  try { success(await loginWithGoogle()); }
  catch (err) { showAlert(alertEl, authMessage(err)); setLoading(btn, false); }
});
