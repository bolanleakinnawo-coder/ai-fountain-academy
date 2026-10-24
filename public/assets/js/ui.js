// Shared UI helpers: loader, nav and footer, toasts, dialogs, formatting and
// the text and scroll animations used across the site.
import { site, demoMode } from "./config.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- Escaping and formatting ---------------- */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function money(kobo, currency = "NGN") {
  const amount = Number(kobo || 0) / 100;
  if (currency === "NGN") return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
}

export function moneyExact(kobo, currency = "NGN") {
  const amount = Number(kobo || 0) / 100;
  if (currency === "NGN") return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
}

export function duration(seconds) {
  const s = Math.round(Number(seconds || 0));
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} hr${h > 1 ? "s" : ""}${m ? ` ${m} min${m > 1 ? "s" : ""}` : ""}`;
  if (m) return `${m} min${m > 1 ? "s" : ""}`;
  return `${s} sec`;
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function date(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function dateTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------- Page loader ---------------- */
// The loader markup lives inline in each page so it paints instantly.
// The full loader shows on the first page of a visit; afterwards a thin top bar.
const loaderEl = document.querySelector(".page-loader");
const startedAt = performance.now();
let firstVisit = true;
try {
  firstVisit = !sessionStorage.getItem("afa_seen");
  sessionStorage.setItem("afa_seen", "1");
} catch { /* storage blocked */ }

let bar;
if (loaderEl && !firstVisit) {
  loaderEl.classList.add("done");
  bar = document.createElement("div");
  bar.className = "top-progress";
  document.body.appendChild(bar);
  requestAnimationFrame(() => { bar.style.width = "70%"; });
}

/* ---------------- Preview mode notice ---------------- */
if (demoMode) {
  let hidden = false;
  try { hidden = sessionStorage.getItem("afa_demo_note") === "x"; } catch { /* ignore */ }
  if (!hidden) {
    const note = document.createElement("div");
    note.className = "demo-note";
    note.innerHTML = `<span class="live-dot"></span><span><strong>Preview mode</strong> · sample data, nothing is saved. Paste your Firebase config in <code>assets/js/config.js</code> to go live.</span><button aria-label="Hide">×</button>`;
    note.querySelector("button").onclick = () => { note.remove(); try { sessionStorage.setItem("afa_demo_note", "x"); } catch { /* ignore */ } };
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(note));
    if (document.readyState !== "loading") document.body.appendChild(note);
  }
}

let isReady = false;
export function pageReady() {
  if (isReady) return;
  isReady = true;
  const minTime = firstVisit ? 650 : 0;
  const wait = Math.max(0, minTime - (performance.now() - startedAt));
  setTimeout(() => {
    loaderEl && loaderEl.classList.add("done");
    document.documentElement.classList.add("is-ready");
    if (bar) {
      bar.style.width = "100%";
      setTimeout(() => { bar.style.opacity = "0"; }, 250);
      setTimeout(() => bar.remove(), 700);
    }
    startAnimations();
  }, wait);
}
// Never leave someone stuck behind the loader.
setTimeout(pageReady, 7000);

/* ---------------- Toasts ---------------- */
let stack;
export function toast(message, type = "") {
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  stack.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 3800);
}

/* ---------------- Dialogs ---------------- */
export function confirmDialog({ title, body, confirmText = "Confirm", danger = false, requireText = "", inputLabel = "" }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "dialog-backdrop";
    wrap.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h3 id="dlg-title">${esc(title)}</h3>
        <p>${body}</p>
        ${requireText || inputLabel ? `
          <div class="field">
            <label for="dlg-input">${esc(inputLabel || `Type "${requireText}" to confirm`)}</label>
            <input class="input" id="dlg-input" autocomplete="off">
          </div>` : ""}
        <div class="actions">
          <button class="btn btn-ghost" data-act="cancel">Cancel</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok" ${requireText ? "disabled" : ""}>${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector("#dlg-input");
    const ok = wrap.querySelector('[data-act="ok"]');
    if (input) {
      input.focus();
      input.addEventListener("input", () => {
        ok.disabled = requireText ? input.value.trim() !== requireText : !input.value.trim();
      });
      if (!requireText) ok.disabled = true;
    } else ok.focus();
    const close = (val) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(val); };
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.dataset.act === "cancel") close(false);
      if (e.target.dataset.act === "ok") close(input ? input.value.trim() || true : true);
    });
  });
}

/* ---------------- Buttons ---------------- */
export function setLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle("is-loading", loading);
  btn.disabled = loading;
  btn.setAttribute("aria-busy", loading ? "true" : "false");
}

/* ---------------- Skeletons ---------------- */
export function skeletonCards(n = 3) {
  return Array.from({ length: n }, () => `
    <div class="skel-card" aria-hidden="true">
      <div class="skel skel-thumb"></div>
      <div class="skel skel-line" style="width:30%;margin-top:18px"></div>
      <div class="skel skel-title"></div>
      <div class="skel skel-line"></div>
      <div class="skel skel-line" style="width:60%"></div>
    </div>`).join("");
}

export function skeletonRows(n = 5, cols = 4) {
  return Array.from({ length: n }, () => `<tr>${Array.from({ length: cols }, () => `<td><div class="skel skel-line"></div></td>`).join("")}</tr>`).join("");
}

/* ---------------- Icons ---------------- */
export const icon = {
  arrow: `<svg class="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  play: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z" fill="currentColor"/></svg>`,
  lock: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" stroke-width="1.5"/></svg>`,
  check: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  eye: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>`,
  eyeOff: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  book: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" stroke="currentColor" stroke-width="1.6"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" stroke="currentColor" stroke-width="1.6"/></svg>`,
  google: `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`,
};

/* ---------------- Wordmark, nav and footer ---------------- */
export const wordmark = (dark = false) =>
  `<a href="index.html" class="wordmark ${dark ? "on-dark" : ""}" aria-label="AI Fountain Academy home"><span class="drop" aria-hidden="true"></span>AI Fountain <small>Academy</small></a>`;

export function mountSiteNav({ active = "" } = {}) {
  const el = document.querySelector("[data-site-nav]");
  if (!el) return;
  const link = (href, label, key) => `<a href="${href}" class="${active === key ? "active" : ""}">${label}</a>`;
  el.outerHTML = `
    <header class="site-nav" id="site-nav">
      <div class="container bar">
        ${wordmark()}
        <nav class="links" aria-label="Main">
          ${link("index.html", "Home", "home")}
          ${link("courses.html", "Courses", "courses")}
          ${link("index.html#how", "How it works", "how")}
          ${link("index.html#faq", "FAQ", "faq")}
        </nav>
        <div class="actions" data-nav-actions>
          <a href="login.html" class="btn btn-ghost btn-sm hide-sm">Log in</a>
          <a href="signup.html" class="btn btn-primary btn-sm">Get started ${icon.arrow}</a>
          <button class="nav-toggle" aria-label="Open menu" aria-expanded="false"><span></span></button>
        </div>
      </div>
      <div class="mobile-menu" id="mobile-menu">
        <a class="m-link" href="index.html">Home</a>
        <a class="m-link" href="courses.html">Courses</a>
        <a class="m-link" href="index.html#how">How it works</a>
        <a class="m-link" href="index.html#faq">FAQ</a>
        <div class="m-actions" data-mobile-actions>
          <a href="login.html" class="btn btn-ghost btn-lg">Log in</a>
          <a href="signup.html" class="btn btn-primary btn-lg">Get started</a>
        </div>
      </div>
    </header>`;
  const nav = document.getElementById("site-nav");
  const toggle = nav.querySelector(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll(".mobile-menu a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("nav-open")));
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/** Swap the nav's Log in / Get started for Dashboard when signed in. */
export function setNavSignedIn(user) {
  if (!user) return;
  const actions = document.querySelector("[data-nav-actions]");
  const mobile = document.querySelector("[data-mobile-actions]");
  if (actions) {
    actions.querySelectorAll("a").forEach((a) => a.remove());
    actions.insertAdjacentHTML("afterbegin", `<a href="dashboard.html" class="btn btn-primary btn-sm">Dashboard ${icon.arrow}</a>`);
  }
  if (mobile) mobile.innerHTML = `<a href="dashboard.html" class="btn btn-primary btn-lg">Go to dashboard</a>`;
}

export function mountFooter() {
  const el = document.querySelector("[data-site-footer]");
  if (!el) return;
  const year = new Date().getFullYear();
  el.outerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="cols">
          <div>
            ${wordmark()}
            <p class="about">Practical video courses on the AI tools people use to create, sell and build. Learn step by step, on any device.</p>
          </div>
          <div>
            <h4>Academy</h4>
            <ul><li><a href="index.html">Home</a></li><li><a href="courses.html">Courses</a></li><li><a href="index.html#how">How it works</a></li><li><a href="index.html#faq">FAQ</a></li></ul>
          </div>
          <div>
            <h4>Account</h4>
            <ul><li><a href="login.html">Log in</a></li><li><a href="signup.html">Create account</a></li><li><a href="dashboard.html">Dashboard</a></li></ul>
          </div>
          <div>
            <h4>Support</h4>
            <ul><li><a href="contact.html">Contact</a></li><li><a href="privacy.html">Privacy Policy</a></li><li><a href="terms.html">Terms and Conditions</a></li></ul>
          </div>
        </div>
        <div class="base">
          <span>© ${year} ${esc(site.name)}. All rights reserved.</span>
          <span class="mono" style="font-size:12px">Payments secured by Paystack</span>
        </div>
      </div>
    </footer>`;
}

/* ---------------- Text and scroll animations ---------------- */

/** Wraps each word of an element in masks so it can rise into view. */
export function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = "1";
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement("span");
          w.className = "w";
          const inner = document.createElement("span");
          inner.textContent = part;
          inner.style.setProperty("--i", i++);
          w.appendChild(inner);
          frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.classList.contains("no-split")) {
        walk(child);
      }
    });
  };
  walk(el);
  el.classList.add("split");
}

/** Scrambles text characters before settling on the final string. */
export function scramble(el) {
  const final = el.dataset.text || el.textContent;
  el.dataset.text = final;
  if (reduceMotion) { el.textContent = final; return; }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>_";
  let frame = 0;
  const total = 22;
  const tick = () => {
    const progress = frame / total;
    el.textContent = final.split("").map((c, idx) => {
      if (c === " " || idx / final.length < progress) return c;
      return chars[Math.floor(Math.random() * chars.length)];
    }).join("");
    if (frame++ < total) requestAnimationFrame(tick);
    else el.textContent = final;
  };
  tick();
}

/** Cycles through words with a vertical slide. Markup: <span data-rotate="a|b|c"></span> */
export function rotateWords(el) {
  const words = el.dataset.rotate.split("|");
  el.classList.add("rotator");
  el.innerHTML = words.map((w, i) => `<span class="rw ${i === 0 ? "on" : ""}">${esc(w)}</span>`).join("");
  const items = [...el.children];
  const sizer = () => { el.style.width = `${items.find((x) => x.classList.contains("on")).offsetWidth}px`; };
  sizer();
  if (reduceMotion || words.length < 2) return;
  let i = 0;
  setInterval(() => {
    const cur = items[i];
    i = (i + 1) % items.length;
    const next = items[i];
    cur.classList.remove("on");
    cur.classList.add("off");
    next.classList.remove("off");
    next.classList.add("on");
    el.style.width = `${next.offsetWidth}px`;
    setTimeout(() => cur.classList.remove("off"), 700);
  }, 2400);
  window.addEventListener("resize", sizer);
}

let observer;
/** Watches [data-reveal], [data-split] and [data-scramble] elements and animates them into view.
 *  Safe to call again after rendering new content. */
export function observeReveals(root = document) {
  const targets = $$("[data-reveal], [data-split], [data-scramble]", root).filter((el) => !el.dataset.observed);
  targets.forEach((el) => { if (el.hasAttribute("data-split")) splitWords(el); });
  if (!isReady) return; // picked up by startAnimations() once the loader is gone
  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach((el) => { el.dataset.observed = "1"; el.classList.add("in"); });
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("in");
        if (el.hasAttribute("data-scramble")) scramble(el);
        observer.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  }
  targets.forEach((el) => { el.dataset.observed = "1"; observer.observe(el); });
}

function startAnimations() {
  $$("[data-rotate]").forEach((el) => { if (!el.classList.contains("rotator")) rotateWords(el); });
  observeReveals(document);
}

/** Smooth cross-fade between pages where the browser supports View Transitions. */
export function enablePageTransitions() {
  const meta = document.createElement("style");
  meta.textContent = "@view-transition { navigation: auto; }";
  document.head.appendChild(meta);
}

/** Bootstraps chrome common to public pages. */
export function initPublicPage(opts = {}) {
  mountSiteNav(opts);
  mountFooter();
  enablePageTransitions();
  $$("[data-split]").forEach(splitWords);
}
