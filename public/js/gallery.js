/* =====================================================
   APPLE DIARY — GALLERY JS
   Calendar + Polaroid modes, Lightbox, Live Photos
   ===================================================== */
(() => {
  const API = '/api/photos';

  // State
  let allPhotos = [];
  let currentMode = 'calendar';
  let calendarYear = new Date().getFullYear();
  let calendarMonth = new Date().getMonth(); // 0-indexed
  let lightboxPhotos = [];
  let lightboxIndex = 0;
  let liveVideoActive = false;

  // DOM refs
  const calendarView = document.getElementById('calendarView');
  const galleryView = document.getElementById('galleryView');
  const btnCalendar = document.getElementById('btnCalendar');
  const btnGallery = document.getElementById('btnGallery');
  const calendarGrid = document.getElementById('calendarGrid');
  const calMonthName = document.getElementById('calMonthName');
  const calYear = document.getElementById('calYear');
  const prevMonth = document.getElementById('prevMonth');
  const nextMonth = document.getElementById('nextMonth');
  const polaroidBoard = document.getElementById('polaroidBoard');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const galleryPhotoCount = document.getElementById('galleryPhotoCount');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const lightbox = document.getElementById('lightbox');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxMediaContainer = document.getElementById('lightboxMediaContainer');
  const lightboxInfo = document.getElementById('lightboxInfo');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  // ===================== DATA =====================

  async function fetchPhotos() {
    showLoading(true);
    try {
      const res = await fetch(API);
      allPhotos = await res.json();
    } catch (e) {
      console.error('Failed to fetch photos:', e);
      allPhotos = [];
    } finally {
      showLoading(false);
    }
  }

  function getPhotoByDate(dateStr) {
    return allPhotos.find(p => p.date === dateStr) || null;
  }

  function photoUrl(filename) {
    return `/uploads/${filename}`;
  }

  // ===================== MODE TOGGLE =====================

  btnCalendar.addEventListener('click', () => switchMode('calendar'));
  btnGallery.addEventListener('click', () => switchMode('gallery'));

  function switchMode(mode) {
    currentMode = mode;
    btnCalendar.classList.toggle('active', mode === 'calendar');
    btnCalendar.setAttribute('aria-selected', mode === 'calendar');
    btnGallery.classList.toggle('active', mode === 'gallery');
    btnGallery.setAttribute('aria-selected', mode === 'gallery');

    if (mode === 'calendar') {
      calendarView.classList.remove('hidden');
      galleryView.classList.add('hidden');
      renderCalendar();
    } else {
      galleryView.classList.remove('hidden');
      calendarView.classList.add('hidden');
      renderGallery();
    }
  }

  // ===================== CALENDAR MODE =====================

  prevMonth.addEventListener('click', () => {
    calendarMonth--;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    renderCalendar();
  });

  nextMonth.addEventListener('click', () => {
    calendarMonth++;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
  });

  function renderCalendar() {
    calMonthName.textContent = MONTHS[calendarMonth];
    calYear.textContent = calendarYear;

    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const today = new Date();
    const todayStr = formatDate(today);

    calendarGrid.innerHTML = '';

    // Cells before first day (previous month)
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevM = calendarMonth === 0 ? 11 : calendarMonth - 1;
      const prevY = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      calendarGrid.appendChild(createDayCell(day, prevM, prevY, true));
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      calendarGrid.appendChild(createDayCell(d, calendarMonth, calendarYear, false));
    }

    // Fill remaining cells (next month)
    const totalCells = calendarGrid.children.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const nextM = calendarMonth === 11 ? 0 : calendarMonth + 1;
    const nextY = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
    for (let d = 1; d <= remaining; d++) {
      calendarGrid.appendChild(createDayCell(d, nextM, nextY, true));
    }
  }

  function createDayCell(day, month, year, isOtherMonth) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const photo = getPhotoByDate(dateStr);
    const todayStr = formatDate(new Date());
    const isToday = dateStr === todayStr;

    const cell = document.createElement('div');
    cell.className = 'cal-day' +
      (isOtherMonth ? ' other-month' : '') +
      (isToday ? ' today' : '') +
      (photo ? ' has-photo' : '');
    cell.setAttribute('role', 'gridcell');

    const numEl = document.createElement('div');
    numEl.className = 'cal-day-num';
    numEl.textContent = day;
    cell.appendChild(numEl);

    if (photo && !isOtherMonth) {
      cell.appendChild(createHangingPhoto(photo));
      cell.addEventListener('click', () => openLightbox(photo, allPhotos.filter(p => p.date)));
    } else if (!isOtherMonth) {
      // Decorative apple for empty days
      const appleEl = document.createElement('div');
      appleEl.className = 'cal-day-apple';
      appleEl.textContent = Math.random() > 0.5 ? '🍎' : '🍏';
      appleEl.setAttribute('aria-hidden', 'true');
      cell.appendChild(appleEl);
    }

    return cell;
  }

  function createHangingPhoto(photo) {
    const container = document.createElement('div');
    container.className = 'cal-hanging-photo';

    // String
    const string = document.createElement('div');
    string.className = 'hanging-string';

    // Clip/pin
    const clip = document.createElement('div');
    clip.className = 'hanging-clip';
    clip.setAttribute('aria-hidden', 'true');
    clip.textContent = '📌';

    // Photo frame
    const frame = document.createElement('div');
    frame.className = 'cal-photo-frame';
    frame.style.transform = `rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;

    const imgSrc = photo.thumbnail_filename
      ? photoUrl(photo.thumbnail_filename)
      : photo.image_filename
        ? photoUrl(photo.image_filename)
        : null;

    if (imgSrc) {
      const img = document.createElement('img');
      img.className = 'cal-photo-img';
      img.src = imgSrc;
      img.alt = photo.title || photo.date;
      img.loading = 'lazy';
      frame.appendChild(img);
    } else {
      frame.textContent = '🍎';
      frame.style.textAlign = 'center';
      frame.style.fontSize = '1.5rem';
      frame.style.padding = '0.5rem';
    }

    if (photo.is_live_photo) {
      const dot = document.createElement('div');
      dot.className = 'live-dot';
      dot.setAttribute('aria-label', 'Live Photo');
      frame.style.position = 'relative';
      frame.appendChild(dot);
    }

    container.appendChild(string);
    container.appendChild(clip);
    container.appendChild(frame);
    return container;
  }

  // ===================== GALLERY (POLAROID) MODE =====================

  shuffleBtn.addEventListener('click', renderGallery);

  function renderGallery() {
    polaroidBoard.innerHTML = '';
    polaroidBoard.style.height = 'auto';

    const photos = [...allPhotos];
    if (!photos.length) {
      polaroidBoard.innerHTML = `<div class="gallery-empty-state"><span class="empty-icon">🍏</span><p>No photos yet!</p></div>`;
      galleryPhotoCount.textContent = '';
      return;
    }

    galleryPhotoCount.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;

    // Sort by date descending for lightbox nav order
    const sortedPhotos = [...photos].sort((a, b) => b.date.localeCompare(a.date));
    // Shuffle display/z-index order
    const shuffled = shuffleArray([...sortedPhotos]);

    const boardWidth  = polaroidBoard.clientWidth || window.innerWidth || 900;
    const minW = 150, maxW = 220;
    const edgePad = 20;   // min distance from board edges
    const topPad  = 30;   // space at top for tape overhang

    // Track placed positions to distribute photos across the board
    // We use a loose grid to ensure photos span the full width but
    // still appear random and freely overlapping
    const cols   = Math.max(2, Math.round(boardWidth / (maxW + 20)));
    const cellW  = boardWidth / cols;
    // Each photo gets assigned a column zone, but with large random jitter
    // so adjacent photos can freely overlap
    const colNextY = new Array(cols).fill(topPad);

    let maxBottom = topPad;

    shuffled.forEach((photo, i) => {
      const polW     = minW + Math.random() * (maxW - minW);
      const polH     = polW + 58;          // square image + caption strip
      const rotation = (Math.random() * 26 - 13); // -13° … +13°

      // Column assignment (round-robin keeps horizontal spread)
      const col    = i % cols;
      const zoneX  = col * cellW;

      // Random x within the zone, clamped to board
      const xJitter = (Math.random() - 0.5) * cellW * 0.9;
      let x = zoneX + cellW / 2 - polW / 2 + xJitter;
      x = Math.max(edgePad, Math.min(boardWidth - polW - edgePad, x));

      // Random y: stack loosely with variable vertical gap so photos overlap
      const vertGap = polH * (0.35 + Math.random() * 0.45); // 35–80% of height gap
      let y = colNextY[col];
      y += Math.random() * 30 - 15; // ±15px jitter on y
      y = Math.max(topPad, y);

      colNextY[col] = y + vertGap;
      maxBottom = Math.max(maxBottom, y + polH + 30);

      const zIndex = 10 + i; // later-placed photos drawn on top
      const polaroid = createPolaroid(photo, polW, x, y, rotation, zIndex, sortedPhotos);
      polaroidBoard.appendChild(polaroid);
    });

    polaroidBoard.style.height = (maxBottom + 80) + 'px';
  }

  function createPolaroid(photo, width, x, y, rotation, zIndex, allList) {
    const el = document.createElement('div');
    el.className = 'polaroid';
    // Store final rotation so hover can reference it
    const animDelay = ((zIndex - 10) * 0.04).toFixed(2);
    el.style.cssText = `
      width: ${width}px;
      left: ${x}px;
      top: ${y}px;
      transform: rotate(${rotation}deg);
      z-index: ${zIndex};
      animation-delay: ${animDelay}s;
      --tape-rotate: ${(rotation * 0.28).toFixed(1)}deg;
      --init-rotate: ${(rotation + (Math.random() * 8 - 4)).toFixed(1)}deg;
      --final-rotate: ${rotation.toFixed(1)}deg;
      --hover-rotate: ${rotation > 0 ? (rotation + 2).toFixed(1) : (rotation - 2).toFixed(1)}deg;
    `;

    const imgSrc = photo.thumbnail_filename
      ? photoUrl(photo.thumbnail_filename)
      : photo.image_filename
        ? photoUrl(photo.image_filename)
        : null;

    let mediaHtml;
    if (imgSrc) {
      mediaHtml = `<img class="polaroid-img" src="${imgSrc}" alt="${escHtml(photo.title || photo.date)}" loading="lazy">`;
    } else {
      mediaHtml = `<div class="polaroid-img-placeholder">🍎</div>`;
    }

    const dateFormatted = formatDateDisplay(photo.date);
    const descHtml = photo.description
      ? `<div class="polaroid-desc">${escHtml(photo.description)}</div>`
      : '';
    const liveBadge = photo.is_live_photo
      ? `<div class="polaroid-live-badge">⊙ LIVE</div>`
      : '';

    el.innerHTML = `
      ${mediaHtml}
      ${liveBadge}
      <div class="polaroid-caption">
        <div class="polaroid-date">${dateFormatted}</div>
        ${descHtml}
      </div>
    `;

    el.addEventListener('click', () => {
      const idx = allList.findIndex(p => p.date === photo.date);
      openLightbox(photo, allList, idx);
    });

    return el;
  }

  // ===================== LIGHTBOX =====================

  function openLightbox(photo, photoList, index) {
    lightboxPhotos = photoList.sort((a, b) => b.date.localeCompare(a.date));
    lightboxIndex = index !== undefined ? index : lightboxPhotos.findIndex(p => p.date === photo.date);
    if (lightboxIndex < 0) lightboxIndex = 0;
    liveVideoActive = false;
    renderLightboxContent();
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    trapFocus(lightbox);
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
    // Stop video if playing
    const vid = lightbox.querySelector('video');
    if (vid) { vid.pause(); vid.src = ''; }
    liveVideoActive = false;
  }

  function renderLightboxContent() {
    const photo = lightboxPhotos[lightboxIndex];
    if (!photo) return;

    liveVideoActive = false;
    lightboxMediaContainer.innerHTML = '';

    const hasLiveVideo = photo.is_live_photo && photo.video_filename;
    const imgSrc = photo.image_filename ? photoUrl(photo.image_filename) : null;
    const vidSrc = hasLiveVideo ? photoUrl(photo.video_filename) : null;

    if (liveVideoActive && vidSrc) {
      const vid = document.createElement('video');
      vid.className = 'lightbox-video';
      vid.src = vidSrc;
      vid.autoplay = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.controls = true;
      lightboxMediaContainer.appendChild(vid);
    } else if (imgSrc) {
      const img = document.createElement('img');
      img.className = 'lightbox-img';
      img.src = imgSrc;
      img.alt = photo.title || photo.date;
      lightboxMediaContainer.appendChild(img);
    }

    // Live photo toggle button
    if (hasLiveVideo) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'live-toggle';
      toggleBtn.innerHTML = `<div class="live-dot-btn" aria-hidden="true"></div> ${liveVideoActive ? 'Show Still' : '▶ Play Live Photo'}`;
      toggleBtn.addEventListener('click', () => {
        liveVideoActive = !liveVideoActive;
        renderLightboxContent();
      });
      lightboxMediaContainer.appendChild(toggleBtn);
    }

    // Info
    const dateStr = formatDateDisplay(photo.date);
    lightboxInfo.innerHTML = `
      <div class="lightbox-date">${dateStr}</div>
      ${photo.title ? `<div class="lightbox-title">${escHtml(photo.title)}</div>` : ''}
      ${photo.description ? `<div class="lightbox-desc">${escHtml(photo.description)}</div>` : ''}
    `;

    // Nav button visibility
    lightboxPrev.style.visibility = lightboxIndex > 0 ? 'visible' : 'hidden';
    lightboxNext.style.visibility = lightboxIndex < lightboxPhotos.length - 1 ? 'visible' : 'hidden';
  }

  lightboxClose.addEventListener('click', closeLightbox);

  lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);

  lightboxPrev.addEventListener('click', () => {
    if (lightboxIndex > 0) { lightboxIndex--; renderLightboxContent(); }
  });

  lightboxNext.addEventListener('click', () => {
    if (lightboxIndex < lightboxPhotos.length - 1) { lightboxIndex++; renderLightboxContent(); }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') { if (lightboxIndex > 0) { lightboxIndex--; renderLightboxContent(); } }
    if (e.key === 'ArrowRight') { if (lightboxIndex < lightboxPhotos.length - 1) { lightboxIndex++; renderLightboxContent(); } }
  });

  // Touch swipe for lightbox
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0 && lightboxIndex < lightboxPhotos.length - 1) { lightboxIndex++; renderLightboxContent(); }
      else if (dx > 0 && lightboxIndex > 0) { lightboxIndex--; renderLightboxContent(); }
    }
  }, { passive: true });

  // ===================== UTILITIES =====================

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
  }

  function trapFocus(el) {
    const focusable = el.querySelectorAll('button, [tabindex="0"]');
    if (focusable.length) focusable[0].focus();
  }

  // Re-layout gallery on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentMode === 'gallery') renderGallery();
    }, 300);
  });

  // ===================== INIT =====================

  async function init() {
    await fetchPhotos();
    // Support ?mode=gallery or ?mode=calendar in URL
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    if (urlMode === 'gallery') {
      switchMode('gallery');
    } else {
      renderCalendar();
    }
  }

  init();
})();
