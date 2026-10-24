import { pageReady, esc, duration, toast, setLoading, confirmDialog, $, $$ } from "../ui.js";
import { initAdmin, pill } from "../admin-shell.js";
import { db, storage } from "../firebase.js";
import { showAlert, fieldError } from "../forms.js";
import { adminDeleteLesson, apiMessage } from "../api.js";
import {
  collection, doc, getDoc, getDocs, setDoc, query, orderBy, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

await initAdmin();
const courseId = new URLSearchParams(location.search).get("course");
if (!courseId) location.replace("admin/courses.html");
const courseRef = doc(db, "courses", courseId);
const lessonsCol = collection(db, "courses", courseId, "lessons");
const list = $("#lesson-rows");
const sheet = $("#lesson-sheet");
let lessons = [];
let editing = null; // lesson being edited, or null for new
let pickedFile = null;
let pickedDuration = 0;

const GRIP = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="4" cy="3" r="1.3"/><circle cx="10" cy="3" r="1.3"/><circle cx="4" cy="7" r="1.3"/><circle cx="10" cy="7" r="1.3"/><circle cx="4" cy="11" r="1.3"/><circle cx="10" cy="11" r="1.3"/></svg>`;

async function load() {
  const [course, snap] = await Promise.all([getDoc(courseRef), getDocs(query(lessonsCol, orderBy("order", "asc")))]);
  if (!course.exists()) { location.replace("admin/courses.html"); return; }
  const c = course.data();
  $("#crumb").textContent = c.shortTitle || c.title;
  $("#page-title").textContent = `Lessons · ${c.shortTitle || c.title}`;
  $("#edit-course").href = `admin/course.html?id=${encodeURIComponent(courseId)}`;
  lessons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

function render() {
  if (!lessons.length) {
    list.innerHTML = `<li class="empty-state"><h3>No lessons yet</h3><p>Add the first video lesson for this course.</p><button class="btn btn-primary" data-add>Add lesson</button></li>`;
    return;
  }
  list.innerHTML = lessons.map((l, i) => `
    <li class="lesson-row" draggable="true" data-id="${esc(l.id)}">
      <span class="grip" aria-hidden="true">${GRIP}</span>
      <span class="n">${String(i + 1).padStart(2, "0")}</span>
      <div style="min-width:0"><strong>${esc(l.title)}</strong><small>${l.hasVideo ? `Video ready${l.durationSeconds ? ` · ${duration(l.durationSeconds)}` : ""}` : "No video yet"}</small></div>
      ${pill(l.status)}
      <div class="btns">
        <button class="icon-btn" data-up="${i}" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" data-down="${i}" aria-label="Move down" ${i === lessons.length - 1 ? "disabled" : ""}>↓</button>
        <button class="btn btn-ghost btn-sm" data-edit="${esc(l.id)}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-del="${esc(l.id)}" style="color:var(--red)">Remove</button>
      </div>
    </li>`).join("");
}

// Keeps lesson order and the course's published lesson count in sync.
async function saveOrderAndCounts() {
  const batch = writeBatch(db);
  lessons.forEach((l, i) => {
    if (l.order !== i + 1) { l.order = i + 1; batch.update(doc(lessonsCol, l.id), { order: i + 1, updatedAt: serverTimestamp() }); }
  });
  const pub = lessons.filter((l) => l.status === "published");
  batch.update(courseRef, {
    lessonCount: pub.length,
    totalDurationSeconds: pub.reduce((s, l) => s + (Number(l.durationSeconds) || 0), 0),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

async function move(from, to) {
  const [item] = lessons.splice(from, 1);
  lessons.splice(to, 0, item);
  render();
  try { await saveOrderAndCounts(); } catch (err) { console.error(err); toast("Couldn't save the new order.", "error"); }
}

/* ---------- Drag and drop ---------- */
let dragId = null;
list.addEventListener("dragstart", (e) => {
  const row = e.target.closest(".lesson-row");
  if (!row) return;
  dragId = row.dataset.id;
  row.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});
list.addEventListener("dragend", () => { $$(".lesson-row", list).forEach((r) => r.classList.remove("dragging", "over")); });
list.addEventListener("dragover", (e) => {
  const row = e.target.closest(".lesson-row");
  if (!row || !dragId) return;
  e.preventDefault();
  $$(".lesson-row", list).forEach((r) => r.classList.toggle("over", r === row));
});
list.addEventListener("drop", (e) => {
  const row = e.target.closest(".lesson-row");
  if (!row || !dragId) return;
  e.preventDefault();
  const from = lessons.findIndex((l) => l.id === dragId);
  const to = lessons.findIndex((l) => l.id === row.dataset.id);
  dragId = null;
  if (from !== to) move(from, to);
});

list.addEventListener("click", async (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.add !== undefined) return openSheet(null);
  if (t.dataset.up) return move(Number(t.dataset.up), Number(t.dataset.up) - 1);
  if (t.dataset.down) return move(Number(t.dataset.down), Number(t.dataset.down) + 1);
  if (t.dataset.edit) return openSheet(lessons.find((l) => l.id === t.dataset.edit));
  if (t.dataset.del) {
    const l = lessons.find((x) => x.id === t.dataset.del);
    const ok = await confirmDialog({ title: "Remove this lesson?", body: `<strong>${esc(l.title)}</strong> and its video will be deleted. This can't be undone.`, confirmText: "Remove lesson", danger: true });
    if (!ok) return;
    try {
      await adminDeleteLesson({ courseId, lessonId: l.id });
      lessons = lessons.filter((x) => x.id !== l.id);
      render();
      await saveOrderAndCounts();
      toast("Lesson removed", "success");
    } catch (err) { toast(apiMessage(err), "error"); }
  }
});

/* ---------- Add / edit sheet ---------- */
function openSheet(lesson) {
  editing = lesson;
  pickedFile = null;
  pickedDuration = 0;
  const form = $("#lesson-form");
  form.reset();
  showAlert($("#lesson-alert"), "");
  fieldError(form, "lessonTitle", "");
  $("#sheet-title").textContent = lesson ? "Edit lesson" : "Add lesson";
  $("#lessonTitle").value = lesson ? lesson.title : "";
  $("#lessonDesc").value = lesson ? lesson.description || "" : "";
  $("#lessonStatus").value = lesson ? lesson.status : "draft";
  $("#video-label").textContent = lesson && lesson.hasVideo ? "Replace video" : "Choose a video file";
  $("#video-current").textContent = lesson && lesson.hasVideo ? `Current video: ${lesson.videoFileName || "uploaded"}${lesson.durationSeconds ? ` (${duration(lesson.durationSeconds)})` : ""}` : "";
  $("#video-bar").classList.add("hidden");
  sheet.showModal();
  $("#lessonTitle").focus();
}

$("#add-lesson").addEventListener("click", () => openSheet(null));
$("#sheet-close").addEventListener("click", () => sheet.close());
$("#sheet-cancel").addEventListener("click", () => sheet.close());

$("#video-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!/^video\//.test(file.type)) { toast("Please choose a video file.", "error"); e.target.value = ""; return; }
  pickedFile = file;
  $("#video-label").textContent = file.name;
  $("#video-sub").textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  // Read the duration locally so the course page can show lesson lengths.
  const probe = document.createElement("video");
  probe.preload = "metadata";
  probe.onloadedmetadata = () => { pickedDuration = Math.round(probe.duration || 0); URL.revokeObjectURL(probe.src); };
  probe.src = URL.createObjectURL(file);
});

$("#lesson-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const title = $("#lessonTitle").value.trim();
  fieldError(form, "lessonTitle", title.length < 2 ? "Add a lesson title." : "");
  if (title.length < 2) return;
  const status = $("#lessonStatus").value;
  if (status === "published" && !pickedFile && !(editing && editing.hasVideo)) {
    showAlert($("#lesson-alert"), "Upload a video before publishing this lesson, or save it as a draft.");
    return;
  }
  const btn = $("#lesson-save");
  setLoading(btn, true);
  const lessonRef = editing ? doc(lessonsCol, editing.id) : doc(lessonsCol);
  try {
    const data = {
      title,
      description: $("#lessonDesc").value.trim(),
      status,
      order: editing ? editing.order : lessons.length + 1,
      hasVideo: editing ? !!editing.hasVideo : false,
      updatedAt: serverTimestamp(),
      ...(editing ? {} : { createdAt: serverTimestamp() }),
    };

    if (pickedFile) {
      const bar = $("#video-bar");
      bar.classList.remove("hidden");
      const path = `lesson-videos/${courseId}/${lessonRef.id}/${Date.now()}-${pickedFile.name.replace(/[^a-zA-Z0-9.]+/g, "-")}`;
      const task = uploadBytesResumable(ref(storage, path), pickedFile, { contentType: pickedFile.type });
      task.on("state_changed", (s) => {
        const pct = (s.bytesTransferred / s.totalBytes) * 100;
        bar.firstElementChild.style.width = `${pct}%`;
        btn.setAttribute("aria-label", `Uploading ${Math.round(pct)}%`);
      });
      await task;
      // The private reference lives in lessonAssets (admin-only). Learners never see the path.
      await setDoc(doc(db, "lessonAssets", lessonRef.id), {
        courseId, storagePath: path, fileName: pickedFile.name, size: pickedFile.size, contentType: pickedFile.type, uploadedAt: serverTimestamp(),
      });
      Object.assign(data, { hasVideo: true, videoFileName: pickedFile.name, durationSeconds: pickedDuration || (editing && editing.durationSeconds) || 0 });
    }

    await setDoc(lessonRef, data, { merge: true });
    const idx = lessons.findIndex((l) => l.id === lessonRef.id);
    const merged = { ...(idx >= 0 ? lessons[idx] : {}), id: lessonRef.id, ...data };
    if (idx >= 0) lessons[idx] = merged; else lessons.push(merged);
    await saveOrderAndCounts();
    render();
    sheet.close();
    toast(editing ? "Lesson updated" : "Lesson added", "success");
  } catch (err) {
    console.error(err);
    showAlert($("#lesson-alert"), "Saving failed. Check your connection and that you're signed in as admin.");
  } finally {
    setLoading(btn, false);
  }
});

load().catch((err) => { console.error(err); toast("Couldn't load lessons.", "error"); }).finally(pageReady);
