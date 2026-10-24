// Small helpers shared by the auth and account forms.
import { icon } from "./ui.js";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function fieldError(form, name, message) {
  const field = form.querySelector(`[data-field="${name}"]`);
  if (!field) return;
  field.classList.toggle("has-error", !!message);
  const err = field.querySelector(".error");
  if (err) err.textContent = message || "";
  const input = field.querySelector("input, select, textarea");
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

export function clearErrors(form) {
  form.querySelectorAll(".field").forEach((f) => {
    f.classList.remove("has-error");
    const input = f.querySelector("input");
    if (input) input.removeAttribute("aria-invalid");
  });
}

export function showAlert(el, message, type = "error") {
  el.className = `form-alert ${type} ${message ? "show" : ""}`;
  el.textContent = message || "";
}

export function passwordScore(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++;
  return pw ? Math.max(1, s) : 0;
}

export function setupPasswordToggles(root = document) {
  root.querySelectorAll("[data-toggle]").forEach((btn) => {
    const input = root.getElementById ? root.getElementById(btn.dataset.toggle) : document.getElementById(btn.dataset.toggle);
    btn.innerHTML = icon.eye;
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = show ? icon.eyeOff : icon.eye;
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });
}

/** Keeps ?next= when moving between login and signup. */
export function keepNextParam() {
  const next = new URLSearchParams(location.search).get("next");
  if (!next) return;
  document.querySelectorAll("[data-keep-next]").forEach((a) => {
    const url = new URL(a.href, location.origin);
    url.searchParams.set("next", next);
    a.href = url.pathname + url.search;
  });
}
