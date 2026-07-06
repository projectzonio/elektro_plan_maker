export function createHitTest({ state, renderer }) {
  function hitTest(point) {
    for (let i = state.symbols.length - 1; i >= 0; i -= 1) {
      const symbol = state.symbols[i];
      const connector = renderer.connectorPosition(symbol);
      if (Math.hypot(connector.x - point.x, connector.y - point.y) < 18) {
        return { kind: 'connector', id: symbol.id };
      }
    }
    for (let i = state.symbols.length - 1; i >= 0; i -= 1) {
      const symbol = state.symbols[i];
      if (Math.hypot(symbol.x - point.x, symbol.y - point.y) < 34 * (symbol.size || 1)) {
        return { kind: 'symbol', id: symbol.id };
      }
    }
    for (let i = state.routes.length - 1; i >= 0; i -= 1) {
      const route = state.routes[i];
      for (let p = route.points.length - 1; p >= 0; p -= 1) {
        const pos = renderer.routePointPosition(route.points[p]);
        if (Math.hypot(pos.x - point.x, pos.y - point.y) < 18) {
          return { kind: 'routePoint', id: route.id, pointIndex: p };
        }
      }
      for (let p = route.points.length - 2; p >= 0; p -= 1) {
        const a = renderer.routePointPosition(route.points[p]);
        const b = renderer.routePointPosition(route.points[p + 1]);
        if (distanceToSegment(point, a, b) < 14) {
          return { kind: 'routeSegment', id: route.id, segmentIndex: p };
        }
      }
    }
    for (let i = state.masks.length - 1; i >= 0; i -= 1) {
      const mask = state.masks[i];
      if (point.x >= mask.x && point.x <= mask.x + mask.w && point.y >= mask.y && point.y <= mask.y + mask.h) {
        return { kind: 'mask', id: mask.id };
      }
    }
    return null;
  }

  function getSelectedObject() {
    if (!state.selected) return null;
    if (['symbol', 'connector'].includes(state.selected.kind)) return state.symbols.find((item) => item.id === state.selected.id);
    if (state.selected.kind === 'mask') return state.masks.find((item) => item.id === state.selected.id);
    if (state.selected.kind === 'routePoint') {
      const route = state.routes.find((item) => item.id === state.selected.id);
      return route?.points[state.selected.pointIndex] || null;
    }
    if (state.selected.kind === 'routeSegment') {
      return state.routes.find((item) => item.id === state.selected.id) || null;
    }
    return null;
  }

  return { hitTest, getSelectedObject };
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}
