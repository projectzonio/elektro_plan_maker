import { routeAutoKind, routeKindLabel, routeSegmentAutoKind } from './09-material.js';

export function createRenderer({ canvas, ctx, state, symbolRegistry }) {
  function roundedRect(target, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    target.beginPath();
    target.moveTo(x + radius, y);
    target.lineTo(x + w - radius, y);
    target.quadraticCurveTo(x + w, y, x + w, y + radius);
    target.lineTo(x + w, y + h - radius);
    target.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    target.lineTo(x + radius, y + h);
    target.quadraticCurveTo(x, y + h, x, y + h - radius);
    target.lineTo(x, y + radius);
    target.quadraticCurveTo(x, y, x + radius, y);
    target.closePath();
  }

  function routePointPosition(point) {
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

  function selectedSymbol() {
    if (state.selected?.kind !== 'symbol') return null;
    return state.symbols.find((item) => item.id === state.selected.id) || null;
  }

  function fitView() {
    const viewport = workspaceViewport();
    const scale = Math.min(viewport.width / state.planWidth, viewport.height / state.planHeight) * 0.94;
    state.view.scale = scale;
    layoutCanvas();
    canvas.parentElement.scrollLeft = 0;
    canvas.parentElement.scrollTop = 0;
  }

  function workspaceViewport() {
    const workspace = canvas.parentElement;
    return {
      width: Math.max(1, workspace?.clientWidth || canvas.clientWidth || 1),
      height: Math.max(1, workspace?.clientHeight || canvas.clientHeight || 1)
    };
  }

  function layoutCanvas() {
    const viewport = workspaceViewport();
    const padding = 80;
    const planWidth = Math.max(1, state.planWidth * state.view.scale);
    const planHeight = Math.max(1, state.planHeight * state.view.scale);
    const contentWidth = Math.max(viewport.width, Math.ceil(planWidth + padding * 2));
    const contentHeight = Math.max(viewport.height, Math.ceil(planHeight + padding * 2));
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${contentWidth}px`;
    canvas.style.height = `${contentHeight}px`;
    canvas.width = Math.max(1, Math.round(contentWidth * dpr));
    canvas.height = Math.max(1, Math.round(contentHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.view.x = Math.max(padding, (contentWidth - planWidth) / 2);
    state.view.y = Math.max(padding, (contentHeight - planHeight) / 2);
  }

  function resizeCanvas() {
    layoutCanvas();
    render();
  }

  function zoomAt(clientX, clientY, factor) {
    const workspace = canvas.parentElement;
    const before = {
      point: screenToPlan({ clientX, clientY }),
      viewport: workspace.getBoundingClientRect()
    };
    state.view.scale = Math.min(4, Math.max(0.08, state.view.scale * factor));
    layoutCanvas();
    workspace.scrollLeft = state.view.x + before.point.x * state.view.scale - (clientX - before.viewport.left);
    workspace.scrollTop = state.view.y + before.point.y * state.view.scale - (clientY - before.viewport.top);
    render();
  }

  function screenToPlan(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - state.view.x) / state.view.scale,
      y: (event.clientY - rect.top - state.view.y) / state.view.scale
    };
  }

  function render(target = ctx, options = {}) {
    const rect = canvas.getBoundingClientRect();
    if (!state.baseCanvas && !options.export) {
      target.clearRect(0, 0, rect.width, rect.height);
      return;
    }
    if (!state.baseCanvas) return;
    target.save();
    if (!options.export) {
      target.clearRect(0, 0, rect.width, rect.height);
      target.translate(state.view.x, state.view.y);
      target.scale(state.view.scale, state.view.scale);
    }
    target.drawImage(state.baseCanvas, 0, 0);
    drawMasks(target);
    drawRoutes(target);
    drawScaleCalibration(target);
    drawSymbols(target);
    drawConnectors(target);
    target.restore();
  }

  function drawMasks(target) {
    for (const mask of state.masks) {
      if (mask.auto) continue;
      target.save();
      target.fillStyle = '#ffffff';
      roundedRect(target, mask.x, mask.y, mask.w, mask.h, 12);
      target.fill();
      if (state.selected?.id === mask.id) {
        target.strokeStyle = '#1f5fbf';
        target.lineWidth = 3;
        target.stroke();
      }
      target.restore();
    }
  }

  function drawRoutes(target) {
    for (const route of state.routes) {
      const circuit = state.circuits.find((item) => item.id === route.circuitId);
      const color = circuit?.color || '#d33f49';
      target.save();
      target.fillStyle = '#ffffff';
      target.lineCap = 'round';
      target.lineJoin = 'round';
      for (let index = 1; index < route.points.length; index += 1) {
        const kind = routeSegmentAutoKind(state, route, index - 1);
        const start = routePointPosition(route.points[index - 1]);
        const end = routePointPosition(route.points[index]);
        drawRouteSegment(target, start, end, color, kind);
      }
      for (const point of route.points) {
        const pos = routePointPosition(point);
        target.beginPath();
        target.arc(pos.x, pos.y, point.symbolId ? 12 : 9, 0, Math.PI * 2);
        target.fill();
        target.lineWidth = 4;
        target.strokeStyle = color;
        target.stroke();
      }
      if (route.points.length > 1) {
        const labelKind = routeAutoKind(state, route);
        const labelIndex = Math.max(1, Math.floor(route.points.length / 2));
        const a = routePointPosition(route.points[labelIndex - 1]);
        const b = routePointPosition(route.points[labelIndex]);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        target.fillStyle = color;
        target.font = 'bold 22px Segoe UI, Arial';
        target.fillText(`${circuit?.name || 'Okruh'} - ${routeKindLabel(labelKind)}`, mid.x + 12, mid.y - 12);
      }
      target.restore();
    }
  }

  function drawRouteSegment(target, start, end, color, kind) {
    const isSupply = kind === 'supply';
    target.save();
    target.strokeStyle = color;
    target.lineWidth = isSupply ? 8 : 6;
    if (isSupply) target.setLineDash([18, 10]);
    target.beginPath();
    target.moveTo(start.x, start.y);
    target.lineTo(end.x, end.y);
    target.stroke();
    target.setLineDash([]);
    target.lineWidth = 2;
    target.strokeStyle = '#ffffff';
    target.beginPath();
    target.moveTo(start.x, start.y);
    target.lineTo(end.x, end.y);
    target.stroke();
    target.restore();
  }

  function drawScaleCalibration(target) {
    const first = state.scaleCalibration?.first;
    if (!first) return;
    target.save();
    target.strokeStyle = '#1f5fbf';
    target.fillStyle = '#ffffff';
    target.lineWidth = 4;
    target.setLineDash([10, 8]);
    target.beginPath();
    target.arc(first.x, first.y, 13, 0, Math.PI * 2);
    target.fill();
    target.stroke();
    target.restore();
  }

  function drawSymbols(target) {
    for (const symbol of state.symbols) {
      target.save();
      target.translate(symbol.x, symbol.y);
      target.rotate((symbol.rot || 0) * Math.PI / 180);
      target.scale(symbol.size || 1, symbol.size || 1);
      target.lineWidth = 4;
      target.strokeStyle = '#111827';
      target.fillStyle = '#ffffff';
      symbolRegistry.draw(target, symbol);
      target.restore();

      if (state.selected?.id === symbol.id) {
        const size = symbol.size || 1;
        target.save();
        target.strokeStyle = '#1f5fbf';
        target.lineWidth = 3;
        target.setLineDash([8, 5]);
        target.beginPath();
        target.arc(symbol.x, symbol.y, 32 * size, 0, Math.PI * 2);
        target.stroke();
        target.restore();
      }
    }
  }

  function drawConnectors(target) {
    for (const symbol of state.symbols) {
      const end = connectorPosition(symbol);
      const selected = state.selected?.kind === 'connector' && state.selected.id === symbol.id;
      target.save();
      target.strokeStyle = selected ? '#c2522f' : '#1f5fbf';
      target.fillStyle = '#ffffff';
      target.lineWidth = selected ? 5 : 4;
      target.beginPath();
      target.moveTo(symbol.x, symbol.y);
      target.lineTo(end.x, end.y);
      target.stroke();
      target.beginPath();
      target.arc(end.x, end.y, selected ? 12 : 10, 0, Math.PI * 2);
      target.fill();
      target.stroke();
      target.restore();
    }
  }

  function exportCanvas() {
    const out = document.createElement('canvas');
    out.width = state.planWidth;
    out.height = state.planHeight;
    const outCtx = out.getContext('2d');
    render(outCtx, { export: true });
    return out;
  }

  return {
    fitView,
    resizeCanvas,
    zoomAt,
    screenToPlan,
    connectorPosition,
    routePointPosition,
    selectedSymbol,
    render,
    exportCanvas
  };
}
