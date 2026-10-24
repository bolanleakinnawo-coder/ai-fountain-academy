// Paystack sends the buyer back here. The redirect itself proves nothing:
// we ask our server to verify the reference with Paystack before showing success.
import { initPublicPage, setNavSignedIn, pageReady, esc, $ } from "../ui.js";
import { requireUser } from "../auth.js";
import { verifyPayment, apiMessage } from "../api.js";
import { listPublishedCourses } from "../data.js";
import { learnUrl, courseUrl } from "../components.js";

initPublicPage();
const box = $("#status");
const params = new URLSearchParams(location.search);
const reference = params.get("reference") || params.get("trxref") || sessionStorage.getItem("afa_pending_ref");

const ICONS = {
  wait: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>`,
  ok: `<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bad: `<svg viewBox="0 0 24 24" fill="none"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  pend: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
};

function show(kind, title, body, actions = "") {
  box.innerHTML = `<span class="status-icon ${kind}">${ICONS[kind]}</span><h1 class="h2">${title}</h1><p>${body}</p><div class="actions">${actions}</div>`;
}

function confetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const wrap = document.createElement("div");
  wrap.className = "confetti";
  const colors = ["#1f5bff", "#9fb9ff", "#0a0f1f", "#12a150", "#dde6ff"];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement("i");
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 5500);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const user = await requireUser();
  setNavSignedIn(user);
  pageReady();
  if (!reference) {
    show("bad", "No payment to confirm", "We couldn't find a payment reference. If you were charged, contact us with your Paystack receipt.", `<a class="btn btn-primary" href="dashboard.html">Go to dashboard</a><a class="btn btn-ghost" href="contact.html">Contact support</a>`);
    return;
  }
  show("wait", "Confirming your payment…", "We're checking with Paystack. This usually takes a few seconds, so please keep this page open.");

  const courses = await listPublishedCourses().catch(() => []);
  const delays = [0, 2000, 3000, 4000, 6000, 8000, 10000];
  let last = null;
  for (const d of delays) {
    await sleep(d);
    try {
      last = await verifyPayment({ reference });
    } catch (err) {
      show("bad", "We couldn't check this payment", esc(apiMessage(err)), `<a class="btn btn-primary" href="dashboard.html">Go to dashboard</a><a class="btn btn-ghost" href="contact.html">Contact support</a>`);
      return;
    }
    if (last.status !== "pending") break;
  }
  const course = courses.find((c) => c.id === (last && last.courseId));

  switch (last && last.status) {
    case "success":
      sessionStorage.removeItem("afa_pending_ref");
      show("ok", "Payment confirmed. You're in!", `${course ? `<strong>${esc(course.title)}</strong> is now on your dashboard.` : "Your course is now on your dashboard."}`,
        `${course ? `<a class="btn btn-primary btn-lg" href="${learnUrl(course)}">Start learning</a>` : ""}<a class="btn btn-ghost btn-lg" href="dashboard.html">Go to dashboard</a>`);
      confetti();
      break;
    case "abandoned":
      show("bad", "Payment not completed", "The payment was cancelled before it finished. You haven't been charged for this attempt.",
        `${course ? `<a class="btn btn-primary" href="${courseUrl(course)}">Try again</a>` : ""}<a class="btn btn-ghost" href="dashboard.html">Go to dashboard</a>`);
      break;
    case "failed":
    case "reversed":
      show("bad", "Payment unsuccessful", `${esc(last.reason || "The payment didn't go through.")} If you were charged, contact us with this reference: <span class="mono">${esc(reference)}</span>`,
        `${course ? `<a class="btn btn-primary" href="${courseUrl(course)}">Try again</a>` : ""}<a class="btn btn-ghost" href="contact.html">Contact support</a>`);
      break;
    default:
      show("pend", "Payment still processing", `Paystack hasn't confirmed this payment yet. Your course will unlock automatically once it does. Reference: <span class="mono">${esc(reference)}</span>`,
        `<button class="btn btn-primary" onclick="location.reload()">Check again</button><a class="btn btn-ghost" href="dashboard.html">Go to dashboard</a>`);
  }
}

run();
