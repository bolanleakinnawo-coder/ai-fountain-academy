import { pageReady, esc, money, toast, skeletonRows, $ } from "../ui.js";
import { initAdmin, pill } from "../admin-shell.js";
import { db } from "../firebase.js";
import { collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await initAdmin();
pageReady();
const rows = $("#rows");
rows.innerHTML = skeletonRows(4, 6);

async function load() {
  const snap = await getDocs(query(collection(db, "courses"), orderBy("sortOrder", "asc")));
  rows.innerHTML = snap.empty
    ? `<tr class="empty-row"><td colspan="6">No courses yet. <a class="text-blue" href="admin/course.html">Create your first course</a>.</td></tr>`
    : snap.docs.map((d) => {
        const c = d.data();
        return `<tr>
          <td><div class="course-cell"><img src="${esc(c.thumbnailUrl || "assets/img/thumb-fallback.svg")}" alt=""><div><strong>${esc(c.shortTitle || c.title)}</strong><small>/courses/${esc(c.slug)}${c.featured ? " · Hot course" : ""}</small></div></div></td>
          <td>${money(c.priceKobo, c.currency)}</td>
          <td>${c.lessonCount || 0}</td>
          <td>${pill(c.status)}</td>
          <td>${c.sortOrder ?? ""}</td>
          <td><div class="actions">
            <a class="btn btn-soft btn-sm" href="admin/lessons.html?course=${encodeURIComponent(d.id)}">Lessons</a>
            <a class="btn btn-ghost btn-sm" href="admin/course.html?id=${encodeURIComponent(d.id)}">Edit</a>
            <button class="btn btn-ghost btn-sm" data-toggle="${esc(d.id)}" data-status="${esc(c.status)}">${c.status === "published" ? "Unpublish" : "Publish"}</button>
          </div></td>
        </tr>`;
      }).join("");
}

rows.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-toggle]");
  if (!b) return;
  const next = b.dataset.status === "published" ? "draft" : "published";
  b.classList.add("is-loading");
  try {
    await updateDoc(doc(db, "courses", b.dataset.toggle), { status: next, updatedAt: serverTimestamp() });
    toast(next === "published" ? "Course published" : "Course moved to drafts", "success");
    await load();
  } catch (err) {
    console.error(err);
    toast("Couldn't update the course.", "error");
    b.classList.remove("is-loading");
  }
});

load().catch((err) => { console.error(err); rows.innerHTML = `<tr class="empty-row"><td colspan="6">Couldn't load courses.</td></tr>`; });
