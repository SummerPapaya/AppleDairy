/* Shared thumbnail crop helpers (calendar apple clips + admin editor). */
(function (global) {
  "use strict";

  const DEFAULT = { x: 50, y: 50, zoom: 1 };

  function normalize(crop) {
    if (!crop || typeof crop !== "object") return { ...DEFAULT };
    return {
      x: clamp(Number(crop.x), 0, 100) || DEFAULT.x,
      y: clamp(Number(crop.y), 0, 100) || DEFAULT.y,
      zoom: clamp(Number(crop.zoom), 1, 3) || DEFAULT.zoom,
    };
  }

  function clamp(n, lo, hi) {
    if (!Number.isFinite(n)) return NaN;
    return Math.min(hi, Math.max(lo, n));
  }

  function applyThumbCrop(el, crop) {
    const c = normalize(crop);
    el.style.objectFit = "cover";
    el.style.objectPosition = `${c.x}% ${c.y}%`;
    el.style.transform = `scale(${c.zoom})`;
    el.style.transformOrigin = `${c.x}% ${c.y}%`;
    return c;
  }

  global.ThumbCrop = { DEFAULT, normalize, applyThumbCrop };
})(typeof window !== "undefined" ? window : globalThis);
