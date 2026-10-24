import { pageReady, esc, toast, setLoading, confirmDialog, $ } from "../ui.js";
import { initAdmin, slugify, linesToList } from "../admin-shell.js";
import { db, storage } from "../firebase.js";
import { fieldError, clearErrors } from "../forms.js";
import { adminDeleteCourse, apiMessage } from "../api.js";
import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

await initAdmin();
const params = new URLSearchParams(location.search);
const editingId = params.get("id");
const courseRef = editingId ? doc(db, "courses", editingId) : doc(collection(db, "courses"));
const form = $("#course-form");
const f = (id) => $(`#${id}`);
let existing = null;
let thumbnailUrl = "";
let slugTouched = !!editingId;
let dirty = false;

function fill(c) {
  f("title").value = c.title || "";
  f("shortTitle").value = c.shortTitle || "";
  f("slug").value = c.slug || "";
  f("shortDescription").value = c.shortDescription || "";
  f("summary30s").value = c.summary30s || "";
  f("overview").value = c.overview || "";
  f("objectives").value = (c.objectives || []).join("\n");
  f("contents").value = (c.contents || []).join("\n");
  f("status").value = c.status || "draft";
  f("featured").checked = !!c.featured;
  f("sortOrder").value = c.sortOrder ?? 10;
  f("price").value = c.priceKobo != null ? c.priceKobo / 100 : "";
  f("category").value = c.category || "";
  f("tags").value = (c.tags || []).join(", ");
  f("difficulty").value = c.difficulty || "Beginner";
  f("language").value = c.language || "English";
  setThumb(c.thumbnailUrl || "");
  $("#slug-preview").textContent = c.slug || "…";
}

function setThumb(url) {
  thumbnailUrl = url;
  f("thumb-preview").src = url || "";
  f("thumb-preview").classList.toggle("hidden", !url);
  f("thumb-empty").classList.toggle("hidden", !!url);
}

async function load() {
  // Category suggestions from existing courses.
  const all = await getDocs(collection(db, "courses"));
  const cats = [...new Set(all.docs.map((d) => d.data().category).filter(Boolean))];
  f("cat-list").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");

  if (editingId) {
    const snap = await getDoc(courseRef);
    if (!snap.exists()) { toast("Course not found", "error"); location.replace("admin/courses.html"); return; }
    existing = snap.data();
    fill(existing);
    $("#crumb").textContent = existing.shortTitle || existing.title;
    $("#page-title").textContent = "Edit course";
    $("#head-actions").innerHTML = `
      <a class="btn btn-ghost" href="course.html?slug=${encodeURIComponent(existing.slug)}" target="_blank" rel="noopener">View page</a>
      <a class="btn btn-soft" href="admin/lessons.html?course=${encodeURIComponent(editingId)}">Manage lessons</a>
      <button class="btn btn-ghost" id="delete" style="color:var(--red)">Delete</button>`;
    $("#delete").addEventListener("click", del);
  } else {
    f("sortOrder").value = all.size + 1;
  }
  pageReady();
}

f("title").addEventListener("input", () => {
  if (!slugTouched) { f("slug").value = slugify(f("title").value); $("#slug-preview").textContent = f("slug").value || "…"; }
});
f("slug").addEventListener("input", () => { slugTouched = true; f("slug").value = slugify(f("slug").value); $("#slug-preview").textContent = f("slug").value || "…"; });
form.addEventListener("input", () => { dirty = true; $("#save-state").textContent = "Unsaved changes"; });
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

f("thumb-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) return toast("Please choose an image file.", "error");
  if (file.size > 5 * 1024 * 1024) return toast("Image must be under 5 MB.", "error");
  const bar = f("thumb-bar");
  bar.classList.remove("hidden");
  const path = `thumbnails/${courseRef.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, "-")}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type, cacheControl: "public,max-age=31536000" });
  task.on("state_changed", (s) => { bar.firstElementChild.style.width = `${(s.bytesTransferred / s.totalBytes) * 100}%`; });
  try {
    await task;
    setThumb(await getDownloadURL(task.snapshot.ref));
    dirty = true;
    $("#save-state").textContent = "Thumbnail uploaded. Save to apply.";
  } catch (err) {
    console.error(err);
    toast("Upload failed. Check you're signed in as admin.", "error");
  } finally {
    setTimeout(() => bar.classList.add("hidden"), 600);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors(form);
  const title = f("title").value.trim();
  const slug = slugify(f("slug").value || title);
  const price = Number(f("price").value);
  let ok = true;
  if (title.length < 3) { fieldError(form, "title", "Add a course title."); ok = false; }
  if (!slug) { fieldError(form, "slug", "Add a URL slug."); ok = false; }
  if (!(price >= 0) || f("price").value === "") { fieldError(form, "price", "Set a price (0 for free)."); ok = false; }
  if (!ok) { form.querySelector(".has-error input")?.focus(); return; }

  const btn = $("#save");
  setLoading(btn, true);
  try {
    const dupe = await getDocs(query(collection(db, "courses"), where("slug", "==", slug)));
    if (dupe.docs.some((d) => d.id !== courseRef.id)) {
      fieldError(form, "slug", "Another course already uses this slug.");
      setLoading(btn, false);
      return;
    }
    const data = {
      title,
      shortTitle: f("shortTitle").value.trim(),
      slug,
      shortDescription: f("shortDescription").value.trim(),
      summary30s: f("summary30s").value.trim(),
      overview: f("overview").value.trim(),
      objectives: linesToList(f("objectives").value),
      contents: linesToList(f("contents").value),
      status: f("status").value,
      featured: f("featured").checked,
      sortOrder: Math.round(Number(f("sortOrder").value) || 0),
      priceKobo: Math.round(price * 100),
      currency: "NGN",
      category: f("category").value.trim(),
      tags: f("tags").value.split(",").map((t) => t.trim()).filter(Boolean),
      difficulty: f("difficulty").value,
      language: f("language").value.trim() || "English",
      thumbnailUrl,
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    if (!existing) Object.assign(data, { createdAt: serverTimestamp(), lessonCount: 0, totalDurationSeconds: 0 });
    batch.set(courseRef, data, { merge: true });
    // Only one hot course at a time.
    if (data.featured) {
      const others = await getDocs(query(collection(db, "courses"), where("featured", "==", true)));
      others.docs.filter((d) => d.id !== courseRef.id).forEach((d) => batch.update(d.ref, { featured: false, updatedAt: serverTimestamp() }));
    }
    await batch.commit();
    dirty = false;
    btn.classList.add("is-success");
    toast("Course saved", "success");
    if (!existing) setTimeout(() => location.replace(`admin/lessons.html?course=${courseRef.id}`), 500);
    else { existing = { ...existing, ...data }; $("#save-state").textContent = "All changes saved"; setTimeout(() => btn.classList.remove("is-success"), 1200); }
  } catch (err) {
    console.error(err);
    toast("Couldn't save. Check the fields and try again.", "error");
  } finally {
    setLoading(btn, false);
  }
});

async function del() {
  const title = existing.shortTitle || existing.title;
  const ok = await confirmDialog({
    title: "Delete this course?",
    body: `This permanently deletes <strong>${esc(title)}</strong>, its lessons and stored videos. Purchase records are kept. Learners who bought it will lose access.`,
    confirmText: "Delete course",
    danger: true,
    requireText: "DELETE",
  });
  if (!ok) return;
  try {
    await adminDeleteCourse({ courseId: editingId });
    dirty = false;
    toast("Course deleted", "success");
    location.replace("admin/courses.html");
  } catch (err) {
    toast(apiMessage(err), "error");
  }
}

load().catch((err) => { console.error(err); toast("Couldn't load the course.", "error"); pageReady(); });
