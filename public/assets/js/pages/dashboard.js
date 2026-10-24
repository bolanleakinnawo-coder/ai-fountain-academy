import { pageReady, observeReveals, esc, money, greeting, firstName, skeletonCards, icon, $, $$ } from "../ui.js";
import { requireUser } from "../auth.js";
import { listPublishedCourses, getMyEntitlements, getProfile, getCompletedCounts } from "../data.js";
import { enrolledCard, exploreCard, categoryCard, courseUrl, learnUrl } from "../components.js";
import { mountAppShell } from "../app-shell.js";

const user = await requireUser();
const enrolledGrid = $("#enrolled-grid");
const exploreGrid = $("#explore-grid");
enrolledGrid.innerHTML = skeletonCards(3);
exploreGrid.innerHTML = skeletonCards(4);
$("#hello-time").textContent = greeting();

const EMPTY_ILLUSTRATION = `
  <svg viewBox="0 0 300 220" fill="none" aria-hidden="true">
    <circle cx="150" cy="110" r="100" fill="#EEF3FF"/>
    <g class="float">
      <rect x="78" y="56" width="132" height="92" rx="8" fill="#fff" stroke="#9AA6C4" stroke-width="2"/>
      <rect x="78" y="128" width="132" height="20" rx="0" fill="#C9D3EA"/>
      <circle cx="144" cy="138" r="3.5" fill="#fff"/>
      <path d="M134 148h20l4 16h-28l4-16Z" fill="#fff" stroke="#9AA6C4" stroke-width="2"/>
      <circle cx="102" cy="80" r="11" stroke="#1F5BFF" stroke-width="2"/><path d="M102 74v6l4 3" stroke="#1F5BFF" stroke-width="2" stroke-linecap="round"/>
      <rect x="122" y="72" width="8" height="8" fill="#DCE6FF"/><rect x="136" y="74" width="50" height="5" rx="2.5" fill="#DCE6FF"/>
      <rect x="122" y="88" width="8" height="8" fill="#DCE6FF"/><rect x="136" y="90" width="30" height="5" rx="2.5" fill="#DCE6FF"/>
      <rect x="92" y="104" width="8" height="8" fill="#DCE6FF"/><rect x="106" y="106" width="40" height="5" rx="2.5" fill="#DCE6FF"/>
    </g>
    <g class="float" style="animation-delay:.6s">
      <rect x="172" y="104" width="62" height="66" rx="10" fill="#fff" stroke="#9AA6C4" stroke-width="2"/>
      <path d="M184 120l8 8m0-8-8 8M212 120l8 8m0-8-8 8" stroke="#1F5BFF" stroke-width="2" stroke-linecap="round"/>
      <path d="M190 146h24" stroke="#9AA6C4" stroke-width="2" stroke-linecap="round"/>
    </g>
    <path class="twinkle" d="M196 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="#1F5BFF"/>
    <path class="twinkle d2" d="M112 166l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5 2.5-6Z" fill="#9AA6C4"/>
  </svg>`;

let state = { courses: [], owned: {}, counts: {}, category: null };

function progressFor(c) {
  const done = state.counts[c.id] || 0;
  return c.lessonCount ? Math.min(100, Math.round((done / c.lessonCount) * 100)) : 0;
}

function renderEnrolled() {
  const q = $("#enrolled-search").value.trim().toLowerCase();
  const mine = state.courses.filter((c) => state.owned[c.id]);
  if (!mine.length) {
    enrolledGrid.className = "";
    enrolledGrid.innerHTML = `
      <div class="empty-desk" data-reveal>
        ${EMPTY_ILLUSTRATION}
        <p>You haven't enrolled in any courses yet</p>
        <a class="btn btn-primary" href="#explore">Explore courses ${icon.arrow}</a>
      </div>`;
    return;
  }
  enrolledGrid.className = "enrolled-grid";
  const list = mine.filter((c) => !q || `${c.title} ${c.category} ${(c.tags || []).join(" ")}`.toLowerCase().includes(q));
  enrolledGrid.innerHTML = list.length
    ? list.map((c, i) => enrolledCard(c, { progress: progressFor(c), revoked: state.owned[c.id].status !== "active" }, i)).join("")
    : `<div class="no-match" style="grid-column:1/-1">No enrolled course matches "${esc(q)}".</div>`;
}

function renderExplore() {
  const isOwned = (c) => state.owned[c.id] && state.owned[c.id].status === "active";
  let list = state.courses.filter((c) => !isOwned(c));
  if (state.category) list = state.courses.filter((c) => c.category === state.category);
  const tag = $("#filter-tag");
  tag.classList.toggle("hidden", !state.category);
  tag.innerHTML = state.category ? `${esc(state.category)} <button aria-label="Clear category">×</button>` : "";
  exploreGrid.innerHTML = list.length
    ? list.map((c, i) => exploreCard(c, { owned: isOwned(c) }, i)).join("")
    : `<div class="no-match" style="grid-column:1/-1">You own every course. New ones will show up here.</div>`;
  $$(".category-card").forEach((b) => b.classList.toggle("on", b.dataset.category === state.category));
}

function renderCategories() {
  const counts = {};
  state.courses.forEach((c) => { if (c.category) counts[c.category] = (counts[c.category] || 0) + 1; });
  const track = $("#cat-track");
  track.innerHTML = Object.entries(counts).map(([name, n], i) => categoryCard(name, n, i)).join("");
  track.addEventListener("click", (e) => {
    const b = e.target.closest("[data-category]");
    if (!b) return;
    state.category = state.category === b.dataset.category ? null : b.dataset.category;
    renderExplore();
    observeReveals(exploreGrid);
    $("#explore").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const step = () => track.clientWidth * 0.8;
  const prev = $("#cat-prev");
  const next = $("#cat-next");
  const sync = () => {
    prev.disabled = track.scrollLeft < 4;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  };
  prev.addEventListener("click", () => track.scrollBy({ left: -step() }));
  next.addEventListener("click", () => track.scrollBy({ left: step() }));
  track.addEventListener("scroll", sync, { passive: true });
  sync();
}

function renderHot() {
  const hot = state.courses.find((c) => c.featured) || state.courses[0];
  if (!hot) return;
  const owned = state.owned[hot.id] && state.owned[hot.id].status === "active";
  $("#hot-slot").innerHTML = `
    <article class="hot-banner" data-reveal="scale">
      <div class="copy">
        <span class="tag"><span class="live-dot red"></span>Hot course · No. 1</span>
        <h2>${esc(hot.title)}</h2>
        <p>${esc(hot.shortDescription || "")}</p>
        <div class="row">
          ${owned
            ? `<a class="btn btn-white" href="${learnUrl(hot)}">Continue learning ${icon.arrow}</a>`
            : `<a class="btn btn-white" href="${courseUrl(hot)}">View course ${icon.arrow}</a><span class="price">${money(hot.priceKobo, hot.currency)}</span>`}
        </div>
      </div>
      <div class="media"><img src="${esc(hot.thumbnailUrl || "assets/img/thumb-fallback.svg")}" alt=""></div>
    </article>`;
}

function renderContinue(profile) {
  const last = profile && profile.lastLesson;
  if (!last) return;
  const c = state.courses.find((x) => x.id === last.courseId);
  if (!c || !(state.owned[c.id] && state.owned[c.id].status === "active")) return;
  $("#continue-slot").innerHTML = `
    <a class="continue" href="${learnUrl(c, last.lessonId)}" data-reveal>
      <span class="thumb"><img src="${esc(c.thumbnailUrl)}" alt=""></span>
      <span><small>Continue where you stopped</small><h3>${esc(last.lessonTitle || "Your last lesson")}</h3><p>${esc(c.shortTitle || c.title)} · ${progressFor(c)}% complete</p></span>
      <span class="btn btn-primary">Resume ${icon.arrow}</span>
    </a>`;
}

async function load() {
  try {
    const [profile, courses, owned, counts] = await Promise.all([
      getProfile(user.uid).catch(() => null),
      listPublishedCourses(),
      getMyEntitlements(user.uid),
      getCompletedCounts(user.uid).catch(() => ({})),
    ]);
    await mountAppShell(user, profile);
    const name = (profile && profile.fullName) || user.displayName || "";
    $("#hello-name").textContent = `Welcome back, ${firstName(name)}`;
    if (!Object.keys(owned).length) $("#hello-name").textContent = `Welcome, ${firstName(name)}`;
    state = { ...state, courses, owned, counts };
    renderHot();
    renderContinue(profile);
    renderEnrolled();
    renderExplore();
    renderCategories();
    $("#enrolled-search").addEventListener("input", () => renderEnrolled());
    $("#filter-tag").addEventListener("click", (e) => { if (e.target.closest("button")) { state.category = null; renderExplore(); } });
  } catch (err) {
    console.error(err);
    await mountAppShell(user, null).catch(() => {});
    $("#hello-name").textContent = "Welcome back";
    enrolledGrid.className = "";
    enrolledGrid.innerHTML = `<div class="empty-state"><h3>Your dashboard couldn't load</h3><p>Check your connection and try again.</p><button class="btn btn-ghost" onclick="location.reload()">Try again</button></div>`;
    exploreGrid.innerHTML = "";
  } finally {
    pageReady();
    observeReveals(document);
    if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 50);
  }
}

load();
