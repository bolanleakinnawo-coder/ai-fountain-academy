import { pageReady, esc, money, dateTime, skeletonRows, $ } from "../ui.js";
import { initAdmin, pill } from "../admin-shell.js";
import { db } from "../firebase.js";
import {
  collection, collectionGroup, query, where, orderBy, limit, getDocs, getCountFromServer, getAggregateFromServer, sum,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await initAdmin();
pageReady();
$("#stats").innerHTML = Array.from({ length: 5 }, () => `<div class="stat"><div class="skel skel-line" style="width:60%"></div><div class="skel skel-title" style="height:30px"></div></div>`).join("");
$("#recent-payments").innerHTML = skeletonRows(4, 5);

const count = async (q) => (await getCountFromServer(q)).data().count;

async function loadStats() {
  const paid = query(collection(db, "payments"), where("status", "==", "success"));
  const [users, courses, published, lessons, purchases, revenue] = await Promise.all([
    count(collection(db, "users")),
    count(collection(db, "courses")),
    count(query(collection(db, "courses"), where("status", "==", "published"))),
    count(collectionGroup(db, "lessons")),
    count(paid),
    getAggregateFromServer(paid, { total: sum("amountKobo") }).then((s) => s.data().total || 0),
  ]);
  const tile = (label, value) => `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`;
  $("#stats").innerHTML = [
    tile("Registered users", users.toLocaleString()),
    tile("Courses", `${courses} <small style="display:inline;font-size:13px;letter-spacing:0">(${published} live)</small>`),
    tile("Lessons", lessons.toLocaleString()),
    tile("Successful purchases", purchases.toLocaleString()),
    tile("Revenue", money(revenue)),
  ].join("");
}

async function loadPayments() {
  const snap = await getDocs(query(collection(db, "payments"), orderBy("createdAt", "desc"), limit(8)));
  $("#recent-payments").innerHTML = snap.empty
    ? `<tr class="empty-row"><td colspan="5">No payments yet.</td></tr>`
    : snap.docs.map((d) => {
        const p = d.data();
        return `<tr><td>${esc(p.email || p.uid)}</td><td>${esc(p.courseTitle || p.courseId)}</td><td>${money(p.amountKobo, p.currency)}</td><td>${pill(p.status)}</td><td>${dateTime(p.createdAt)}</td></tr>`;
      }).join("");
}

const ACTIONS = { purchase: "Course purchased", grant: "Access granted", revoke: "Access revoked", "delete-course": "Course deleted", "delete-lesson": "Lesson deleted" };

async function loadActivity() {
  const snap = await getDocs(query(collection(db, "auditLog"), orderBy("at", "desc"), limit(10)));
  $("#activity").innerHTML = snap.empty
    ? `<li style="grid-template-columns:1fr" class="muted">Nothing yet. Purchases and access changes will appear here.</li>`
    : snap.docs.map((d) => {
        const a = d.data();
        const t = a.target || {};
        const detail = [t.courseId, a.reason, a.title].filter(Boolean).join(" · ");
        return `<li><span>${esc(ACTIONS[a.action] || a.action)}<small>${esc(detail)} · ${dateTime(a.at)}</small></span></li>`;
      }).join("");
}

const fail = (sel, cols) => (err) => {
  console.error(err);
  const el = $(sel);
  el.innerHTML = cols ? `<tr class="empty-row"><td colspan="${cols}">Couldn't load. Refresh to try again.</td></tr>` : `<p class="muted">Couldn't load. Refresh to try again.</p>`;
};
loadStats().catch(fail("#stats"));
loadPayments().catch(fail("#recent-payments", 5));
loadActivity().catch(fail("#activity"));
