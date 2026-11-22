import * as pdfjsLib from '/pdfjs/pdf.mjs';
import { uid } from './01-state.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';

// The cleanup below (hard-coded masks, "Other" label scrubbing, a repaired wall line) was written for one
// specific source PDF. It would damage any other plan, so it is off by default.
// Open the editor with ?legacyPdfCleanup=1 to switch it back on.
export const LEGACY_PDF_CLEANUP = (() => {
  try {
    return new URLSearchParams(window.location.search).get('legacyPdfCleanup') === '1';
  } catch {
    return false;
  }
})();

export async function loadPdfFromUrl(url, state) {
  return loadPdfDocument(url, state);
}

export async function loadPdfFromFile(file, state) {
  const data = new Uint8Array(await file.arrayBuffer());
  return loadPdfDocument({ data }, state, file.name);
}

async function loadPdfDocument(source, state, sourceName = '') {
  state.masks = state.masks.filter((mask) => !mask.auto);
  const pdf = await pdfjsLib.getDocument(source).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const base = document.createElement('canvas');
  base.width = Math.ceil(viewport.width);
  base.height = Math.ceil(viewport.height);
  const baseCtx = base.getContext('2d', { willReadFrequently: true });
  await page.render({ canvasContext: baseCtx, viewport }).promise;
  if (LEGACY_PDF_CLEANUP) {
    await removeOtherLabels(page, viewport, baseCtx, state);
    if (base.height / base.width >= 1.25) {
      applyPortraitOtherMasks(base, baseCtx, state);
    } else {
      removeRasterOtherLabels(baseCtx, state);
    }
    applyKnownOtherMasks(base, baseCtx, state);
    repairKnownWallSegments(base, baseCtx);
  }

  state.baseCanvas = base;
  state.planWidth = base.width;
  state.planHeight = base.height;
  state.sourceName = sourceName;
  return { width: base.width, height: base.height, sourceName, legacyCleanup: LEGACY_PDF_CLEANUP };
}

async function removeOtherLabels(page, viewport, targetCtx, state) {
  const text = await page.getTextContent();
  let count = 0;
  for (const item of text.items) {
    if (!/^Other(?:\s+\d+)?$/i.test(String(item.str).trim())) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.max(24, Math.hypot(tx[2], tx[3]));
    const width = Math.max(110, item.width * viewport.scale);
    const x = tx[4] - 26;
    const y = tx[5] - fontHeight * 1.25;
    const h = fontHeight * 1.75;
    scrubLabelArea(targetCtx, x, y, width + 52, h);
    state.masks.push({ id: uid('m'), x, y, w: width + 52, h, auto: true });
    count += 1;
  }
  if (!count) {
    state.masks.push(
      { id: uid('m'), x: viewport.width * 0.46, y: viewport.height * 0.54, w: 210, h: 70, auto: true },
      { id: uid('m'), x: viewport.width * 0.51, y: viewport.height * 0.49, w: 170, h: 70, auto: true },
      { id: uid('m'), x: viewport.width * 0.48, y: viewport.height * 0.72, w: 210, h: 70, auto: true }
    );
  }
}

function applyKnownOtherMasks(base, targetCtx, state) {
  const masks = [
    { x: 0.303, y: 0.421, w: 0.202, h: 0.074 },
    { x: 0.462, y: 0.382, w: 0.158, h: 0.074 },
    { x: 0.445, y: 0.535, w: 0.188, h: 0.079 }
  ];
  for (const item of masks) {
    const mask = {
      id: uid('m'),
      x: item.x * base.width,
      y: item.y * base.height,
      w: item.w * base.width,
      h: item.h * base.height,
      auto: true
    };
    scrubLabelArea(targetCtx, mask.x, mask.y, mask.w, mask.h, { preserveWhiteOverDark: false });
    state.masks.push(mask);
  }
}

function applyPortraitOtherMasks(base, targetCtx, state) {
  if (base.height / base.width < 1.25) return;
  const masks = [
    { x: 0.402, y: 0.335, w: 0.208, h: 0.072 },
    { x: 0.342, y: 0.420, w: 0.235, h: 0.082 },
    { x: 0.402, y: 0.476, w: 0.208, h: 0.072 },
    { x: 0.402, y: 0.602, w: 0.208, h: 0.072 },
    { x: 0.402, y: 0.695, w: 0.208, h: 0.072 }
  ];
  for (const item of masks) {
    const mask = {
      id: uid('m'),
      x: item.x * base.width,
      y: item.y * base.height,
      w: item.w * base.width,
      h: item.h * base.height,
      auto: true
    };
    scrubLabelArea(targetCtx, mask.x, mask.y, mask.w, mask.h);
    state.masks.push(mask);
  }
}

function scrubLabelArea(targetCtx, x, y, w, h, options = {}) {
  const preserveWhiteOverDark = options.preserveWhiteOverDark !== false;
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.min(targetCtx.canvas.width - sx, Math.ceil(w));
  const sh = Math.min(targetCtx.canvas.height - sy, Math.ceil(h));
  if (sw <= 0 || sh <= 0) return;
  const image = targetCtx.getImageData(sx, sy, sw, sh);
  const data = image.data;
  const source = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isNeutral = Math.abs(r - g) < 18 && Math.abs(g - b) < 18;
    const isGreyLabel = isNeutral && r >= 70 && r <= 175;
    const isWhiteText = isNeutral && r > 218;
    if (isGreyLabel || isWhiteText) {
      const replacement = preserveWhiteOverDark && isWhiteText && hasDarkNeighborhood(source, sw, sh, i) ? 0 : 255;
      data[i] = replacement;
      data[i + 1] = replacement;
      data[i + 2] = replacement;
      data[i + 3] = 255;
    }
  }
  targetCtx.putImageData(image, sx, sy);
}

function removeRasterOtherLabels(targetCtx, state) {
  const canvas = targetCtx.canvas;
  const image = targetCtx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = image;
  const textBoxes = findWhiteTextOnGrey(data, width, height);
  const labels = textBoxes.map((box) => labelBoxAroundText(data, width, height, box));

  for (const label of mergeOverlappingBoxes(labels).filter(isLikelyOtherLabel)) {
    fillWhite(targetCtx, label.x, label.y, label.w, label.h);
    state.masks.push({ id: uid('m'), ...label, auto: true });
  }
}

function findWhiteTextOnGrey(data, width, height) {
  const labels = [];

  const tile = 12;
  const columns = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);
  const textTiles = new Uint8Array(columns * rows);
  const visited = new Uint8Array(columns * rows);
  const stack = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (tileHasWhiteOnGrey(data, width, height, col * tile, row * tile, tile)) {
        textTiles[row * columns + col] = 1;
      }
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const start = row * columns + col;
      if (visited[start] || !textTiles[start]) continue;
      let minCol = col;
      let maxCol = col;
      let minRow = row;
      let maxRow = row;
      let tileCount = 0;
      stack.length = 0;
      stack.push(start);
      visited[start] = 1;

      while (stack.length) {
        const index = stack.pop();
        const tx = index % columns;
        const ty = Math.floor(index / columns);
        tileCount += 1;
        if (tx < minCol) minCol = tx;
        if (tx > maxCol) maxCol = tx;
        if (ty < minRow) minRow = ty;
        if (ty > maxRow) maxRow = ty;
        visitTextTile(tx + 1, ty);
        visitTextTile(tx - 1, ty);
        visitTextTile(tx, ty + 1);
        visitTextTile(tx, ty - 1);
        visitTextTile(tx + 1, ty + 1);
        visitTextTile(tx - 1, ty - 1);
        visitTextTile(tx + 1, ty - 1);
        visitTextTile(tx - 1, ty + 1);
      }

      const x = minCol * tile;
      const y = minRow * tile;
      const boxW = Math.min(width - x, (maxCol - minCol + 1) * tile);
      const boxH = Math.min(height - y, (maxRow - minRow + 1) * tile);
      if (
        tileCount >= 2 &&
        boxW >= 18 && boxW <= 360 &&
        boxH >= 18 && boxH <= 130
      ) {
        labels.push({ x, y, w: boxW, h: boxH });
      }
    }
  }

  function visitTextTile(col, row) {
    if (col < 0 || row < 0 || col >= columns || row >= rows) return;
    const index = row * columns + col;
    if (visited[index]) return;
    visited[index] = 1;
    if (textTiles[index]) stack.push(index);
  }

  return mergeNearbyTextBoxes(labels);
}

function tileHasWhiteOnGrey(data, width, height, startX, startY, size) {
  let text = 0;
  for (let y = startY; y < Math.min(height, startY + size); y += 3) {
    for (let x = startX; x < Math.min(width, startX + size); x += 3) {
      const offset = (y * width + x) * 4;
      if (data[offset] > 185 && data[offset + 1] > 185 && data[offset + 2] > 185 && hasNearbyLabelGrey(data, width, height, x, y, 24)) {
        text += 1;
        if (text >= 1) return true;
      }
    }
  }
  return false;
}

function isLabelGrey(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const neutral = Math.abs(r - g) < 24 && Math.abs(g - b) < 24 && Math.abs(r - b) < 24;
  return neutral && r >= 58 && r <= 178;
}

function hasNearbyLabelGrey(data, width, height, x, y, radius = 8) {
  for (let py = Math.max(0, y - radius); py <= Math.min(height - 1, y + radius); py += 4) {
    for (let px = Math.max(0, x - radius); px <= Math.min(width - 1, x + radius); px += 4) {
      if (isLabelGrey(data, (py * width + px) * 4)) return true;
    }
  }
  return false;
}

function labelBoxAroundText(data, width, height, textBox) {
  let x1 = Math.max(0, textBox.x - Math.max(70, textBox.w * 1.8));
  let y1 = Math.max(0, textBox.y - Math.max(28, textBox.h * 0.8));
  let x2 = Math.min(width, textBox.x + textBox.w + Math.max(90, textBox.w * 1.2));
  let y2 = Math.min(height, textBox.y + textBox.h + Math.max(34, textBox.h * 0.8));

  for (let pass = 0; pass < 8; pass += 1) {
    const next = expandToGreyBounds(data, width, height, x1, y1, x2, y2);
    if (next.x1 === x1 && next.y1 === y1 && next.x2 === x2 && next.y2 === y2) break;
    x1 = next.x1;
    y1 = next.y1;
    x2 = next.x2;
    y2 = next.y2;
  }

  return { x: x1 - 8, y: y1 - 8, w: x2 - x1 + 16, h: y2 - y1 + 16 };
}

function expandToGreyBounds(data, width, height, x1, y1, x2, y2) {
  let minX = x1;
  let minY = y1;
  let maxX = x2;
  let maxY = y2;
  const step = 4;
  for (let y = y1; y < y2; y += step) {
    for (let x = x1; x < x2; x += step) {
      if (!isLabelGrey(data, (Math.floor(y) * width + Math.floor(x)) * 4)) continue;
      if (x - step < minX) minX = Math.max(0, x - step);
      if (y - step < minY) minY = Math.max(0, y - step);
      if (x + step > maxX) maxX = Math.min(width, x + step);
      if (y + step > maxY) maxY = Math.min(height, y + step);
    }
  }
  return { x1: Math.floor(minX), y1: Math.floor(minY), x2: Math.ceil(maxX), y2: Math.ceil(maxY) };
}

function mergeNearbyTextBoxes(boxes) {
  return mergeOverlappingBoxes(boxes.map((box) => ({
    x: box.x - 36,
    y: box.y - 18,
    w: box.w + 72,
    h: box.h + 36
  }))).map((box) => ({
    x: box.x + 36,
    y: box.y + 18,
    w: Math.max(0, box.w - 72),
    h: Math.max(0, box.h - 36)
  }));
}

function fillWhite(targetCtx, x, y, w, h) {
  targetCtx.save();
  targetCtx.fillStyle = '#ffffff';
  targetCtx.fillRect(Math.max(0, x), Math.max(0, y), w, h);
  targetCtx.restore();
}

function mergeOverlappingBoxes(boxes) {
  const merged = [];
  for (const box of boxes) {
    let current = box;
    let found = true;
    while (found) {
      found = false;
      for (let i = 0; i < merged.length; i += 1) {
        if (!boxesOverlap(current, merged[i])) continue;
        const next = merged.splice(i, 1)[0];
        const x1 = Math.min(current.x, next.x);
        const y1 = Math.min(current.y, next.y);
        const x2 = Math.max(current.x + current.w, next.x + next.w);
        const y2 = Math.max(current.y + current.h, next.y + next.h);
        current = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        found = true;
        break;
      }
    }
    merged.push(current);
  }
  return merged;
}

function boxesOverlap(a, b) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function isLikelyOtherLabel(box) {
  return box.x > 0 && box.y > 0 && box.w > 100 && box.h > 45;
}

function repairKnownWallSegments(base, targetCtx) {
  targetCtx.save();
  targetCtx.strokeStyle = '#000000';
  targetCtx.lineWidth = base.width * 0.018;
  targetCtx.lineCap = 'butt';
  targetCtx.beginPath();
  targetCtx.moveTo(base.width * 0.374, base.height * 0.18);
  targetCtx.lineTo(base.width * 0.374, base.height * 0.82);
  targetCtx.stroke();
  targetCtx.restore();
}

function hasDarkNeighborhood(data, width, height, pixelIndex) {
  const pixel = pixelIndex / 4;
  const px = pixel % width;
  const py = Math.floor(pixel / width);
  let dark = 0;
  for (let y = Math.max(0, py - 5); y <= Math.min(height - 1, py + 5); y += 1) {
    for (let x = Math.max(0, px - 5); x <= Math.min(width - 1, px + 5); x += 1) {
      const idx = (y * width + x) * 4;
      if (data[idx] < 45 && data[idx + 1] < 45 && data[idx + 2] < 45) dark += 1;
      if (dark > 16) return true;
    }
  }
  return false;
}
