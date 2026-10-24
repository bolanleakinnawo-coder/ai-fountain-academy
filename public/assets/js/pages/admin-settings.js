import { pageReady, toast, $ } from "../ui.js";
import { initAdmin } from "../admin-shell.js";
import { db, storage } from "../firebase.js";
import { doc, getDoc, setDoc, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

await initAdmin();
const settingsRef = doc(db, "settings", "site");
const preview = $("#preview");

function show(url) {
  preview.classList.toggle("hidden", !url);
  $("#remove").classList.toggle("hidden", !url);
  if (url) preview.src = url; else preview.removeAttribute("src");
}

getDoc(settingsRef).then((s) => show(s.exists() ? s.data().previewVideoUrl : "")).finally(pageReady);

$("#file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!/^video\//.test(file.type)) return toast("Please choose a video file.", "error");
  const bar = $("#bar");
  bar.classList.remove("hidden");
  const task = uploadBytesResumable(ref(storage, `public/preview-${Date.now()}.${file.name.split(".").pop()}`), file, { contentType: file.type, cacheControl: "public,max-age=86400" });
  task.on("state_changed", (s) => { bar.firstElementChild.style.width = `${(s.bytesTransferred / s.totalBytes) * 100}%`; });
  try {
    await task;
    const url = await getDownloadURL(task.snapshot.ref);
    await setDoc(settingsRef, { previewVideoUrl: url, updatedAt: serverTimestamp() }, { merge: true });
    show(url);
    toast("Preview video updated", "success");
  } catch (err) {
    console.error(err);
    toast("Upload failed.", "error");
  } finally {
    setTimeout(() => bar.classList.add("hidden"), 600);
  }
});

$("#remove").addEventListener("click", async () => {
  await setDoc(settingsRef, { previewVideoUrl: deleteField(), updatedAt: serverTimestamp() }, { merge: true });
  show("");
  toast("Using the built-in preview clip", "success");
});
