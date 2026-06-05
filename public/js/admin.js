/* =========================================================================
   Admin logic — create / edit / delete daily Live Photos.
   Includes calendar thumbnail crop (pan + zoom) editor.
   ========================================================================= */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const form = $("photo-form");
  const dateInput = $("f-date");
  const descInput = $("f-desc");
  const imageInput = $("f-image");
  const videoInput = $("f-video");
  const removeVideoRow = $("remove-video-row");
  const removeVideoChk = $("f-remove-video");
  const statusEl = $("status");
  const submitBtn = $("submit-btn");
  const resetBtn = $("reset-btn");
  const formTitle = $("form-title");
  const grid = $("entry-grid");
  const emptyEntries = $("empty-entries");
  const cropField = $("crop-field");
  const cropViewport = $("crop-viewport");
  const cropImg = $("crop-img");
  const cropZoom = $("crop-zoom");

  let editingId = null;
  let editingPhoto = null;
  let aspectRatio = null;
  let thumbCrop = { ...ThumbCrop.DEFAULT };
  let cropDrag = null;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmtLong(str) {
    const [y, m, d] = str.split("-").map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  }

  // Default the date field to today.
  (function setToday() {
    const d = new Date();
    dateInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  function applyCropPreview() {
    ThumbCrop.applyThumbCrop(cropImg, thumbCrop);
    cropZoom.value = String(thumbCrop.zoom);
  }

  function showCropEditor(src, crop, ar) {
    thumbCrop = ThumbCrop.normalize(crop);
    cropImg.src = src;
    cropField.hidden = false;
    cropZoom.value = String(thumbCrop.zoom);
    cropImg.onload = () => {
      if (ar && ar > 0) {
        aspectRatio = ar;
      } else if (cropImg.naturalWidth && cropImg.naturalHeight) {
        aspectRatio = cropImg.naturalWidth / cropImg.naturalHeight;
      }
      applyCropPreview();
    };
    if (cropImg.complete) cropImg.onload();
  }

  function hideCropEditor() {
    cropField.hidden = true;
    cropImg.removeAttribute("src");
    thumbCrop = { ...ThumbCrop.DEFAULT };
    aspectRatio = null;
    cropZoom.value = "1";
  }

  // ---- Dropzone wiring --------------------------------------------------
  function wireDropzone(dzId, input, nameId, previewId) {
    const dz = $(dzId);
    dz.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      const nameEl = $(nameId);
      if (file) {
        dz.classList.add("has-file");
        nameEl.textContent = file.name;
        if (previewId) {
          const pv = $(previewId);
          pv.hidden = false;
          pv.src = URL.createObjectURL(file);
          showCropEditor(pv.src, ThumbCrop.DEFAULT, null);
        }
      } else {
        dz.classList.remove("has-file");
        nameEl.textContent = "";
        if (previewId) {
          $(previewId).hidden = true;
          if (!editingId) hideCropEditor();
        }
      }
    });
  }
  wireDropzone("dz-image", imageInput, "image-name", "image-preview");
  wireDropzone("dz-video", videoInput, "video-name", null);

  // ---- Crop drag + zoom -------------------------------------------------
  cropZoom.addEventListener("input", () => {
    thumbCrop.zoom = Number(cropZoom.value) || 1;
    applyCropPreview();
  });

  cropViewport.addEventListener("pointerdown", (e) => {
    if (!cropImg.src) return;
    cropDrag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      cropX: thumbCrop.x,
      cropY: thumbCrop.y,
    };
    cropViewport.setPointerCapture(e.pointerId);
    cropViewport.classList.add("is-dragging");
    e.preventDefault();
  });

  cropViewport.addEventListener("pointermove", (e) => {
    if (!cropDrag || cropDrag.id !== e.pointerId) return;
    const rect = cropViewport.getBoundingClientRect();
    const dx = e.clientX - cropDrag.x;
    const dy = e.clientY - cropDrag.y;
    const sens = 100 / Math.max(rect.width, 1);
    thumbCrop.x = clamp(cropDrag.cropX - dx * sens, 0, 100);
    thumbCrop.y = clamp(cropDrag.cropY - dy * sens, 0, 100);
    applyCropPreview();
  });

  function endCropDrag(e) {
    if (!cropDrag || cropDrag.id !== e.pointerId) return;
    try { cropViewport.releasePointerCapture(e.pointerId); } catch (err) {}
    cropViewport.classList.remove("is-dragging");
    cropDrag = null;
  }
  cropViewport.addEventListener("pointerup", endCropDrag);
  cropViewport.addEventListener("pointercancel", endCropDrag);

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  // ---- Submit (create or edit) -----------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!dateInput.value) return setStatus("Please pick a date.", "err");
    if (!editingId && !imageInput.files[0]) return setStatus("Please choose a photo.", "err");

    const fd = new FormData();
    fd.append("date", dateInput.value);
    fd.append("description", descInput.value);
    if (imageInput.files[0]) fd.append("image", imageInput.files[0]);
    if (videoInput.files[0]) fd.append("video", videoInput.files[0]);
    if (editingId && removeVideoChk.checked && !videoInput.files[0]) {
      fd.append("removeVideo", "true");
    }
    fd.append("thumbCrop", JSON.stringify(thumbCrop));
    if (aspectRatio) fd.append("aspectRatio", String(aspectRatio));

    submitBtn.disabled = true;
    setStatus(editingId ? "Saving…" : "Uploading… (transcoding video if any)", "");

    try {
      const url = editingId ? `/api/photos/${editingId}` : "/api/photos";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus(editingId ? "Saved! ✓" : "Added to the basket! 🍎", "ok");
      resetForm();
      await loadEntries();
    } catch (err) {
      setStatus(err.message, "err");
    } finally {
      submitBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", resetForm);

  function resetForm() {
    editingId = null;
    editingPhoto = null;
    form.reset();
    (function setToday() {
      const d = new Date();
      dateInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    $("image-name").textContent = "";
    $("video-name").textContent = "";
    $("image-preview").hidden = true;
    $("dz-image").classList.remove("has-file");
    $("dz-video").classList.remove("has-file");
    removeVideoRow.hidden = true;
    removeVideoChk.checked = false;
    formTitle.textContent = "🍎 New apple of the day";
    submitBtn.textContent = "Save apple";
    resetBtn.hidden = true;
    hideCropEditor();
  }

  function startEdit(photo) {
    editingId = photo.id;
    editingPhoto = photo;
    dateInput.value = photo.date;
    descInput.value = photo.description || "";
    formTitle.textContent = "✏️ Editing " + fmtLong(photo.date);
    submitBtn.textContent = "Update apple";
    resetBtn.hidden = false;
    $("image-name").textContent = "(keep current unless you choose a new one)";
    $("video-name").textContent = photo.videoUrl ? "(has a live video)" : "";
    removeVideoRow.hidden = !photo.videoUrl;
    removeVideoChk.checked = false;
    aspectRatio = photo.aspectRatio || null;
    showCropEditor(photo.imageUrl, photo.thumbCrop, photo.aspectRatio);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(photo) {
    if (!confirm(`Delete the apple from ${fmtLong(photo.date)}?`)) return;
    try {
      const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      if (editingId === photo.id) resetForm();
      await loadEntries();
    } catch (err) {
      setStatus(err.message, "err");
    }
  }

  // ---- Entries list -----------------------------------------------------
  async function loadEntries() {
    let photos = [];
    try {
      const res = await fetch("/api/photos");
      photos = await res.json();
    } catch (e) {
      setStatus("Couldn't load entries.", "err");
      return;
    }
    grid.innerHTML = "";
    emptyEntries.hidden = photos.length > 0;

    for (const p of photos) {
      const card = document.createElement("div");
      card.className = "entry";
      card.innerHTML = `
        <div class="thumb">
          <img src="${p.imageUrl}" alt="" loading="lazy" />
          ${p.videoUrl ? '<span class="live-tag">LIVE</span>' : ""}
        </div>
        <div class="meta">
          <div class="e-date">${fmtLong(p.date)}</div>
          <div class="e-desc"></div>
        </div>
        <div class="e-actions">
          <button class="edit">Edit</button>
          <button class="del">Delete</button>
        </div>`;
      const thumbImg = card.querySelector(".thumb img");
      ThumbCrop.applyThumbCrop(thumbImg, p.thumbCrop);
      card.querySelector(".e-desc").textContent = p.description || "";
      card.querySelector(".edit").onclick = () => startEdit(p);
      card.querySelector(".del").onclick = () => del(p);
      grid.appendChild(card);
    }
  }

  loadEntries();
})();
