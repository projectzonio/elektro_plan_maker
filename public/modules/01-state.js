export const STORAGE_KEY = 'greenhouse-plan-editor-v2';

export function defaultMaterialSettings() {
  return {
    metersPer100px: 1,
    socketHeightM: 0.4,
    switchHeightM: 1.2,
    lightHeightM: 2.6,
    switchboardHeightM: 0,
    linkRouteHeightM: 0.5,
    supplyRouteHeightM: 3,
    switchboardDropM: 3,
    wastePercent: 10
  };
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultConnector() {
  return { angle: 90, length: 42 };
}

export function createInitialState() {
  const firstCircuit = { id: uid('c'), name: 'Okruh 1', color: '#d33f49' };
  return {
    mode: 'edit',
    tool: 'select',
    defaultSymbolSize: 1,
    baseCanvas: null,
    planWidth: 1,
    planHeight: 1,
    sourceName: '',
    view: { scale: 1, x: 0, y: 0 },
    symbols: [],
    routes: [],
    masks: [],
    activeRouteKind: 'link',
    materialSettings: defaultMaterialSettings(),
    scaleCalibration: null,
    circuits: [firstCircuit],
    activeCircuitId: firstCircuit.id,
    activeRouteId: null,
    selected: null,
    drag: null
  };
}

export function resetEditableProject(state) {
  const firstCircuit = { id: uid('c'), name: 'Okruh 1', color: '#d33f49' };
  state.symbols = [];
  state.routes = [];
  state.masks = [];
  state.circuits = [firstCircuit];
  state.activeCircuitId = firstCircuit.id;
  state.activeRouteId = null;
  state.activeRouteKind = 'link';
  state.selected = null;
  state.drag = null;
  state.mode = 'edit';
  state.tool = 'select';
}

export function projectData(state) {
  return {
    version: 2,
    defaultSymbolSize: state.defaultSymbolSize,
    sourceName: state.sourceName,
    symbols: state.symbols,
    routes: state.routes,
    masks: state.masks.filter((mask) => !mask.auto),
    activeRouteKind: state.activeRouteKind,
    materialSettings: state.materialSettings,
    circuits: state.circuits,
    activeCircuitId: state.activeCircuitId
  };
}

export function applyProjectData(state, data) {
  state.defaultSymbolSize = Number(data.defaultSymbolSize || 1);
  state.sourceName = data.sourceName || state.sourceName || '';
  state.symbols = (data.symbols || []).map((symbol) => ({
    size: 1,
    ...symbol,
    connector: normalizeConnector(symbol.connector)
  }));
  state.routes = (data.routes || []).map((route) => ({
    ...route,
    kind: route.kind === 'supply' ? 'supply' : 'link',
    points: (route.points || []).map((point) => ({ x: point.x, y: point.y, symbolId: point.symbolId })),
    segmentKinds: normalizeSegmentKinds(route)
  }));
  state.masks = [...state.masks.filter((mask) => mask.auto), ...(data.masks || [])];
  state.activeRouteKind = data.activeRouteKind === 'supply' ? 'supply' : 'link';
  state.materialSettings = { ...defaultMaterialSettings(), ...(data.materialSettings || {}) };
  state.circuits = data.circuits?.length ? data.circuits : state.circuits;
  state.activeCircuitId = data.activeCircuitId || state.circuits[0].id;
  state.activeRouteId = null;
  state.selected = null;
}

function normalizeConnector(connector) {
  const fallback = defaultConnector();
  const angle = Number(connector?.angle);
  const length = Number(connector?.length);
  return {
    angle: Number.isFinite(angle) ? angle : fallback.angle,
    length: Number.isFinite(length) ? Math.max(0, length) : fallback.length
  };
}

function normalizeSegmentKinds(route) {
  const points = route.points || [];
  const fallback = route.kind === 'supply' ? 'supply' : 'link';
  return Array.from({ length: Math.max(0, points.length - 1) }, (_, index) => (
    route.segmentKinds?.[index] === 'supply' ? 'supply' : fallback
  ));
}

export function loadStoredProject() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('greenhouse-plan-editor-v1');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeProject(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData(state)));
}
