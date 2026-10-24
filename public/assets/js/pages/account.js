import { pageReady, setLoading, esc, money, date, toast, skeletonRows, $ } from "../ui.js";
import { requireUser, resetPassword } from "../auth.js";
import { getProfile, updateProfileName, getMyPayments } from "../data.js";
import { mountAppShell } from "../app-shell.js";
import { fieldError, showAlert } from "../forms.js";

const user = await requireUser();
const tbody = $("#payments");
tbody.innerHTML = skeletonRows(3, 5);

const STATUS = {
  success: ["Paid", "pill-green"],
  pending: ["Pending", "pill-amber"],
  initialized: ["Started", "pill-grey"],
  abandoned: ["Not completed", "pill-grey"],
  failed: ["Failed", "pill-red"],
  reversed: ["Reversed", "pill-red"],
};

async function load() {
  const profile = await getProfile(user.uid).catch(() => null);
  await mountAppShell(user, profile);
  $("#fullName").value = (profile && profile.fullName) || user.displayName || "";
  $("#email").value = user.email;
  pageReady();
  try {
    const payments = await getMyPayments(user.uid);
    tbody.innerHTML = payments.length
      ? payments.map((p) => {
          const [label, cls] = STATUS[p.status] || [p.status, "pill-grey"];
          return `<tr><td>${esc(p.courseTitle || p.courseId)}</td><td>${money(p.amountKobo, p.currency)}</td><td><span class="pill ${cls}">${label}</span></td><td>${date(p.createdAt)}</td><td class="mono">${esc(p.reference)}</td></tr>`;
        }).join("")
      : `<tr><td colspan="5" class="muted" style="text-align:center;padding:28px">No purchases yet. <a class="text-blue" href="courses.html">Browse courses</a></td></tr>`;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:28px">Purchase history couldn't load.</td></tr>`;
  }
}

$("#profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const name = $("#fullName").value.trim();
  fieldError(form, "fullName", "");
  if (name.length < 2) { fieldError(form, "fullName", "Please enter your full name."); return; }
  const btn = $("#save-profile");
  setLoading(btn, true);
  try {
    await updateProfileName(user.uid, name);
    toast("Profile saved", "success");
    document.querySelectorAll(".side-user strong").forEach((s) => { s.textContent = name; });
  } catch (err) {
    showAlert($("#profile-alert"), "We couldn't save your changes. Please try again.");
  } finally {
    setLoading(btn, false);
  }
});

$("#reset-pass").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  setLoading(btn, true);
  try {
    await resetPassword(user.email);
    showAlert($("#pass-alert"), `Reset link sent to ${user.email}.`, "success");
  } catch {
    showAlert($("#pass-alert"), "We couldn't send the email. Please try again in a minute.");
  } finally {
    setLoading(btn, false);
  }
});

load();
