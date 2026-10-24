import { pageReady, esc, money, dateTime, skeletonRows, setLoading, $ } from "../ui.js";
import { initAdmin, pill } from "../admin-shell.js";
import { db } from "../firebase.js";
import { collection, query, orderBy, limit, startAfter, getDocs, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await initAdmin();
pageReady();
const rows = $("#rows");
const PAGE = 50;
let cursor = null;

async function load(reset) {
  if (reset) { cursor = null; rows.innerHTML = skeletonRows(6, 6); }
  const status = $("#status-filter").value;
  const parts = [collection(db, "payments")];
  if (status) parts.push(where("status", "==", status));
  parts.push(orderBy("createdAt", "desc"));
  if (cursor) parts.push(startAfter(cursor));
  parts.push(limit(PAGE));
  const snap = await getDocs(query(...parts));
  cursor = snap.docs[snap.docs.length - 1] || cursor;
  const html = snap.docs.map((d) => {
    const p = d.data();
    return `<tr>
      <td>${esc(p.email || p.uid)}</td>
      <td>${esc(p.courseTitle || p.courseId)}</td>
      <td>${money(p.amountKobo, p.currency)}</td>
      <td>${pill(p.status)}${p.failureReason ? `<div class="mono" style="margin-top:4px">${esc(p.failureReason)}</div>` : ""}</td>
      <td class="mono">${esc(p.reference)}</td>
      <td>${dateTime(p.createdAt)}</td>
    </tr>`;
  }).join("");
  if (reset) rows.innerHTML = html || `<tr class="empty-row"><td colspan="6">No payments${status ? " with this status" : " yet"}.</td></tr>`;
  else rows.insertAdjacentHTML("beforeend", html);
  $("#more").classList.toggle("hidden", snap.size < PAGE);
}

$("#status-filter").addEventListener("change", () => load(true).catch(fail));
$("#more").addEventListener("click", async (e) => { setLoading(e.currentTarget, true); await load(false).catch(fail); setLoading(e.currentTarget, false); });
function fail(err) { console.error(err); rows.innerHTML = `<tr class="empty-row"><td colspan="6">Couldn't load payments.</td></tr>`; }
load(true).catch(fail);
