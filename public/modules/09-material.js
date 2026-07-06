export const ROUTE_KIND_LABELS = {
  link: 'Propoj',
  supply: 'Privod',
  mixed: 'Privod + propoj'
};

export function routeKindLabel(kind) {
  return ROUTE_KIND_LABELS[kind] || ROUTE_KIND_LABELS.link;
}

export function routeAutoKind(state, route) {
  const segments = routeMaterialSegments(state, route, state.materialSettings || {});
  if (segments.some((segment) => segment.kind === 'supply')) {
    return segments.some((segment) => segment.kind === 'link') ? 'mixed' : 'supply';
  }
  return 'link';
}

export function routeSegmentAutoKind(state, route, index) {
  return routeMaterialSegments(state, route, state.materialSettings || {})[index]?.kind || 'link';
}

export function calculateMaterial(state) {
  const settings = state.materialSettings || {};
  const metersPerPixel = numberOr(settings.metersPer100px, 1) / 100;
  const rows = [];
  const routeSummaries = [];
  const totals = {
    linkRouteM: 0,
    supplyRouteM: 0,
    linkExtraM: 0,
    supplyExtraM: 0,
    linkCount: 0,
    supplyCount: 0,
    deviceTaps: 0,
    totalRawM: 0,
    totalWithWasteM: 0
  };

  state.routes.forEach((route, routeIndex) => {
    const points = route.points || [];
    const summary = {
      id: route.id,
      route,
      name: routeName(route, routeIndex),
      fallbackName: defaultRouteName(routeIndex),
      circuitName: circuitName(state, route.circuitId),
      segmentCount: Math.max(0, points.length - 1),
      kind: 'link',
      linkM: 0,
      supplyM: 0,
      routeLengthM: 0,
      extraM: 0,
      totalM: 0
    };
    if (points.length < 2) {
      routeSummaries.push(summary);
      return;
    }

    const segments = routeMaterialSegments(state, route, settings, metersPerPixel);
    for (const segment of segments) {
      const totalM = segment.routeLengthM + segment.extraM;
      if (segment.kind === 'supply') {
        totals.supplyRouteM += segment.routeLengthM;
        totals.supplyExtraM += segment.extraM;
        totals.supplyCount += 1;
        summary.supplyM += totalM;
      } else {
        totals.linkRouteM += segment.routeLengthM;
        totals.linkExtraM += segment.extraM;
        totals.linkCount += 1;
        summary.linkM += totalM;
      }
      summary.routeLengthM += segment.routeLengthM;
      summary.extraM += segment.extraM;
      summary.totalM += totalM;
      totals.deviceTaps += segment.deviceTaps;
      totals.totalRawM += totalM;
      rows.push({
        id: `${route.id}:${segment.segmentIndex}`,
        routeId: route.id,
        segmentIndex: segment.segmentIndex,
        name: summary.name,
        circuitName: summary.circuitName,
        kind: segment.kind,
        pointCount: 2,
        routeLengthM: segment.routeLengthM,
        extraM: segment.extraM,
        totalM
      });
    }
    summary.kind = summary.supplyM > 0 && summary.linkM > 0
      ? 'mixed'
      : summary.supplyM > 0 ? 'supply' : 'link';
    routeSummaries.push(summary);
  });

  const wasteMultiplier = 1 + Math.max(0, numberOr(settings.wastePercent, 0)) / 100;
  totals.totalWithWasteM = totals.totalRawM * wasteMultiplier;
  return { rows, routeSummaries, totals };
}

function routeMaterialSegments(state, route, settings, metersPerPixel = 1) {
  const points = route.points || [];
  const segments = [];
  const countedDevices = new Set();
  let seenSwitchboard = false;
  let firstDeviceReached = false;
  let switchboardDropAdded = false;

  const firstSymbol = pointSymbol(state, points[0]);
  if (firstSymbol?.type === 'switchboard') {
    seenSwitchboard = true;
  } else if (firstSymbol && firstSymbol.type !== 'switchboard') {
    firstDeviceReached = true;
  }

  for (let i = 1; i < points.length; i += 1) {
    const a = routePointPosition(state, points[i - 1]);
    const b = routePointPosition(state, points[i]);
    const prevSymbol = pointSymbol(state, points[i - 1]);
    const nextSymbol = pointSymbol(state, points[i]);

    if (prevSymbol?.type === 'switchboard') seenSwitchboard = true;
    const kind = seenSwitchboard && !firstDeviceReached ? 'supply' : 'link';
    let extraM = 0;
    let deviceTaps = 0;

    if (!switchboardDropAdded && (prevSymbol?.type === 'switchboard' || nextSymbol?.type === 'switchboard')) {
      extraM += numberOr(settings.switchboardDropM, 3);
      switchboardDropAdded = true;
      seenSwitchboard = true;
    }

    if (i === 1 && prevSymbol && prevSymbol.type !== 'switchboard' && !countedDevices.has(prevSymbol.id)) {
      extraM += deviceExtraMeters(settings, prevSymbol, 'link');
      countedDevices.add(prevSymbol.id);
      deviceTaps += 1;
    }

    if (nextSymbol?.type === 'switchboard') {
      seenSwitchboard = true;
    } else if (nextSymbol && !countedDevices.has(nextSymbol.id)) {
      extraM += deviceExtraMeters(settings, nextSymbol, kind);
      countedDevices.add(nextSymbol.id);
      firstDeviceReached = true;
      deviceTaps += 1;
    }

    segments.push({
      segmentIndex: i - 1,
      kind,
      routeLengthM: Math.hypot(b.x - a.x, b.y - a.y) * metersPerPixel,
      extraM,
      deviceTaps
    });
  }
  return segments;
}

function deviceExtraMeters(settings, symbol, kind) {
  const routeHeight = kind === 'supply'
    ? numberOr(settings.supplyRouteHeightM, 3)
    : numberOr(settings.linkRouteHeightM, 0.5);
  return Math.abs(routeHeight - symbolHeight(settings, symbol));
}

function symbolHeight(settings, symbol) {
  if (symbol.type === 'switchboard') return numberOr(settings.switchboardHeightM, 0);
  if (symbol.type === 'light') return numberOr(settings.lightHeightM, 2.6);
  if (symbol.type?.startsWith('switch')) return numberOr(settings.switchHeightM, 1.2);
  return numberOr(settings.socketHeightM, 0.4);
}

function routePointPosition(state, point) {
  if (point.symbolId) {
    const symbol = state.symbols.find((item) => item.id === point.symbolId);
    if (symbol) return connectorPosition(symbol);
  }
  return point;
}

function connectorPosition(symbol) {
  const connector = symbol.connector || { angle: 90, length: 42 };
  const size = symbol.size || 1;
  const angle = (Number(connector.angle) || 0) * Math.PI / 180;
  const length = Math.max(0, Number(connector.length) || 0) * size;
  return {
    x: symbol.x + Math.cos(angle) * length,
    y: symbol.y + Math.sin(angle) * length
  };
}

function pointSymbol(state, point) {
  if (!point?.symbolId) return null;
  return state.symbols.find((item) => item.id === point.symbolId) || null;
}

function circuitName(state, circuitId) {
  const circuit = state.circuits.find((item) => item.id === circuitId);
  return circuit?.name || 'Okruh';
}

function routeName(route, routeIndex) {
  const name = String(route.name || '').trim();
  return name || defaultRouteName(routeIndex);
}

function defaultRouteName(routeIndex) {
  return `Trasa ${routeIndex + 1}`;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
