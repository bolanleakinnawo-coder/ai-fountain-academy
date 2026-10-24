import { initPublicPage, setNavSignedIn, pageReady, observeReveals, esc, moneyExact, duration, setLoading, toast, icon, $ } from "../ui.js";
import { currentUser, currentPagePath } from "../auth.js";
import { getCourseBySlug, listPublishedLessons, getEntitlement, getMyPayments } from "../data.js";
import { startCheckout, apiMessage } from "../api.js";
import { learnUrl } from "../components.js";

initPublicPage({ active: "courses" });

const root = $("#course-root");
const slug = new URLSearchParams(location.search).get("slug") || "";

function notFound() {
  document.title = "Course not found · AI Fountain Academy";
  root.innerHTML = `
    <div class="container center-page"><div class="notfound">
      <div class="big">404</div><h1 class="h2">We couldn't find that course</h1>
      <p class="muted">It may have been renamed or unpublished.</p>
      <a href="courses.html" class="btn btn-primary">See all courses</a>
    </div></div>`;
}

// Works out which access state the page is in.
function accessState(ent, payments, course) {
  if (ent && ent.status === "active") return "owned";
  if (ent && ent.status === "revoked") return "revoked";
  const recent = payments.find((p) => p.courseId === course.id);
  if (recent && recent.status === "pending") {
    const created = recent.createdAt && recent.createdAt.toDate ? recent.createdAt.toDate() : new Date(0);
    if (Date.now() - created.getTime() < 60 * 60 * 1000) return { state: "pending", reference: recent.reference };
  }
  return "none";
}

function render(course, lessons, access, user) {
  document.title = `${course.title} · AI Fountain Academy`;
  const state = typeof access === "object" ? access.state : access;
  const lessonsTotal = lessons.reduce((s, l) => s + (Number(l.durationSeconds) || 0), 0);
  const contentRows = lessons.length
    ? lessons.map((l, i) => `
        <div class="row">
          <span class="idx">${String(i + 1).padStart(2, "0")}</span>
          <span class="ttl">${esc(l.title)}${l.description ? `<small>${esc(l.description)}</small>` : ""}</span>
          <span class="rt">${l.durationSeconds ? duration(l.durationSeconds) : ""} ${state === "owned" ? icon.play : icon.lock}</span>
        </div>`).join("")
    : (course.contents || []).map((t, i) => `
        <div class="row">
          <span class="idx">${String(i + 1).padStart(2, "0")}</span>
          <span class="ttl">${esc(t)}</span>
          <span class="rt">${state === "owned" ? "" : icon.lock}</span>
        </div>`).join("");
  const count = lessons.length || (course.contents || []).length;
  const countLabel = lessons.length ? `${lessons.length} video lesson${lessons.length > 1 ? "s" : ""}` : `${count} topics`;
  const objectives = course.objectives || [];

  let cta;
  if (state === "owned") {
    cta = `<div class="state-box owned">You own this course.</div><a class="btn btn-primary btn-lg btn-block" href="${learnUrl(course)}">Continue learning ${icon.arrow}</a>`;
  } else if (state === "revoked") {
    cta = `<div class="state-box revoked">Your access to this course is unavailable. Please contact support.</div><a class="btn btn-ghost btn-lg btn-block" href="contact.html">Contact support</a>`;
  } else if (state === "pending") {
    cta = `<div class="state-box pending">Your last payment is still being confirmed.</div>
           <a class="btn btn-primary btn-lg btn-block" href="checkout-callback.html?reference=${encodeURIComponent(access.reference)}">Check payment status</a>
           <button class="btn btn-link btn-block" style="margin-top:12px" data-enrol>Start a new payment instead</button>`;
  } else {
    cta = `<button class="btn btn-primary btn-lg btn-block" data-enrol>Enrol now (${moneyExact(course.priceKobo, course.currency)})</button>`;
  }

  root.innerHTML = `
    <div class="container course-page">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="courses.html">Courses</a><span>/</span><span aria-current="page">${esc(course.shortTitle || course.title)}</span></nav>
      <div class="course-layout">
        <div class="course-main">
          <div class="tags" data-reveal>${(course.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
          <h1 data-split>${esc(course.title)}</h1>
          <p class="short" data-reveal>${esc(course.shortDescription || "")}</p>

          ${course.summary30s ? `
          <div class="in30" data-reveal>
            <span class="eyebrow">In 30 seconds</span>
            <p>${esc(course.summary30s)}</p>
            ${objectives.length ? `<ul>${objectives.slice(0, 4).map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
          </div>` : ""}

          ${course.overview ? `
          <div class="block overview clamped" id="overview" data-reveal>
            <h2>Course overview</h2>
            <p>${esc(course.overview)}</p>
            <button class="btn btn-link" id="more" style="margin-top:10px">Show more</button>
          </div>` : ""}

          ${objectives.length ? `
          <div class="block" data-reveal>
            <h2>What you'll learn</h2>
            <ul class="check-list">${objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
          </div>` : ""}

          ${count ? `
          <div class="block" data-reveal>
            <div class="content-head"><h2>Course content</h2><span>${countLabel}${lessonsTotal ? ` · ${duration(lessonsTotal)}` : ""}</span></div>
            <div class="content-list">${contentRows}</div>
          </div>` : ""}
        </div>

        <aside class="course-side">
          <div class="buy-card" data-reveal="scale">
            <div class="thumb"><img src="${esc(course.thumbnailUrl || "assets/img/thumb-fallback.svg")}" alt="${esc(course.title)} thumbnail"></div>
            <div class="inner">
              ${state === "owned" ? "" : `<div class="price">${moneyExact(course.priceKobo, course.currency)}</div>`}
              <h3>This course includes</h3>
              <ul class="includes">
                <li><span>Length</span><span>${countLabel}</span></li>
                ${lessonsTotal ? `<li><span>Duration</span><span>${duration(lessonsTotal)}</span></li>` : ""}
                <li><span>Difficulty</span><span>${esc(course.difficulty || "Beginner")}</span></li>
                <li><span>Language</span><span>${esc(course.language || "English")}</span></li>
                <li><span>Format</span><span>Video lessons</span></li>
                <li><span>Access</span><span>Phone, tablet, laptop</span></li>
              </ul>
              ${cta}
              ${state === "none" || state === "pending" ? `<p class="buy-note">${icon.lock} Secure payment with Paystack</p>` : ""}
            </div>
          </div>
        </aside>
      </div>
    </div>
    ${state === "none" ? `<div class="mobile-buy" id="mobile-buy"><span class="p">${moneyExact(course.priceKobo, course.currency)}</span><button class="btn btn-primary" data-enrol>Enrol now</button></div>` : ""}`;

  const more = $("#more");
  if (more) {
    const ov = $("#overview");
    if (ov.querySelector("p").scrollHeight <= ov.querySelector("p").clientHeight + 4) more.remove();
    else more.addEventListener("click", () => { const c = ov.classList.toggle("clamped"); more.textContent = c ? "Show more" : "Show less"; });
  }

  root.querySelectorAll("[data-enrol]").forEach((b) => b.addEventListener("click", () => enrol(course, user, b)));

  const mobileBuy = $("#mobile-buy");
  const buyCard = $(".buy-card");
  if (mobileBuy && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => mobileBuy.classList.toggle("show", !e.isIntersecting && e.boundingClientRect.top < 0)).observe(buyCard);
  }
  observeReveals(root);
}

async function enrol(course, user, btn) {
  if (!user) {
    location.href = `signup.html?next=${encodeURIComponent(currentPagePath())}`;
    return;
  }
  setLoading(btn, true);
  try {
    const res = await startCheckout({ courseId: course.id });
    if (res.alreadyOwned) { location.href = learnUrl(course); return; }
    sessionStorage.setItem("afa_pending_ref", res.reference);
    location.href = res.authorizationUrl;
  } catch (err) {
    console.error(err);
    toast(apiMessage(err), "error");
    setLoading(btn, false);
  }
}

async function load() {
  if (!slug) return notFound();
  try {
    const [course, user] = await Promise.all([getCourseBySlug(slug), currentUser()]);
    if (!course) return notFound();
    if (user) setNavSignedIn(user);
    const [lessons, ent, payments] = await Promise.all([
      listPublishedLessons(course.id).catch(() => []),
      user ? getEntitlement(user.uid, course.id).catch(() => null) : null,
      user ? getMyPayments(user.uid).catch(() => []) : [],
    ]);
    render(course, lessons, accessState(ent, payments, course), user);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="container center-page"><div class="empty-state"><h3>This page couldn't load</h3><p>Check your connection and try again.</p><button class="btn btn-ghost" onclick="location.reload()">Try again</button></div></div>`;
  }
}

load().finally(pageReady);
