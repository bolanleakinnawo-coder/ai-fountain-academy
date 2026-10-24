import { initPublicPage, setNavSignedIn, pageReady, observeReveals, skeletonCards, esc, $, $$ } from "../ui.js";
import { currentUser } from "../auth.js";
import { listPublishedCourses, getMyEntitlements } from "../data.js";
import { courseCard, featuredCard } from "../components.js";

initPublicPage({ active: "courses" });

const grid = $("#course-grid");
const featuredSlot = $("#featured-slot");
const noResults = $("#no-results");
const search = $("#search");
const chips = $("#cat-chips");
grid.innerHTML = skeletonCards(6);

let courses = [];
let owned = {};
let category = "All";

function render() {
  const q = search.value.trim().toLowerCase();
  const match = (c) =>
    (category === "All" || c.category === category) &&
    (!q || `${c.title} ${c.shortDescription} ${c.category} ${(c.tags || []).join(" ")}`.toLowerCase().includes(q));
  const list = courses.filter(match);
  const filtering = q || category !== "All";
  const featured = !filtering ? courses.find((c) => c.featured) : null;
  const isOwned = (c) => owned[c.id] && owned[c.id].status === "active";
  featuredSlot.innerHTML = featured ? featuredCard(featured, { owned: isOwned(featured) }) : "";
  grid.innerHTML = list.filter((c) => c !== featured).map((c, i) => courseCard(c, { owned: isOwned(c) }, i)).join("");
  noResults.classList.toggle("hidden", list.length > 0);
  observeReveals(document);
}

async function load() {
  try {
    const [list, user] = await Promise.all([listPublishedCourses(), currentUser()]);
    courses = list;
    if (user) { setNavSignedIn(user); owned = await getMyEntitlements(user.uid).catch(() => ({})); }
    const cats = ["All", ...new Set(courses.map((c) => c.category).filter(Boolean))];
    chips.innerHTML = cats.map((c) => `<button class="cat-chip" role="tab" aria-selected="${c === "All"}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
    render();
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Courses couldn't load</h3><p>Check your connection and try again.</p><button class="btn btn-ghost" onclick="location.reload()">Try again</button></div>`;
  }
}

chips.addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  category = b.dataset.cat;
  $$(".cat-chip", chips).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  render();
});
search.addEventListener("input", render);
$("#clear").addEventListener("click", () => { search.value = ""; category = "All"; $$(".cat-chip", chips).forEach((x, i) => x.setAttribute("aria-selected", String(i === 0))); render(); });

load().finally(pageReady);
