import { initPublicPage, setNavSignedIn, pageReady, observeReveals, skeletonCards, $, esc } from "../ui.js";
import { currentUser } from "../auth.js";
import { listPublishedCourses, getMyEntitlements, getSiteSettings } from "../data.js";
import { courseCard, featuredCard } from "../components.js";

initPublicPage({ active: "home" });

const featuredSlot = $("#featured-slot");
const grid = $("#course-grid");
featuredSlot.innerHTML = `<div class="skel" style="height:360px;border-radius:30px"></div>`;
grid.innerHTML = skeletonCards(3);

async function loadCourses() {
  try {
    const [courses, user] = await Promise.all([listPublishedCourses(), currentUser()]);
    let owned = {};
    if (user) {
      setNavSignedIn(user);
      owned = await getMyEntitlements(user.uid).catch(() => ({}));
    }
    const isOwned = (c) => owned[c.id] && owned[c.id].status === "active";
    if (!courses.length) {
      featuredSlot.innerHTML = "";
      grid.outerHTML = `<div class="empty-state"><h3>New courses are on the way</h3><p>Create an account and you'll see them on your dashboard as soon as they're published.</p><a class="btn btn-primary" href="signup.html">Create account</a></div>`;
      return;
    }
    const featured = courses.find((c) => c.featured) || courses[0];
    const rest = courses.filter((c) => c.id !== featured.id);
    featuredSlot.innerHTML = featuredCard(featured, { owned: isOwned(featured) });
    grid.innerHTML = rest.map((c, i) => courseCard(c, { owned: isOwned(c) }, i)).join("");
  } catch (err) {
    console.error(err);
    featuredSlot.innerHTML = "";
    grid.outerHTML = `<div class="empty-state"><h3>Courses couldn't load</h3><p>Check your connection and refresh the page.</p><button class="btn btn-ghost" onclick="location.reload()">Try again</button></div>`;
  } finally {
    observeReveals(document);
  }
}

loadCourses().finally(pageReady);

/* ---------- See it in action: expand the small preview to full screen ---------- */
const card = $("#action-card");
const smallVideo = $("#action-video");
const theater = $("#theater");
const frame = $("#theater-frame");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let previewUrl = null;
let bigVideo = null;
let lastFocus = null;

getSiteSettings().then((s) => {
  if (s.previewVideoUrl) {
    previewUrl = s.previewVideoUrl;
    smallVideo.innerHTML = `<source src="${esc(previewUrl)}">`;
    smallVideo.load();
  }
  if (s.previewPoster) smallVideo.poster = s.previewPoster;
});

// Autoplay the muted mini preview only while it's on screen.
if ("IntersectionObserver" in window && !reduce) {
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) smallVideo.play().catch(() => {});
    else smallVideo.pause();
  }).observe(smallVideo);
}

function targetRect() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = vw < 640 ? 0 : 48;
  const captionSpace = vw < 640 ? 120 : 110;
  let w = Math.min(vw - pad * 2, 1280);
  let h = (w * 9) / 16;
  if (h > vh - captionSpace - 40) { h = vh - captionSpace - 40; w = (h * 16) / 9; }
  return { left: (vw - w) / 2, top: Math.max(16, (vh - h - captionSpace) / 2 + 10), width: w, height: h };
}

function place(el, r) {
  Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
}

function buildVideo() {
  const v = document.createElement("video");
  v.controls = true;
  v.playsInline = true;
  v.poster = smallVideo.poster;
  v.setAttribute("controlsList", "nodownload");
  if (previewUrl) v.src = previewUrl;
  else v.innerHTML = smallVideo.innerHTML;
  v.addEventListener("error", showMissing, true);
  return v;
}

function showMissing() {
  frame.innerHTML = `
    <div class="theater-missing" style="background-image:url('${esc(smallVideo.poster)}')">
      <div>
        <strong style="font-size:22px">The preview video is being uploaded</strong>
        <span style="color:#cfd6ea">See everything the course covers on its page.</span>
        <a class="btn btn-primary" href="course.html?slug=swap-faces-live-calls">View the course</a>
      </div>
    </div>`;
}

async function openTheater() {
  lastFocus = document.activeElement;
  const from = $(".action-media", card).getBoundingClientRect();
  const to = targetRect();
  theater.hidden = false;
  document.body.style.overflow = "hidden";
  frame.innerHTML = "";
  bigVideo = buildVideo();
  bigVideo.currentTime = smallVideo.currentTime || 0;
  frame.appendChild(bigVideo);
  place(frame, to);
  bigVideo.play().catch(() => {});
  smallVideo.pause();

  requestAnimationFrame(() => theater.classList.add("open"));
  if (!reduce) {
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    frame.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: "40px" },
      { transform: "none", borderRadius: window.innerWidth < 640 ? "0px" : "18px" },
    ], { duration: 720, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
  }
  frame.style.borderRadius = window.innerWidth < 640 ? "0px" : "18px";
  $("#theater-close").focus();
}

async function closeTheater() {
  const to = $(".action-media", card).getBoundingClientRect();
  const from = frame.getBoundingClientRect();
  theater.classList.remove("open");
  if (bigVideo) bigVideo.pause();
  if (!reduce) {
    const anim = frame.animate([
      { transform: "none", opacity: 1 },
      { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: .6 },
    ], { duration: 520, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" });
    await anim.finished.catch(() => {});
  }
  frame.getAnimations().forEach((a) => a.cancel());
  frame.innerHTML = "";
  bigVideo = null;
  theater.hidden = true;
  document.body.style.overflow = "";
  smallVideo.play().catch(() => {});
  lastFocus && lastFocus.focus();
}

card.addEventListener("click", openTheater);
$("#theater-close").addEventListener("click", closeTheater);
theater.addEventListener("click", (e) => { if (e.target === theater) closeTheater(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !theater.hidden) closeTheater(); });
window.addEventListener("resize", () => { if (!theater.hidden) place(frame, targetRect()); });

/* ---------- Scroll-linked motion ---------- */
if (!reduce) {
  // Hero mockups drift gently with the pointer.
  const visual = $(".hero-visual");
  const layers = [...document.querySelectorAll("[data-parallax]")];
  if (visual && window.matchMedia("(pointer: fine)").matches) {
    let raf;
    visual.closest(".hero").addEventListener("pointermove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        layers.forEach((el) => {
          const f = Number(el.dataset.parallax) * 10;
          el.style.marginLeft = `${x * f}px`;
          el.style.marginTop = `${y * f}px`;
        });
      });
    });
  }

  // "Inside the platform": browser tilts flat and the phone slides in as you scroll.
  const stage = $("#inside-stage");
  const browser = $("#inside-browser");
  const phone = $("#inside-phone");
  const stepsFill = $("#steps-line-fill");
  const steps = $("#steps");
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = window.innerHeight;
      const r = stage.getBoundingClientRect();
      const p = clamp((vh - r.top) / (vh * 0.85));
      browser.style.setProperty("--tilt", `${22 * (1 - p)}deg`);
      browser.style.setProperty("--scale", `${0.92 + 0.08 * p}`);
      phone.style.setProperty("--phone-y", `${80 * (1 - clamp(p * 1.3 - 0.3))}px`);
      phone.style.setProperty("--phone-o", `${clamp(p * 1.6 - 0.5)}`);
      const s = steps.getBoundingClientRect();
      stepsFill.style.setProperty("--p", clamp((vh * 0.85 - s.top) / (s.height + vh * 0.3)));
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
} else {
  document.documentElement.style.setProperty("--tilt", "0deg");
}
