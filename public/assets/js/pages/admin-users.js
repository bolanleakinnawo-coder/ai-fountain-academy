import { pageReady, esc, date, dateTime, toast, setLoading, skeletonRows, $ } from "../ui.js";
import { initAdmin, pill } from "../admin-shell.js";
import { db } from "../firebase.js";
import { adminGrantAccess, adminRevokeAccess, apiMessage } from "../api.js";
import {
  collection, query, orderBy, limit, startAfter, getDocs, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await initAdmin();
pageReady();
const rows = $("#rows");
const sheet = $("#user-sheet");
const PAGE = 50;
let users = [];
let cursor = null;
let courses = [];
let entCounts = {};
let openUid = null;

rows.innerHTML = skeletonRows(6, 5);

async function loadCourses() {
  const snap = await getDocs(query(collection(db, "courses"), orderBy("sortOrder", "asc")));
  courses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadCounts() {
  const snap = await getDocs(query(collection(db, "entitlements"), where("status", "==", "active"), limit(5000)));
  entCounts = {};
  snap.docs.forEach((d) => { const u = d.data().uid; entCounts[u] = (entCounts[u] || 0) + 1; });
}

async function loadPage() {
  const q = cursor
    ? query(collection(db, "users"), orderBy("createdAt", "desc"), startAfter(cursor), limit(PAGE))
    : query(collection(db, "users"), orderBy("createdAt", "desc"), limit(PAGE));
  const snap = await getDocs(q);
  cursor = snap.docs[snap.docs.length - 1] || cursor;
  users = users.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  $("#more").classList.toggle("hidden", snap.size < PAGE);
  render();
}

function render() {
  const q = $("#search").value.trim().toLowerCase();
  const list = users.filter((u) => !q || `${u.fullName} ${u.email}`.toLowerCase().includes(q));
  rows.innerHTML = list.length
    ? list.map((u) => `<tr>
        <td><strong>${esc(u.fullName)}</strong></td>
        <td>${esc(u.email)}</td>
        <td>${date(u.createdAt)}</td>
        <td>${entCounts[u.id] || 0}</td>
        <td><div class="actions"><button class="btn btn-ghost btn-sm" data-user="${esc(u.id)}">Manage access</button></div></td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="5">${users.length ? "No users match that search." : "No users yet."}</td></tr>`;
}

async function openUser(uid) {
  openUid = uid;
  const u = users.find((x) => x.id === uid);
  const detail = $("#user-detail");
  detail.innerHTML = `<div class="sheet-head"><h2>${esc(u.fullName)}</h2><button class="icon-btn" data-close aria-label="Close">×</button></div><div class="sheet-body"><div class="skel skel-line"></div><div class="skel skel-line"></div></div>`;
  sheet.showModal();
  const ents = (await getDocs(query(collection(db, "entitlements"), where("uid", "==", uid)))).docs.map((d) => d.data());
  const owned = new Set(ents.filter((e) => e.status === "active").map((e) => e.courseId));
  const title = (id) => { const c = courses.find((x) => x.id === id); return c ? c.shortTitle || c.title : id; };
  detail.innerHTML = `
    <div class="sheet-head"><h2>${esc(u.fullName)}</h2><button class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="sheet-body">
      <p class="muted">${esc(u.email)} · joined ${date(u.createdAt)}</p>
      <h3 style="font-size:15px">Courses</h3>
      <div class="ent-list">
        ${ents.length ? ents.map((e) => `
          <div class="ent">
            <span><strong>${esc(title(e.courseId))}</strong><small>${e.source === "purchase" ? "Purchased" : e.source === "free" ? "Free" : "Granted by admin"} · ${dateTime(e.updatedAt || e.createdAt)}${e.revokeReason ? ` · ${esc(e.revokeReason)}` : ""}</small></span>
            <span style="display:flex;gap:8px;align-items:center">${pill(e.status)}${e.status === "active" ? `<button class="btn btn-ghost btn-sm" data-revoke="${esc(e.courseId)}">Revoke</button>` : ""}</span>
          </div>`).join("") : `<p class="muted">No courses yet.</p>`}
      </div>
      <h3 style="font-size:15px;margin-top:6px">Grant access</h3>
      <div class="field"><label for="grant-course">Course</label><select class="select" id="grant-course">${courses.filter((c) => !owned.has(c.id)).map((c) => `<option value="${esc(c.id)}">${esc(c.shortTitle || c.title)}</option>`).join("") || "<option value=''>Already owns every course</option>"}</select></div>
      <div class="field"><label for="grant-reason">Reason (saved in the audit log)</label><input class="input" id="grant-reason" placeholder="e.g. Paid by bank transfer, ref 1234"></div>
      <button class="btn btn-primary" id="grant">Grant access</button>
    </div>`;
  $("#grant").onclick = async (ev) => {
    const courseId = $("#grant-course").value;
    const reason = $("#grant-reason").value.trim();
    if (!courseId) return;
    if (!reason) { toast("Add a reason for the audit log.", "error"); return; }
    setLoading(ev.currentTarget, true);
    try {
      await adminGrantAccess({ uid, courseId, reason });
      toast("Access granted", "success");
      entCounts[uid] = (entCounts[uid] || 0) + 1;
      render();
      openUser(uid);
    } catch (err) { toast(apiMessage(err), "error"); setLoading(ev.currentTarget, false); }
  };
}

$("#user-detail").addEventListener("click", async (e) => {
  if (e.target.closest("[data-close]")) return sheet.close();
  const b = e.target.closest("[data-revoke]");
  if (!b) return;
  const reason = prompt("Reason for revoking access (saved in the audit log):");
  if (!reason || !reason.trim()) return;
  const uid = openUid;
  setLoading(b, true);
  try {
    await adminRevokeAccess({ uid, courseId: b.dataset.revoke, reason: reason.trim() });
    toast("Access revoked", "success");
    entCounts[uid] = Math.max(0, (entCounts[uid] || 1) - 1);
    render();
    openUser(uid);
  } catch (err) { toast(apiMessage(err), "error"); setLoading(b, false); }
});

rows.addEventListener("click", (e) => { const b = e.target.closest("[data-user]"); if (b) openUser(b.dataset.user); });
$("#search").addEventListener("input", render);
$("#more").addEventListener("click", async (e) => { setLoading(e.currentTarget, true); await loadPage(); setLoading(e.currentTarget, false); });

Promise.all([loadCourses(), loadCounts()]).then(loadPage).catch((err) => {
  console.error(err);
  rows.innerHTML = `<tr class="empty-row"><td colspan="5">Couldn't load users.</td></tr>`;
});
