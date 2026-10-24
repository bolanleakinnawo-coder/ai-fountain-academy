// Admin navigation. Admin pages also re-check the admin claim on load, and
// every write is enforced by Firestore rules and Cloud Functions.
import { wordmark, enablePageTransitions } from "./ui.js";
import { requireAdmin, signOut } from "./auth.js";

const I = {
  overview: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="9" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="3" width="7" height="5" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="12" width="7" height="9" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="16" width="7" height="5" rx="2" stroke="currentColor" stroke-width="1.7"/></svg>`,
  courses: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="m10 9.5 4.5 2.5-4.5 2.5v-5Z" fill="currentColor"/></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7"/><path d="M3 20c1-3.5 3.4-5 6-5s5 1.5 6 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c1.6.6 2.6 2.2 3 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  purchases: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  back: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="m10 3-5 5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

const LINKS = [
  ["admin/index.html", "overview", "Overview"],
  ["admin/courses.html", "courses", "Courses & lessons"],
  ["admin/users.html", "users", "Users & access"],
  ["admin/purchases.html", "purchases", "Purchases"],
  ["admin/settings.html", "settings", "Site settings"],
];

export async function initAdmin() {
  const user = await requireAdmin();
  enablePageTransitions();
  const holder = document.querySelector("[data-admin-side]");
  const active = holder.dataset.active;
  holder.outerHTML = `
    <aside class="admin-side">
      ${wordmark(true)}
      <span class="tag">Admin</span>
      ${LINKS.map(([href, key, label]) => `<a class="a-link ${active === key ? "active" : ""}" href="${href}">${I[key]}${label}</a>`).join("")}
      <div class="foot">
        <a class="a-link" href="dashboard.html">${I.back}Learner dashboard</a>
        <button class="a-link" data-logout>${I.logout}Log out</button>
      </div>
    </aside>
    <nav class="admin-mobile" aria-label="Admin">
      ${LINKS.map(([href, key, label]) => `<a class="${active === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
      <a href="dashboard.html">Learner view</a>
    </nav>`;
  document.querySelectorAll("[data-logout]").forEach((b) => b.addEventListener("click", signOut));
  return user;
}

export const STATUS_PILL = {
  success: ["Paid", "pill-green"],
  pending: ["Pending", "pill-amber"],
  initialized: ["Started", "pill-grey"],
  abandoned: ["Not completed", "pill-grey"],
  failed: ["Failed", "pill-red"],
  reversed: ["Reversed", "pill-red"],
  published: ["Published", "pill-green"],
  draft: ["Draft", "pill-grey"],
  active: ["Active", "pill-green"],
  revoked: ["Revoked", "pill-red"],
};

export function pill(status) {
  const [label, cls] = STATUS_PILL[status] || [status, "pill-grey"];
  return `<span class="pill ${cls}">${label}</span>`;
}

export function slugify(text) {
  return String(text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function linesToList(text) {
  return String(text || "").split("\n").map((s) => s.trim()).filter(Boolean);
}
