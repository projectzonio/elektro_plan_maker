import { calculateMaterial, routeKindLabel } from './09-material.js';

const { jsPDF } = window.jspdf;

export function download(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportBaseName(state) {
  const sourceName = String(state?.sourceName || '').trim();
  const withoutExtension = sourceName.replace(/\.[^.\\/]+$/, '');
  const fallback = 'sklenik-elektro-plan';
  return sanitizeFilename(withoutExtension || fallback);
}

export function exportFilename(state, extension) {
  return `${exportBaseName(state)}.${extension}`;
}

function sanitizeFilename(name) {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned || 'sklenik-elektro-plan';
}

export function exportPng(renderer, state) {
  renderer.exportCanvas().toBlob((blob) => {
    download(URL.createObjectURL(blob), exportFilename(state, 'png'));
  }, 'image/png');
}

export function exportPdf(renderer, state) {
  const out = renderer.exportCanvas();
  const orientation = out.width > out.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'px', format: [out.width, out.height], hotfixes: ['px_scaling'], compress: true });
  pdf.addImage(out.toDataURL('image/jpeg', 0.82), 'JPEG', 0, 0, out.width, out.height, undefined, 'FAST');
  addMaterialSummaryPage(pdf, state, out.width, out.height, orientation);
  pdf.save(exportFilename(state, 'pdf'));
}

function addMaterialSummaryPage(pdf, state, width, height, orientation) {
  const material = calculateMaterial(state);
  const counts = countSymbols(state);
  const margin = Math.max(120, Math.round(Math.min(width, height) * 0.045));
  const contentWidth = width - margin * 2;
  const titleSize = Math.max(42, Math.round(width * 0.027));
  const headingSize = Math.max(28, Math.round(width * 0.017));
  const bodySize = Math.max(22, Math.round(width * 0.012));
  const smallSize = Math.max(18, Math.round(width * 0.01));
  const lineGap = Math.round(bodySize * 1.45);

  pdf.addPage([width, height], orientation);
  pdf.setTextColor(24, 32, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(titleSize);
  pdf.text('Souhrn materialu', margin, margin);

  let y = margin + titleSize * 1.4;
  y = drawSummaryBlock(pdf, [
    `Zdroj: ${state.sourceName || 'bez nazvu'}`,
    `Kabel celkem vcetne rezervy: ${formatMeters(material.totals.totalWithWasteM)} m`,
    `Kabel bez rezervy: ${formatMeters(material.totals.totalRawM)} m`,
    `Privody: ${formatMeters(material.totals.supplyRouteM + material.totals.supplyExtraM)} m (${material.totals.supplyCount} useku)`,
    `Propoje: ${formatMeters(material.totals.linkRouteM + material.totals.linkExtraM)} m (${material.totals.linkCount} useku)`
  ], { pdf, x: margin, y, width: contentWidth, headingSize, bodySize, lineGap, title: 'Kabely' });

  y = drawSummaryBlock(pdf, deviceSummaryLines(counts), {
    pdf,
    x: margin,
    y: y + lineGap,
    width: contentWidth,
    headingSize,
    bodySize,
    lineGap,
    title: 'Pristroje a svetla'
  });

  y = drawSummaryBlock(pdf, routeSummaryLines(material), {
    pdf,
    x: margin,
    y: y + lineGap,
    width: contentWidth,
    headingSize,
    bodySize: smallSize,
    lineGap: Math.round(smallSize * 1.35),
    title: 'Trasy'
  });

  drawFooter(pdf, state, width, height, margin, smallSize);
}

function drawSummaryBlock(pdf, lines, options) {
  const { x, width, title, headingSize, bodySize, lineGap } = options;
  let y = options.y;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(headingSize);
  pdf.text(title, x, y);
  y += headingSize * 1.15;
  pdf.setDrawColor(214, 221, 229);
  pdf.line(x, y, x + width, y);
  y += lineGap;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(bodySize);
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, width);
    pdf.text(wrapped, x, y);
    y += lineGap * wrapped.length;
  }
  return y;
}

function deviceSummaryLines(counts) {
  return [
    `Pristroje celkem bez svetel a rozvadece: ${counts.devices}`,
    `Svetla: ${counts.light || 0}`,
    `Zasuvky 1f: ${counts.socket1 || 0}`,
    `Zasuvky 3f: ${counts.socket3 || 0}`,
    `Vypinace: ${counts.switches}`,
    `Rozvadece: ${counts.switchboard || 0}`
  ];
}

function routeSummaryLines(material) {
  const activeRoutes = material.routeSummaries.filter((route) => route.segmentCount > 0);
  if (!activeRoutes.length) return ['Zadne trasy nejsou zakreslene.'];
  return activeRoutes.map((route) => (
    `${route.name}: ${formatMeters(route.totalM)} m ` +
    `(${route.circuitName}, ${routeKindLabel(route.kind)}, ${route.segmentCount} useku, ` +
    `trasa ${formatMeters(route.routeLengthM)} m, vysky ${formatMeters(route.extraM)} m)`
  ));
}

function countSymbols(state) {
  const counts = {
    devices: 0,
    switches: 0
  };
  for (const symbol of state.symbols) {
    counts[symbol.type] = (counts[symbol.type] || 0) + 1;
    if (symbol.type?.startsWith('switch')) counts.switches += 1;
    if (!['light', 'switchboard'].includes(symbol.type)) counts.devices += 1;
  }
  return counts;
}

function drawFooter(pdf, state, width, height, margin, fontSize) {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(100, 113, 127);
  const date = new Date().toLocaleString('cs-CZ');
  pdf.text(`Export: ${date}`, margin, height - margin * 0.7);
  pdf.text(`Meritko: 100 px = ${formatMeters(state.materialSettings?.metersPer100px || 0)} m`, width - margin, height - margin * 0.7, { align: 'right' });
}

function formatMeters(value) {
  return Number(value || 0).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
