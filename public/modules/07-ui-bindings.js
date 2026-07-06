import { applyProjectData, projectData, resetEditableProject } from './01-state.js';
import { loadPdfFromFile } from './02-pdf-import.js';
import { download, exportFilename, exportPdf, exportPng } from './06-export.js';
import { calculateMaterial, routeKindLabel } from './09-material.js';

export function createUi({ state, renderer }) {
  const statusEl = document.getElementById('status');
  const toolButtons = [...document.querySelectorAll('[data-tool]')];
  const modeButtons = [...document.querySelectorAll('[data-mode]')];
  const circuitSelect = document.getElementById('circuitSelect');
  const circuitName = document.getElementById('circuitName');
  const circuitColor = document.getElementById('circuitColor');
  const symbolSize = document.getElementById('symbolSize');
  const symbolSizeValue = document.getElementById('symbolSizeValue');
  const materialSummary = document.getElementById('materialSummary');
  const calibrationMeters = document.getElementById('calibrationMeters');
  const materialInputs = [
    'metersPer100px',
    'socketHeightM',
    'switchHeightM',
    'lightHeightM',
    'linkRouteHeightM',
    'supplyRouteHeightM',
    'switchboardDropM',
    'wastePercent'
  ].map((id) => document.getElementById(id)).filter(Boolean);
  const canvas = document.getElementById('planCanvas');
  let actionsApi = null;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setActiveTool(tool) {
    toolButtons.forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
  }

  function clearActiveTool() {
    toolButtons.forEach((button) => button.classList.remove('active'));
  }

  function setActiveMode(mode) {
    modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  }

  function setCanvasCursor(cursor) {
    canvas.style.cursor = cursor;
  }

  function updateCircuits() {
    circuitSelect.innerHTML = '';
    state.circuits.forEach((circuit, index) => {
      const option = document.createElement('option');
      option.value = circuit.id;
      option.textContent = circuit.name || `Okruh ${index + 1}`;
      circuitSelect.appendChild(option);
    });
    circuitSelect.value = state.activeCircuitId;
    const active = state.circuits.find((item) => item.id === state.activeCircuitId);
    circuitName.value = active?.name || '';
    circuitColor.value = active?.color || '#d33f49';
  }

  function updateSymbolSizeControl() {
    const symbol = renderer.selectedSymbol();
    const value = symbol?.size || state.defaultSymbolSize;
    symbolSize.value = String(value);
    symbolSizeValue.textContent = `${Math.round(value * 100)} %`;
  }

  function selectedRouteSegment() {
    if (!['routePoint', 'routeSegment'].includes(state.selected?.kind)) return null;
    const route = state.routes.find((item) => item.id === state.selected.id);
    if (!route) return null;
    const segmentIndex = state.selected.kind === 'routeSegment'
      ? state.selected.segmentIndex
      : selectedPointSegmentIndex(route, state.selected.pointIndex);
    return { route, segmentIndex };
  }

  function selectedPointSegmentIndex(route, pointIndex) {
    if (pointIndex <= 0) return 0;
    return Math.min(pointIndex - 1, route.points.length - 2);
  }

  function segmentKind(route, segmentIndex) {
    if (route.segmentKinds?.[segmentIndex]) return route.segmentKinds[segmentIndex];
    return route.kind === 'supply' ? 'supply' : 'link';
  }

  function updateRouteControls() {
  }

  function updateMaterialInputs() {
    for (const input of materialInputs) {
      input.value = String(state.materialSettings[input.id]);
    }
  }

  function updateMaterial() {
    if (!materialInputs.includes(document.activeElement)) updateMaterialInputs();
    const material = calculateMaterial(state);
    materialSummary.replaceChildren();

    const total = document.createElement('div');
    total.className = 'material-total';
    total.textContent = `Celkem kabel: ${formatMeters(material.totals.totalWithWasteM)} m`;
    materialSummary.appendChild(total);

    const detail = document.createElement('div');
    detail.className = 'material-detail';
    detail.textContent = [
      `Bez rezervy ${formatMeters(material.totals.totalRawM)} m`,
      `přívody ${formatMeters(material.totals.supplyRouteM + material.totals.supplyExtraM)} m`,
      `propoje ${formatMeters(material.totals.linkRouteM + material.totals.linkExtraM)} m`,
      `napojení ${material.totals.deviceTaps}`
    ].join(' / ');
    materialSummary.appendChild(detail);

    const activeSummaries = material.routeSummaries.filter((route) => route.segmentCount > 0);
    if (!activeSummaries.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Nakresli trasu alespoň mezi dvěma body.';
      materialSummary.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'material-list';
    for (const route of activeSummaries) {
      const item = document.createElement('div');
      item.className = 'material-route-row';

      const nameButton = document.createElement('button');
      nameButton.type = 'button';
      nameButton.className = 'route-name-button';
      nameButton.textContent = route.name;
      nameButton.addEventListener('click', () => renameRoute(route));

      const length = document.createElement('span');
      length.className = 'route-length';
      length.textContent = `: ${formatMeters(route.totalM)} m`;

      const detailLine = document.createElement('div');
      detailLine.className = 'material-row';
      detailLine.textContent = [
        route.circuitName,
        routeKindLabel(route.kind),
        `${route.segmentCount} úseků`,
        `trasa ${formatMeters(route.routeLengthM)} m`,
        `výšky ${formatMeters(route.extraM)} m`
      ].join(' / ');

      item.append(nameButton, length, detailLine);
      list.appendChild(item);
    }
    materialSummary.appendChild(list);
  }

  function renameRoute(routeSummary) {
    const nextName = prompt('Název trasy', routeSummary.name);
    if (nextName === null) return;
    routeSummary.route.name = nextName.trim() || routeSummary.fallbackName;
    actionsApi?.persist();
  }

  const ui = {
    setStatus,
    setActiveTool,
    clearActiveTool,
    setActiveMode,
    setCanvasCursor,
    updateCircuits,
    updateSymbolSizeControl,
    updateRouteControls,
    updateMaterial
  };

  function bind(actions) {
    actionsApi = actions;
    toolButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (state.mode !== 'edit') actions.setMode('edit');
        actions.setTool(button.dataset.tool);
      });
    });

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => actions.setMode(button.dataset.mode));
    });

    document.getElementById('importPdf').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        setStatus(`Načítám PDF: ${file.name}...`);
        resetEditableProject(state);
        setActiveMode('edit');
        setActiveTool('select');
        setCanvasCursor('default');
        const result = await loadPdfFromFile(file, state);
        renderer.fitView();
        renderer.render();
        actions.persist();
        setStatus(`Načtena první stránka PDF ${result.sourceName} (${Math.round(result.width)} x ${Math.round(result.height)} px), štítky Other jsou překryté.`);
      } catch (error) {
        console.error(error);
        setStatus(`PDF se nepodařilo načíst: ${error.message}`);
      } finally {
        event.target.value = '';
      }
    });

    document.getElementById('addCircuit').addEventListener('click', actions.addCircuit);
    circuitSelect.addEventListener('change', () => {
      state.activeCircuitId = circuitSelect.value;
      actions.finishRoute();
      actions.persist();
    });
    circuitName.addEventListener('input', () => {
      const active = state.circuits.find((item) => item.id === state.activeCircuitId);
      if (active) active.name = circuitName.value;
      actions.persist();
    });
    circuitColor.addEventListener('input', () => {
      const active = state.circuits.find((item) => item.id === state.activeCircuitId);
      if (active) active.color = circuitColor.value;
      actions.persist();
    });
    document.getElementById('finishRoute').addEventListener('click', actions.finishRoute);
    document.getElementById('measureScale').addEventListener('click', () => actions.startScaleCalibration(calibrationMeters.value));
    materialInputs.forEach((input) => {
      input.addEventListener('input', () => {
        state.materialSettings[input.id] = Number(input.value);
        actions.persist();
      });
    });
    symbolSize.addEventListener('input', () => {
      const value = Number(symbolSize.value);
      const symbol = renderer.selectedSymbol();
      if (symbol) {
        symbol.size = value;
      } else {
        state.defaultSymbolSize = value;
      }
      symbolSizeValue.textContent = `${Math.round(value * 100)} %`;
      actions.persist();
    });
    document.getElementById('rotateItem').addEventListener('click', actions.rotateSelected);
    document.getElementById('deleteItem').addEventListener('click', actions.deleteSelected);
    document.getElementById('clearLocal').addEventListener('click', actions.clearLocal);
    document.getElementById('saveProject').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(projectData(state), null, 2)], { type: 'application/json' });
      download(URL.createObjectURL(blob), exportFilename(state, 'json'));
    });
    document.getElementById('loadProject').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      applyProjectData(state, JSON.parse(await file.text()));
      actions.persist();
      updateRouteControls();
      updateMaterial();
      event.target.value = '';
    });
    document.getElementById('exportPng').addEventListener('click', () => exportPng(renderer, state));
    document.getElementById('exportPdf').addEventListener('click', () => exportPdf(renderer, state));
    window.addEventListener('resize', renderer.resizeCanvas);
  }

  return { ...ui, bind };
}

function formatMeters(value) {
  return Number(value || 0).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
