import { applyProjectData, createInitialState, loadStoredProject } from './01-state.js';
import { createRenderer } from './03-renderer.js';
import { createHitTest } from './04-hit-test.js';
import { createEditorActions } from './05-interactions.js';
import { createUi } from './07-ui-bindings.js';

export function initPlanEditor() {
  const canvas = document.getElementById('planCanvas');
  const ctx = canvas.getContext('2d');
  const symbolRegistry = window.PlanEditorSymbols;
  const state = createInitialState();
  const renderer = createRenderer({ canvas, ctx, state, symbolRegistry });
  const ui = createUi({ state, renderer });
  const hitTesting = createHitTest({ state, renderer });
  const actions = createEditorActions({ state, renderer, hitTesting, symbolRegistry, ui });

  const storedProject = loadStoredProject();
  if (storedProject) {
    applyProjectData(state, storedProject);
  }

  ui.updateCircuits();
  ui.updateSymbolSizeControl();
  ui.updateRouteControls();
  ui.updateMaterial();
  ui.bind(actions);
  actions.bindCanvas(canvas);
  renderer.resizeCanvas();
  renderer.render();
  ui.setStatus('Vyber PDF přes Import PDF. Projekt JSON můžeš načíst kdykoliv.');
}
