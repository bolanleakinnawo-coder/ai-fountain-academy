// Sidebar, mobile top bar and bottom tabs for the learner area.
import { wordmark, esc, enablePageTransitions } from "./ui.js";
import { signOut, isAdmin } from "./auth.js";
import { initials } from "./components.js";

const I = {
  home: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  courses: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="m10 9.5 4.5 2.5-4.5 2.5v-5Z" fill="currentColor"/></svg>`,
  explore: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  account: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  admin: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  logout: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export async function mountAppShell(user, profile) {
  enablePageTransitions();
  const holder = document.querySelector("[data-app-sidebar]");
  const active = holder.dataset.active;
  const name = (profile && profile.fullName) || user.displayName || user.email;
  const admin = await isAdmin(user).catch(() => false);
  const link = (href, key, label, icon) => `<a href="${href}" class="side-link ${active === key ? "active" : ""}">${icon}${label}</a>`;
  holder.outerHTML = `
    <aside class="app-side" aria-label="Dashboard">
      ${wordmark()}
      ${link("dashboard.html", "overview", "Overview", I.home)}
      ${link("dashboard.html#enrolled", "mine", "My courses", I.courses)}
      ${link("dashboard.html#explore", "explore", "Explore courses", I.explore)}
      ${link("account.html", "account", "Account settings", I.account)}
      ${admin ? `<p class="side-label">Admin</p>${link("admin/index.html", "admin", "Admin dashboard", I.admin)}` : ""}
      <div class="side-foot">
        <div class="side-user"><span class="avatar">${esc(initials(name))}</span><span class="who"><strong>${esc(name)}</strong><small>${admin ? "Administrator" : "Learner"}</small></span></div>
        <button class="side-link" data-logout>${I.logout}Log out</button>
      </div>
    </aside>
    <div class="mobile-top">${wordmark()}<a href="account.html" class="avatar" aria-label="Account">${esc(initials(name))}</a></div>
    <nav class="tabbar" aria-label="Dashboard">
      <a href="dashboard.html" class="${active === "overview" ? "active" : ""}">${I.home}Home</a>
      <a href="dashboard.html#enrolled">${I.courses}My courses</a>
      <a href="dashboard.html#explore">${I.explore}Explore</a>
      <a href="account.html" class="${active === "account" ? "active" : ""}">${I.account}Account</a>
    </nav>`;
  document.querySelectorAll("[data-logout]").forEach((b) => b.addEventListener("click", signOut));
}
