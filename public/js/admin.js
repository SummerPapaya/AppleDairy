/* Apple Diary — Admin Panel JS */
(() => {
  const API = '/api/photos';
  let editingDate = null;
  let deleteTarget = null;

  // DOM refs
  const form = document.getElementById('uploadForm');
  const dateInput = document.getElementById('dateInput');
  const titleInput = document.getElementById('titleInput');
  const descInput = document.getElementById('descriptionInput');
  const imageInput = document.getElementById('imageInput');
  const videoInput = document.getElementById('videoInput');
  const imagePreview = document.getElementById('imagePreview');
  const videoPreview = document.getElementById('videoPreview');
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const clearBtn = document.getElementById('clearBtn');
  const formStatus = document.getElementById('formStatus');
  const photosGrid = document.getElementById('photosGrid');
  const loadDateBtn = document.getElementById('loadDateBtn');
  const filterYear = document.getElementById('filterYear');
  const filterMonth = document.getElementById('filterMonth');
  const refreshBtn = document.getElementById('refreshBtn');
  const removeVideoLabel = document.getElementById('removeVideoLabel');
  const removeVideoCheckbox = document.getElementById('removeVideoCheckbox');

  // Delete modal
  const deleteModal = document.getElementById('deleteModal');
  const deleteModalDate = document.getElementById('deleteModalDate');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

  // Set today's date as default
  dateInput.value = new Date().toISOString().split('T')[0];

  // File preview setup
  function setupDropZone(dropArea, fileInput, previewEl, type) {
    dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
    dropArea.addEventListener('drop', e => {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) setFilePreview(file, previewEl, type);
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) setFilePreview(fileInput.files[0], previewEl, type);
    });
  }

  function setFilePreview(file, previewEl, type) {
    previewEl.classList.remove('hidden');
    const url = URL.createObjectURL(file);
    const sizeStr = file.size > 1024*1024
      ? `${(file.size/1024/1024).toFixed(1)} MB`
      : `${Math.round(file.size/1024)} KB`;

    const mediaEl = type === 'video'
      ? `<video src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:2px solid var(--apple-green);" muted playsinline></video>`
      : `<img src="${url}" alt="preview" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:2px solid var(--apple-green);">`;

    previewEl.innerHTML = `
      ${mediaEl}
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${sizeStr}</div>
      </div>
      <button class="remove-file-btn" title="Remove">✕</button>
    `;

    previewEl.querySelector('.remove-file-btn').addEventListener('click', () => {
      previewEl.classList.add('hidden');
      previewEl.innerHTML = '';
      if (type === 'image') { imageInput.value = ''; }
      else { videoInput.value = ''; }
    });
  }

  setupDropZone(document.getElementById('imageDropArea'), imageInput, imagePreview, 'image');
  setupDropZone(document.getElementById('videoDropArea'), videoInput, videoPreview, 'video');

  // Load existing photo for date
  loadDateBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    if (!date) return showStatus('Please select a date first', 'error');
    try {
      const res = await fetch(`${API}/${date}`);
      if (res.status === 404) return showStatus('No photo found for this date', 'error');
      const photo = await res.json();
      populateForm(photo);
    } catch (err) {
      showStatus('Failed to load photo: ' + err.message, 'error');
    }
  });

  function populateForm(photo) {
    editingDate = photo.date;
    dateInput.value = photo.date;
    titleInput.value = photo.title || '';
    descInput.value = photo.description || '';
    submitBtnText.textContent = '✏️ Update Photo';

    // Show existing image
    if (photo.image_filename) {
      const imgUrl = `/uploads/${photo.thumbnail_filename || photo.image_filename}`;
      imagePreview.innerHTML = `
        <img src="${imgUrl}" alt="current image" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:2px solid var(--apple-green);">
        <div class="file-info">
          <div class="file-name">Current: ${photo.image_filename}</div>
          <div class="file-size">Upload new to replace</div>
        </div>
      `;
      imagePreview.classList.remove('hidden');
    }

    if (photo.is_live_photo && photo.video_filename) {
      removeVideoLabel.classList.remove('hidden');
      videoPreview.innerHTML = `
        <div class="file-info" style="padding:0.5rem">
          <div class="file-name">🎞️ Live video: ${photo.video_filename}</div>
          <div class="file-size">Upload new to replace, or check below to remove</div>
        </div>
      `;
      videoPreview.classList.remove('hidden');
    }

    showStatus(`Loaded photo for ${photo.date} — ready to edit`, 'success');
    form.scrollIntoView({ behavior: 'smooth' });
  }

  // Clear form
  clearBtn.addEventListener('click', resetForm);

  function resetForm() {
    editingDate = null;
    form.reset();
    dateInput.value = new Date().toISOString().split('T')[0];
    imagePreview.classList.add('hidden');
    videoPreview.classList.add('hidden');
    imagePreview.innerHTML = '';
    videoPreview.innerHTML = '';
    removeVideoLabel.classList.add('hidden');
    removeVideoCheckbox.checked = false;
    submitBtnText.textContent = '🍎 Save Photo';
    formStatus.classList.add('hidden');
  }

  // Submit form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = dateInput.value;
    if (!date) return showStatus('Date is required', 'error');

    if (!editingDate && !imageInput.files[0]) {
      return showStatus('Please select an image file', 'error');
    }

    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;

    try {
      const fd = new FormData(form);

      // Remove empty file fields
      if (!imageInput.files[0]) fd.delete('image');
      if (!videoInput.files[0]) fd.delete('video');

      const method = editingDate ? 'PUT' : 'POST';
      const url = editingDate ? `${API}/${editingDate}` : API;

      const res = await fetch(url, { method, body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Unknown error');

      showStatus(`Photo for ${data.date} saved successfully! 🍎`, 'success');
      loadPhotos();
      if (!editingDate) {
        setTimeout(resetForm, 2000);
      } else {
        editingDate = data.date;
      }
    } catch (err) {
      showStatus('Error: ' + err.message, 'error');
    } finally {
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
  });

  function showStatus(msg, type) {
    formStatus.textContent = msg;
    formStatus.className = `form-status ${type}`;
    formStatus.classList.remove('hidden');
    if (type === 'success') setTimeout(() => formStatus.classList.add('hidden'), 4000);
  }

  // Load photos list
  async function loadPhotos() {
    const year = filterYear.value;
    const month = filterMonth.value;
    let url = API;
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (month) params.set('month', month);
    if (params.toString()) url += '?' + params.toString();

    photosGrid.innerHTML = `<div class="loading-state"><div class="apple-spin">🍎</div><p>Loading...</p></div>`;

    try {
      const res = await fetch(url);
      const photos = await res.json();

      if (!photos.length) {
        photosGrid.innerHTML = `<div class="empty-state"><div style="font-size:3rem">🍏</div><p>No photos yet. Upload your first one!</p></div>`;
        return;
      }

      photosGrid.innerHTML = photos.map(p => renderPhotoCard(p)).join('');

      // Bind card actions
      photosGrid.querySelectorAll('.card-action-btn.edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const photo = photos.find(p => p.date === btn.dataset.date);
          if (photo) populateForm(photo);
        });
      });

      photosGrid.querySelectorAll('.card-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.date));
      });
    } catch (err) {
      photosGrid.innerHTML = `<div class="empty-state">⚠️ Failed to load photos: ${err.message}</div>`;
    }
  }

  function renderPhotoCard(photo) {
    const imgSrc = photo.thumbnail_filename
      ? `/uploads/${photo.thumbnail_filename}`
      : photo.image_filename
        ? `/uploads/${photo.image_filename}`
        : null;

    const imgEl = imgSrc
      ? `<img class="photo-card-img" src="${imgSrc}" alt="${photo.title || photo.date}" loading="lazy">`
      : `<div class="photo-card-img-placeholder">🍎</div>`;

    const liveBadge = photo.is_live_photo
      ? `<div class="live-photo-badge">⊙ LIVE</div>`
      : '';

    const dateFormatted = new Date(photo.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `
      <div class="photo-card">
        ${imgEl}
        ${liveBadge}
        <div class="photo-card-body">
          <div class="photo-card-date">${dateFormatted}</div>
          ${photo.title ? `<div class="photo-card-title">${escHtml(photo.title)}</div>` : ''}
          ${photo.description ? `<div class="photo-card-desc">${escHtml(photo.description)}</div>` : ''}
        </div>
        <div class="photo-card-actions">
          <button class="card-action-btn edit" data-date="${photo.date}">✏️ Edit</button>
          <button class="card-action-btn delete" data-date="${photo.date}">🗑️ Delete</button>
        </div>
      </div>
    `;
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Delete modal
  function openDeleteModal(date) {
    deleteTarget = date;
    deleteModalDate.textContent = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    deleteModal.classList.remove('hidden');
  }

  cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteTarget = null;
  });

  deleteModal.querySelector('.modal-backdrop').addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteTarget = null;
  });

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API}/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      deleteModal.classList.add('hidden');
      deleteTarget = null;
      loadPhotos();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  });

  // Filters
  refreshBtn.addEventListener('click', loadPhotos);
  filterYear.addEventListener('change', loadPhotos);
  filterMonth.addEventListener('change', loadPhotos);

  // Populate year filter
  function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      filterYear.appendChild(opt);
    }
  }

  populateYearFilter();
  loadPhotos();
})();
