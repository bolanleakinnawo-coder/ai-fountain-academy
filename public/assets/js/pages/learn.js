import { pageReady, esc, duration, toast, setLoading, enablePageTransitions, icon, $, $$ } from "../ui.js";
import { requireUser, isAdmin } from "../auth.js";
import { getCourseBySlug, listPublishedLessons, getEntitlement, getCourseProgress, saveProgress, saveLastLesson } from "../data.js";
import { getPlaybackUrl, apiMessage } from "../api.js";
import { courseUrl } from "../components.js";

enablePageTransitions();
const user = await requireUser();
const slug = new URLSearchParams(location.search).get("slug") || "";

let course, lessons = [], progress = {}, current = -1, video = null, saveTimer = null, lastSaved = 0;

function locked(title, body, action) {
  $("#learn-body").outerHTML = `
    <div class="locked">
      <span class="ic">${icon.lock.replace(/15/g, "30")}</span>
      <h1>${esc(title)}</h1>
      <p>${body}</p>
      ${action}
    </div>`;
}

function ring(pct) {
  const r = 14, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 34 34"><circle class="bg" cx="17" cy="17" r="${r}"/><circle class="fg" cx="17" cy="17" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg>`;
}

function renderProgress() {
  const done = lessons.filter((l) => progress[l.id] && progress[l.id].completed).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  $("#lt-progress").innerHTML = `${ring(pct)}<span>${done}/${lessons.length} done</span>`;
}

function renderCurriculum() {
  const total = lessons.reduce((s, l) => s + (Number(l.durationSeconds) || 0), 0);
  $("#curriculum").innerHTML = `
    <h2>Course content</h2>
    <p class="sub">${lessons.length} lesson${lessons.length === 1 ? "" : "s"}${total ? ` · ${duration(total)}` : ""}</p>
    <div class="cur-list">
      ${lessons.map((l, i) => {
        const done = progress[l.id] && progress[l.id].completed;
        const on = i === current;
        return `<button class="cur-item ${done ? "done" : ""} ${on ? "on" : ""}" data-i="${i}" ${on ? 'aria-current="true"' : ""}>
          <span class="st">${done && !on ? icon.check : i + 1}</span>
          <span class="tt">${esc(l.title)}</span>
          <span class="du">${on ? '<span class="eq"><i></i><i></i><i></i></span>' : l.durationSeconds ? duration(l.durationSeconds) : ""}</span>
        </button>`;
      }).join("")}
    </div>`;
}

function renderInfo() {
  const l = lessons[current];
  const done = progress[l.id] && progress[l.id].completed;
  $("#lesson-info").innerHTML = `
    <span class="kick">Lesson ${current + 1} of ${lessons.length}</span>
    <h1>${esc(l.title)}</h1>
    ${l.description ? `<p class="desc">${esc(l.description)}</p>` : ""}
    <div class="lesson-actions">
      <button class="btn btn-dark-ghost" id="prev" ${current === 0 ? "disabled" : ""}>Previous</button>
      <button class="btn btn-primary" id="next" ${current === lessons.length - 1 ? "disabled" : ""}>Next lesson ${icon.arrow}</button>
      <span class="spacer"></span>
      <button class="btn btn-dark-ghost btn-complete ${done ? "done" : ""}" id="complete">${done ? `${icon.check} Completed` : "Mark as complete"}</button>
    </div>`;
  $("#prev").addEventListener("click", () => openLesson(current - 1));
  $("#next").addEventListener("click", () => openLesson(current + 1));
  $("#complete").addEventListener("click", toggleComplete);
}

async function persist(extra = {}) {
  const l = lessons[current];
  if (!l) return;
  const prev = progress[l.id] || {};
  const data = {
    courseId: course.id,
    completed: extra.completed ?? !!prev.completed,
    positionSeconds: video && !isNaN(video.currentTime) ? video.currentTime : prev.positionSeconds || 0,
  };
  progress[l.id] = data;
  lastSaved = Date.now();
  try { await saveProgress(user.uid, l.id, data); } catch (err) { console.warn("Progress not saved", err); }
}

async function toggleComplete() {
  const btn = $("#complete");
  const l = lessons[current];
  const done = !(progress[l.id] && progress[l.id].completed);
  setLoading(btn, true);
  await persist({ completed: done });
  setLoading(btn, false);
  renderInfo(); renderCurriculum(); renderProgress();
  if (done) toast("Lesson marked as complete", "success");
}

function upNext() {
  if (current >= lessons.length - 1) {
    toast("You've finished the last lesson. Well done!", "success");
    return;
  }
  const n = lessons[current + 1];
  const box = document.createElement("div");
  box.className = "up-next";
  box.innerHTML = `<small>Up next</small><strong>${esc(n.title)}</strong><div class="count-bar"><span></span></div>
    <div class="row"><button class="btn btn-primary btn-sm" data-go>Play now</button><button class="btn btn-dark-ghost btn-sm" data-stay>Cancel</button></div>`;
  $("#player").appendChild(box);
  const t = setTimeout(() => openLesson(current + 1), 6000);
  box.querySelector("[data-go]").onclick = () => { clearTimeout(t); openLesson(current + 1); };
  box.querySelector("[data-stay]").onclick = () => { clearTimeout(t); box.remove(); };
}

async function openLesson(i) {
  if (i < 0 || i >= lessons.length) return;
  if (video) { await persist(); video.pause(); }
  clearInterval(saveTimer);
  current = i;
  const l = lessons[i];
  history.replaceState(null, "", `${location.pathname}?slug=${encodeURIComponent(slug)}&lesson=${encodeURIComponent(l.id)}`);
  renderInfo(); renderCurriculum(); renderProgress();
  const player = $("#player");
  player.innerHTML = `<div class="player-loading"><span class="spinner"></span></div>`;
  saveLastLesson(user.uid, { courseId: course.id, lessonId: l.id, lessonTitle: l.title }).catch(() => {});

  try {
    const { url } = await getPlaybackUrl({ courseId: course.id, lessonId: l.id });
    if (current !== i) return; // user moved on while loading
    video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.poster = course.thumbnailUrl || "";
    video.setAttribute("controlsList", "nodownload noplaybackrate");
    video.disablePictureInPicture = false;
    video.addEventListener("contextmenu", (e) => e.preventDefault());
    video.src = url;
    player.innerHTML = "";
    player.appendChild(video);
    const resume = progress[l.id] && progress[l.id].positionSeconds;
    video.addEventListener("loadedmetadata", () => {
      if (resume && resume < video.duration - 5) video.currentTime = resume;
    }, { once: true });
    video.addEventListener("pause", () => persist());
    video.addEventListener("ended", async () => {
      await persist({ completed: true });
      renderInfo(); renderCurriculum(); renderProgress();
      upNext();
    });
    video.addEventListener("error", () => {
      // Signed URLs expire; fetch a fresh one once.
      if (!video.dataset.retried) { video.dataset.retried = "1"; openLesson(current); }
    });
    saveTimer = setInterval(() => { if (video && !video.paused && Date.now() - lastSaved > 15000) persist(); }, 5000);
    video.play().catch(() => {});
  } catch (err) {
    console.error(err);
    player.innerHTML = `<div class="player-msg" style="background-image:url('${esc(course.thumbnailUrl || "")}')"><div><h2>This lesson can't play right now</h2><p>${esc(apiMessage(err))}</p><button class="btn btn-primary" id="retry">Try again</button></div></div>`;
    $("#retry").onclick = () => openLesson(i);
  }
}

window.addEventListener("pagehide", () => { if (video) persist(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && video) persist(); });

$("#curriculum").addEventListener("click", (e) => {
  const b = e.target.closest("[data-i]");
  if (b) {
    openLesson(Number(b.dataset.i));
    if (window.innerWidth < 1000) window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

async function load() {
  try {
    course = await getCourseBySlug(slug);
    if (!course) {
      locked("Course not found", "This course may have been renamed or unpublished.", `<a class="btn btn-primary" href="dashboard.html">Back to dashboard</a>`);
      return;
    }
    document.title = `${course.shortTitle || course.title} · AI Fountain Academy`;
    $("#lt-title").textContent = course.title;
    const [ent, admin] = await Promise.all([getEntitlement(user.uid, course.id).catch(() => null), isAdmin(user)]);
    if (!admin && (!ent || ent.status !== "active")) {
      if (ent && ent.status === "revoked") {
        locked("Access unavailable", "Your access to this course has been turned off. If you think this is a mistake, please contact support.", `<a class="btn btn-primary" href="contact.html">Contact support</a>`);
      } else {
        locked("This course is locked", "Enrol in the course to watch its lessons.", `<a class="btn btn-primary" href="${courseUrl(course)}">View course and enrol</a>`);
      }
      return;
    }
    [lessons, progress] = await Promise.all([listPublishedLessons(course.id), getCourseProgress(user.uid, course.id).catch(() => ({}))]);
    if (!lessons.length) {
      locked("Lessons are on the way", "You own this course. The first lessons are being uploaded and will appear here automatically.", `<a class="btn btn-primary" href="dashboard.html">Back to dashboard</a>`);
      return;
    }
    const wanted = new URLSearchParams(location.search).get("lesson");
    let start = lessons.findIndex((l) => l.id === wanted);
    if (start < 0) start = lessons.findIndex((l) => !(progress[l.id] && progress[l.id].completed));
    if (start < 0) start = 0;
    openLesson(start);
  } catch (err) {
    console.error(err);
    locked("Something went wrong", "We couldn't load this course. Check your connection and try again.", `<button class="btn btn-primary" onclick="location.reload()">Try again</button>`);
  } finally {
    pageReady();
  }
}

load();
