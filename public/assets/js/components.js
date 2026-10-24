// Course UI pieces rendered from Firestore data. Every page uses these, so a
// course only ever needs to be edited in the admin dashboard.
import { esc, money, icon } from "./ui.js";

export const courseUrl = (c) => `course.html?slug=${encodeURIComponent(c.slug)}`;
export const learnUrl = (c, lessonId) => `learn.html?slug=${encodeURIComponent(c.slug)}${lessonId ? `&lesson=${encodeURIComponent(lessonId)}` : ""}`;

const thumb = (c, eager = false) =>
  `<img src="${esc(c.thumbnailUrl || "assets/img/thumb-fallback.svg")}" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async" width="1280" height="720">`;

export function initials(text) {
  return String(text || "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "AI";
}

function lessonMeta(c) {
  if (c.lessonCount) return `${c.lessonCount} video lesson${c.lessonCount > 1 ? "s" : ""}`;
  if (c.contents && c.contents.length) return `${c.contents.length} topics`;
  return "Video course";
}

/** Standard card for the public course grid. state: { owned, progress } */
export function courseCard(c, state = {}, index = 0) {
  const owned = state.owned;
  return `
    <article class="course-card" data-reveal style="--d:${(index % 3) * 80}ms">
      <div class="thumb">
        ${thumb(c)}
        ${c.featured ? `<span class="badge badge-hot"><span class="live-dot red"></span>Hot course</span>` : ""}
        ${owned ? `<span class="badge badge-owned" style="${c.featured ? "top:46px" : ""}">${icon.check}Owned</span>` : ""}
      </div>
      <div class="body">
        <span class="cat">${esc(c.category || "AI course")}</span>
        <h3><a class="stretched" href="${owned ? learnUrl(c) : courseUrl(c)}">${esc(c.shortTitle || c.title)}</a></h3>
        <p class="desc">${esc(c.shortDescription || "")}</p>
        ${owned && state.progress != null ? `<div class="progress" aria-label="${state.progress}% complete"><span style="width:${state.progress}%"></span></div>` : ""}
        <div class="foot">
          ${owned ? `<span class="meta">${state.progress != null ? `${state.progress}% complete` : lessonMeta(c)}</span><span class="btn btn-soft btn-sm">Continue ${icon.arrow}</span>`
                  : `<span class="price">${money(c.priceKobo, c.currency)}</span><span class="meta">${lessonMeta(c)}</span>`}
        </div>
      </div>
    </article>`;
}

/** Wide card for the flagship course. */
export function featuredCard(c, state = {}) {
  const owned = state.owned;
  return `
    <article class="course-featured" data-reveal>
      <div class="thumb">
        ${thumb(c, true)}
        <span class="badge badge-hot"><span class="live-dot red"></span>Hot course · No. 1</span>
      </div>
      <div class="body">
        <span class="eyebrow">${esc(c.category || "Flagship course")}</span>
        <h3>${esc(c.title)}</h3>
        <p class="desc">${esc(c.shortDescription || "")}</p>
        <div class="tags">${(c.tags || []).slice(0, 4).map((t) => `<span class="chip chip-outline">${esc(t)}</span>`).join("")}</div>
        <div class="foot">
          <div>
            <div class="price">${owned ? "You own this course" : money(c.priceKobo, c.currency)}</div>
            <div class="muted" style="font-size:14px">${lessonMeta(c)} · ${esc(c.difficulty || "Beginner")}</div>
          </div>
          ${owned ? `<a class="btn btn-primary" href="${learnUrl(c)}">Continue learning ${icon.arrow}</a>`
                  : `<a class="btn btn-primary" href="${courseUrl(c)}">View course ${icon.arrow}</a>`}
        </div>
      </div>
    </article>`;
}

/** Dashboard "Explore courses" card, modelled on distinction.app's catalogue cards. */
export function exploreCard(c, state = {}, index = 0) {
  const owned = state.owned;
  return `
    <article class="explore-card" data-reveal style="--d:${(index % 4) * 70}ms">
      <a class="thumb" href="${courseUrl(c)}" tabindex="-1" aria-hidden="true">${thumb(c)}</a>
      <div class="author"><span class="avatar">AF</span>AI Fountain Academy</div>
      <h3><a href="${courseUrl(c)}">${esc(c.shortTitle || c.title)}</a></h3>
      <div class="meta">${esc(c.category || "")} · ${lessonMeta(c)}</div>
      <div class="price ${owned ? "owned" : ""}">${owned ? "Owned" : money(c.priceKobo, c.currency)}</div>
      ${owned ? `<a class="btn btn-ghost btn-sm view" href="${learnUrl(c)}">Open course</a>`
              : `<a class="btn btn-ghost btn-sm view" href="${courseUrl(c)}">View Course</a>`}
    </article>`;
}

/** Dashboard "My courses" row card with progress. */
export function enrolledCard(c, state = {}, index = 0) {
  const pct = state.progress || 0;
  const revoked = state.revoked;
  return `
    <article class="enrolled-card ${revoked ? "is-revoked" : ""}" data-reveal style="--d:${(index % 3) * 70}ms" data-search="${esc(`${c.title} ${c.category} ${(c.tags || []).join(" ")}`.toLowerCase())}">
      <a class="thumb" href="${revoked ? courseUrl(c) : learnUrl(c)}">${thumb(c)}
        ${revoked ? "" : `<span class="play" aria-hidden="true">${icon.play}</span>`}
      </a>
      <div class="body">
        <span class="cat">${esc(c.category || "")}</span>
        <h3><a href="${revoked ? courseUrl(c) : learnUrl(c)}">${esc(c.shortTitle || c.title)}</a></h3>
        ${revoked ? `<p class="revoked-note">Access unavailable. Contact support if you think this is a mistake.</p>` : `
        <div class="progress-row">
          <div class="progress"><span style="width:${pct}%"></span></div>
          <span class="mono">${pct}%</span>
        </div>
        <a class="btn btn-primary btn-sm" href="${learnUrl(c)}">${pct > 0 ? "Continue learning" : "Start course"} ${icon.arrow}</a>`}
      </div>
    </article>`;
}

/** Category tile for the dashboard carousel. */
export function categoryCard(name, count, index = 0) {
  return `
    <button class="category-card" data-category="${esc(name)}" data-reveal style="--d:${index * 60}ms">
      <span class="badge-sq">${esc(initials(name))}</span>
      <span class="name">${esc(name)}</span>
      <span class="count">${count} course${count > 1 ? "s" : ""}</span>
    </button>`;
}
