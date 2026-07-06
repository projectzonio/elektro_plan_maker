import { defaultConnector, uid, storeProject } from './01-state.js';

export function createEditorActions({ state, renderer, hitTesting, symbolRegistry, ui }) {
  const symbolTypes = () => Object.keys(symbolRegistry.items || {});

  function persist() {
    storeProject(state);
    ui.updateCircuits();
    ui.updateSymbolSizeControl();
    ui.updateRouteControls();
    ui.updateMaterial();
    renderer.render();
  }

  function setTool(tool) {
    state.tool = tool;
    ui.setActiveTool(tool);
  }

  function setMode(mode) {
    state.mode = mode;
    ui.setActiveMode(mode);
    if (mode === 'connect') {
      state.tool = 'connect';
      ui.clearActiveTool();
      ui.setCanvasCursor('crosshair');
    } else {
      state.activeRouteId = null;
      ui.setCanvasCursor('default');
      setTool('select');
    }
    renderer.render();
  }

  function addSymbol(type, point) {
    state.symbols.push({
      id: uid('s'),
      type,
      x: point.x,
      y: point.y,
      rot: 0,
      size: state.defaultSymbolSize,
      connector: defaultConnector(),
      name: symbolRegistry.label(type)
    });
    state.selected = { kind: 'symbol', id: state.symbols[state.symbols.length - 1].id };
    ui.updateSymbolSizeControl();
    persist();
  }

  function addRoutePoint(point) {
    const hit = hitTesting.hitTest(point);
    const hitSymbol = ['symbol', 'connector'].includes(hit?.kind) ? state.symbols.find((item) => item.id === hit.id) : null;
    const cleanPoint = hitSymbol
      ? { x: hitSymbol.x, y: hitSymbol.y, symbolId: hitSymbol.id }
      : { x: point.x, y: point.y };
    let route = state.routes.find((item) => item.id === state.activeRouteId);
    if (!route) {
      route = { id: uid('r'), circuitId: state.activeCircuitId, kind: 'link', points: [] };
      state.routes.push(route);
      state.activeRouteId = route.id;
    }
    route.points.push(cleanPoint);
    state.selected = { kind: 'routePoint', id: route.id, pointIndex: route.points.length - 1 };
    persist();
  }

  function finishRoute() {
    state.activeRouteId = null;
    if (state.mode === 'connect') state.selected = null;
    renderer.render();
  }

  function addMask(point) {
    const mask = { id: uid('m'), x: point.x - 75, y: point.y - 28, w: 150, h: 56 };
    state.masks.push(mask);
    state.selected = { kind: 'mask', id: mask.id };
    persist();
  }

  function addCircuit() {
    const colors = ['#d33f49', '#0f7b6c', '#1f5fbf', '#b35f00', '#6b46c1', '#267a2f'];
    const index = state.circuits.length;
    const circuit = { id: uid('c'), name: `Okruh ${index + 1}`, color: colors[index % colors.length] };
    state.circuits.push(circuit);
    state.activeCircuitId = circuit.id;
    finishRoute();
    persist();
  }

  function setActiveRouteKind(kind) {
    const cleanKind = kind === 'supply' ? 'supply' : 'link';
    state.activeRouteKind = cleanKind;
    if (state.selected?.kind === 'routeSegment') {
      const route = state.routes.find((item) => item.id === state.selected.id);
      if (route) setRouteSegmentKind(route, state.selected.segmentIndex, cleanKind);
    } else if (state.selected?.kind === 'routePoint') {
      const route = state.routes.find((item) => item.id === state.selected.id);
      if (route) setRouteSegmentKind(route, selectedPointSegmentIndex(route, state.selected.pointIndex), cleanKind);
    }
    persist();
  }

  function setRouteSegmentKind(route, segmentIndex, kind) {
    if (!route || segmentIndex < 0 || segmentIndex >= route.points.length - 1) return;
    if (!route.segmentKinds) route.segmentKinds = Array.from({ length: Math.max(0, route.points.length - 1) }, () => route.kind === 'supply' ? 'supply' : 'link');
    route.segmentKinds[segmentIndex] = kind;
    route.kind = route.segmentKinds.every((item) => item === 'supply') ? 'supply' : 'link';
  }

  function selectedPointSegmentIndex(route, pointIndex) {
    if (pointIndex <= 0) return 0;
    return Math.min(pointIndex - 1, route.points.length - 2);
  }

  function startScaleCalibration(realMeters) {
    const value = Number(realMeters);
    state.scaleCalibration = {
      realMeters: Number.isFinite(value) && value > 0 ? value : 1,
      first: null
    };
    state.mode = 'edit';
    setTool('scaleMeasure');
    ui.setCanvasCursor('crosshair');
    ui.setStatus('Klikni na začátek a konec známého rozměru v PDF.');
  }

  function addScaleCalibrationPoint(point) {
    if (!state.scaleCalibration?.first) {
      state.scaleCalibration.first = point;
      ui.setStatus('Kalibrace: klikni na druhý konec známého rozměru.');
      renderer.render();
      return;
    }
    const distancePx = Math.hypot(point.x - state.scaleCalibration.first.x, point.y - state.scaleCalibration.first.y);
    if (distancePx > 0) {
      state.materialSettings.metersPer100px = (state.scaleCalibration.realMeters / distancePx) * 100;
    }
    state.scaleCalibration = null;
    setTool('select');
    ui.setCanvasCursor('default');
    ui.setStatus(`Měřítko nastaveno na ${state.materialSettings.metersPer100px.toFixed(3)} m / 100 px.`);
    persist();
  }

  function rotateSelected() {
    const selectedObject = hitTesting.getSelectedObject();
    if (state.selected?.kind === 'symbol' && selectedObject) {
      selectedObject.rot = ((selectedObject.rot || 0) + 45) % 360;
      persist();
    }
  }

  function deleteSelected() {
    if (!state.selected) return;
    if (state.selected.kind === 'symbol') state.symbols = state.symbols.filter((item) => item.id !== state.selected.id);
    if (state.selected.kind === 'mask') state.masks = state.masks.filter((item) => item.id !== state.selected.id);
    if (state.selected.kind === 'routePoint') {
      const route = state.routes.find((item) => item.id === state.selected.id);
      if (route?.segmentKinds) {
        route.segmentKinds.splice(Math.max(0, state.selected.pointIndex - 1), 1);
      }
      route?.points.splice(state.selected.pointIndex, 1);
      state.routes = state.routes.filter((item) => item.points.length);
    }
    state.selected = null;
    persist();
  }

  function clearLocal() {
    if (!confirm('Smazat všechny značky a okruhy v editoru?')) return;
    state.symbols = [];
    state.routes = [];
    state.masks = state.masks.filter((mask) => mask.auto);
    state.selected = null;
    finishRoute();
    persist();
  }

  function bindCanvas(canvas) {
    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      finishRoute();
    });

    canvas.addEventListener('pointerdown', (event) => {
      if (!state.baseCanvas) return;
      const point = renderer.screenToPlan(event);
      if (event.button === 1 || event.altKey) {
        const workspace = canvas.parentElement;
        state.drag = {
          kind: 'pan',
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: workspace.scrollLeft,
          scrollTop: workspace.scrollTop
        };
        return;
      }
      if (state.mode === 'connect') {
        addRoutePoint(point);
        return;
      }
      if (state.tool === 'scaleMeasure') {
        addScaleCalibrationPoint(point);
        return;
      }
      if (symbolTypes().includes(state.tool)) {
        addSymbol(state.tool, point);
        setTool('select');
        return;
      }
      if (state.tool === 'mask') {
        addMask(point);
        setTool('select');
        return;
      }
      state.selected = hitTesting.hitTest(point);
      ui.updateSymbolSizeControl();
      ui.updateRouteControls();
      const selectedObject = hitTesting.getSelectedObject();
      if (selectedObject && state.selected?.kind !== 'routeSegment') {
        state.drag = { kind: 'move', last: point, selected: { ...state.selected } };
      }
      renderer.render();
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!state.drag) return;
      if (state.drag.kind === 'pan') {
        const workspace = canvas.parentElement;
        workspace.scrollLeft = state.drag.scrollLeft - (event.clientX - state.drag.startX);
        workspace.scrollTop = state.drag.scrollTop - (event.clientY - state.drag.startY);
        return;
      }
      const point = renderer.screenToPlan(event);
      const dx = point.x - state.drag.last.x;
      const dy = point.y - state.drag.last.y;
      const selectedObject = hitTesting.getSelectedObject();
      if (!selectedObject) return;
      if (state.selected.kind === 'connector') {
        const dxSymbol = point.x - selectedObject.x;
        const dySymbol = point.y - selectedObject.y;
        selectedObject.connector = {
          angle: Math.atan2(dySymbol, dxSymbol) * 180 / Math.PI,
          length: Math.max(0, Math.hypot(dxSymbol, dySymbol) / (selectedObject.size || 1))
        };
        renderer.render();
        return;
      }
      if (state.selected.kind === 'routePoint') {
        delete selectedObject.symbolId;
      }
      selectedObject.x += dx;
      selectedObject.y += dy;
      state.drag.last = point;
      renderer.render();
    });

    canvas.addEventListener('pointerup', () => {
      if (state.drag) persist();
      state.drag = null;
    });

    canvas.addEventListener('wheel', (event) => {
      if (!state.baseCanvas) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      renderer.zoomAt(event.clientX, event.clientY, factor);
    }, { passive: false });
  }

  return {
    persist,
    setTool,
    setMode,
    finishRoute,
    addCircuit,
    setActiveRouteKind,
    startScaleCalibration,
    rotateSelected,
    deleteSelected,
    clearLocal,
    bindCanvas
  };
}
