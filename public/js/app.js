/* =========================================================================
   An Apple A Day — viewer logic (Calendar + Gallery modes, Live Photos)
   Works standalone or embedded (configurable API base + default mode).
   ========================================================================= */
(function () {
  "use strict";

  // ---- Config (overridable for embedding) -------------------------------
  const params = new URLSearchParams(location.search);
  const cfg = Object.assign(
    { api: "", mode: "calendar" },
    window.APPLE_A_DAY_CONFIG || {}
  );
  if (params.get("api")) cfg.api = params.get("api");
  if (params.get("mode")) cfg.mode = params.get("mode");
  const API = (cfg.api || "").replace(/\/$/, "");

  // ---- State ------------------------------------------------------------
  let photos = [];
  let byDate = new Map();
  let mode = cfg.mode === "gallery" ? "gallery" : "calendar";
  let calCursor = new Date();

  // ---- DOM --------------------------------------------------------------
  const stage = document.getElementById("stage");
  const btnCal = document.getElementById("btn-calendar");
  const btnGal = document.getElementById("btn-gallery");
  const lightbox = document.getElementById("lightbox");
  const lbMedia = document.getElementById("lightbox-media");
  const lbDesc = document.getElementById("lightbox-desc");
  const lbDate = document.getElementById("lightbox-date");
  const lbClose = document.getElementById("lightbox-close");

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // ---- Helpers ----------------------------------------------------------
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function parseDate(str) {
    // "YYYY-MM-DD" -> local Date (avoid TZ shift)
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function fmtLong(str) {
    const d = parseDate(str);
    return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Build a hover-playable Live Photo thumbnail (img + optional video overlay).
  function mediaThumb(photo) {
    const wrap = el("div", "lp-media");
    wrap.style.position = "relative";
    wrap.style.width = "100%";
    wrap.style.height = "100%";

    const img = el("img");
    img.src = API + photo.imageUrl;
    img.alt = photo.description || "apple of the day";
    img.loading = "lazy";
    wrap.appendChild(img);

    if (photo.videoUrl) {
      const vid = el("video");
      vid.src = API + photo.videoUrl;
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.preload = "metadata";
      vid.setAttribute("playsinline", "");
      Object.assign(vid.style, {
        position: "absolute",
        inset: "0",
        opacity: "0",
        transition: "opacity 0.25s ease",
        pointerEvents: "none",
      });
      vid.dataset.lpVideo = "1";
      wrap.appendChild(vid);
    }
    return wrap;
  }

  function bindHoverPlay(interactiveEl) {
    const vid = interactiveEl.querySelector("[data-lp-video]");
    if (!vid) return;
    interactiveEl.addEventListener("mouseenter", () => {
      vid.style.opacity = "1";
      const p = vid.play();
      if (p && p.catch) p.catch(() => {});
    });
    interactiveEl.addEventListener("mouseleave", () => {
      vid.style.opacity = "0";
      vid.pause();
      try { vid.currentTime = 0; } catch (e) {}
    });
  }

  // ---- Data -------------------------------------------------------------
  async function loadPhotos() {
    try {
      const res = await fetch(API + "/api/photos");
      if (!res.ok) throw new Error("Request failed");
      photos = await res.json();
    } catch (e) {
      photos = [];
      stage.innerHTML =
        '<p class="empty-note hand">Couldn\'t reach the apple basket 🍎<br>Is the server running?</p>';
      return false;
    }
    byDate = new Map();
    for (const p of photos) {
      if (!byDate.has(p.date)) byDate.set(p.date, p);
    }
    if (photos.length) {
      // Start the calendar on the month of the most recent photo.
      calCursor = parseDate(photos[0].date);
    }
    return true;
  }

  // ============================ CALENDAR =================================
  function renderCalendar() {
    stage.innerHTML = "";
    const wrap = el("div", "calendar");

    const head = el("div", "cal-head");
    const prev = el("button", "btn cal-nav", "‹");
    const title = el("h2", "hand");
    const next = el("button", "btn cal-nav", "›");
    title.textContent = `${MONTHS[calCursor.getMonth()]} ${calCursor.getFullYear()}`;
    prev.onclick = () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); };
    next.onclick = () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); };
    head.append(prev, title, next);
    wrap.appendChild(head);

    const grid = el("div", "cal-grid");
    for (const d of DOW) grid.appendChild(el("div", "cal-dow", d));

    const year = calCursor.getFullYear();
    const month = calCursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const tKey = todayKey();

    for (let i = 0; i < firstDow; i++) grid.appendChild(el("div", "cal-cell empty-day"));

    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const cell = el("div", "cal-cell");
      if (key === tKey) cell.classList.add("is-today");
      cell.appendChild(el("div", "cal-daynum", String(day)));

      const photo = byDate.get(key);
      if (photo) {
        const hang = el("div", "hang");
        hang.appendChild(el("div", "string"));
        const frame = el("div", "apple-frame");
        frame.appendChild(el("div", "leaf"));
        const clip = el("div", "photo-clip");
        clip.appendChild(mediaThumb(photo));
        frame.appendChild(clip);
        if (photo.videoUrl) frame.appendChild(el("div", "live-dot"));
        hang.appendChild(frame);
        hang.title = `${photo.description || ""} — ${fmtLong(key)}`.trim();
        bindHoverPlay(hang);
        hang.onclick = () => openLightbox(photo);
        cell.appendChild(hang);
      }
      grid.appendChild(cell);
    }

    wrap.appendChild(grid);
    stage.appendChild(wrap);
  }

  // ============================ GALLERY ==================================
  function renderGallery() {
    stage.innerHTML = "";
    if (!photos.length) {
      stage.innerHTML = '<p class="empty-note hand">No apples yet — add one in the admin! 🍎</p>';
      return;
    }
    const booth = el("div", "booth");
    booth.appendChild(el("div", "booth-hint", "drag the photos around ✦ click to zoom"));
    stage.appendChild(booth);

    // Size the board to comfortably hold every polaroid.
    const W = booth.clientWidth || stage.clientWidth || 900;
    const card = 196; // polaroid footprint incl. caption-ish
    const cols = Math.max(1, Math.min(photos.length, Math.floor(W / card)));
    const rows = Math.ceil(photos.length / cols);
    const cellW = W / cols;
    const cellH = 250;
    const minH = Math.max(rows * cellH + 40, 460);
    booth.style.minHeight = minH + "px";

    const order = shuffle([...photos.keys()]);
    order.forEach((photoIdx, slot) => {
      const photo = photos[photoIdx];
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const jitterX = (Math.random() - 0.5) * (cellW * 0.32);
      const jitterY = (Math.random() - 0.5) * (cellH * 0.32);
      let x = col * cellW + (cellW - 178) / 2 + jitterX;
      let y = row * cellH + 26 + jitterY;
      x = Math.max(6, Math.min(x, Math.max(6, W - 184)));
      y = Math.max(6, Math.min(y, minH - 230));
      const rot = (Math.random() - 0.5) * 14;

      const pol = buildPolaroid(photo, rot);
      pol.style.left = x + "px";
      pol.style.top = y + "px";
      pol.style.zIndex = String(slot + 1);
      makeDraggable(pol, booth, photo);
      booth.appendChild(pol);
    });
  }

  function buildPolaroid(photo, rot) {
    const pol = el("div", "polaroid");
    pol.dataset.dx = "0";
    pol.dataset.dy = "0";

    const inner = el("div", "polaroid-inner");
    inner.style.transform = `rotate(${rot}deg)`;

    const photoBox = el("div", "pola-photo");
    photoBox.appendChild(mediaThumb(photo));
    if (photo.videoUrl) photoBox.appendChild(el("div", "live-badge", "LIVE"));
    inner.appendChild(photoBox);

    const cap = el("div", "caption");
    cap.appendChild(el("div", "desc", escapeHtml(photo.description || "an apple a day")));
    cap.appendChild(el("div", "date", fmtLong(photo.date)));
    inner.appendChild(cap);

    pol.appendChild(inner);
    bindHoverPlay(pol);
    return pol;
  }

  function makeDraggable(pol, booth, photo) {
    let startX, startY, baseDx, baseDy, dx, dy, moved, pointerId;

    pol.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      pointerId = e.pointerId;
      pol.setPointerCapture(pointerId);
      startX = e.clientX;
      startY = e.clientY;
      baseDx = parseFloat(pol.dataset.dx) || 0;
      baseDy = parseFloat(pol.dataset.dy) || 0;
      dx = baseDx;
      dy = baseDy;
      moved = false;
      pol.classList.add("dragging");
      e.preventDefault();
    });

    pol.addEventListener("pointermove", (e) => {
      if (pointerId == null) return;
      const rawDx = e.clientX - startX;
      const rawDy = e.clientY - startY;
      if (!moved && Math.hypot(rawDx, rawDy) > 5) moved = true;
      if (!moved) return;
      // The card's CSS position (offsetLeft/Top) never changes; only this
      // GPU transform offset does. Moving a permanently-promoted layer purely
      // by transform avoids stale "ghost" paint left at the old position.
      const left = pol.offsetLeft;
      const top = pol.offsetTop;
      dx = Math.max(-40 - left, Math.min(baseDx + rawDx, booth.clientWidth - 60 - left));
      dy = Math.max(-10 - top, Math.min(baseDy + rawDy, booth.clientHeight - 60 - top));
      pol.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    function end() {
      if (pointerId == null) return;
      try { pol.releasePointerCapture(pointerId); } catch (e) {}
      pol.classList.remove("dragging");
      pol.dataset.dx = String(dx);
      pol.dataset.dy = String(dy);
      pointerId = null;
      if (!moved) openLightbox(photo);
    }
    pol.addEventListener("pointerup", end);
    pol.addEventListener("pointercancel", end);
  }

  // ============================ LIGHTBOX =================================
  function openLightbox(photo) {
    lbMedia.innerHTML = "";
    const img = el("img");
    img.src = API + photo.imageUrl;
    img.alt = photo.description || "";
    lbMedia.appendChild(img);

    if (photo.videoUrl) {
      const vid = el("video");
      vid.src = API + photo.videoUrl;
      vid.muted = true;
      vid.loop = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.controls = false;
      vid.setAttribute("playsinline", "");
      Object.assign(vid.style, { position: "absolute", inset: "0" });
      lbMedia.appendChild(vid);
      lbMedia.appendChild(el("div", "live-badge", "LIVE"));
      const p = vid.play();
      if (p && p.catch) p.catch(() => {});
    }

    lbDesc.textContent = photo.description || "";
    lbDate.textContent = fmtLong(photo.date);
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    lbMedia.innerHTML = "";
  }

  lbClose.onclick = closeLightbox;
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

  // ---- Mode switching ---------------------------------------------------
  function setMode(next) {
    mode = next;
    btnCal.classList.toggle("is-active", mode === "calendar");
    btnCal.setAttribute("aria-selected", String(mode === "calendar"));
    btnGal.classList.toggle("is-active", mode === "gallery");
    btnGal.setAttribute("aria-selected", String(mode === "gallery"));
    if (mode === "calendar") renderCalendar();
    else renderGallery();
  }
  btnCal.onclick = () => setMode("calendar");
  btnGal.onclick = () => setMode("gallery");

  let resizeTimer;
  window.addEventListener("resize", () => {
    if (mode !== "gallery") return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderGallery, 200);
  });

  // ---- utils ------------------------------------------------------------
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // ---- Boot -------------------------------------------------------------
  (async function init() {
    const ok = await loadPhotos();
    if (!ok && !photos.length) return;
    setMode(mode);
  })();
})();
