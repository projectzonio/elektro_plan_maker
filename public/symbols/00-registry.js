(function () {
  'use strict';

  const registry = {
    items: {},
    register(type, definition) {
      this.items[type] = definition;
    },
    get(type) {
      return this.items[type] || null;
    },
    draw(target, symbol) {
      const item = this.get(symbol.type);
      if (!item || typeof item.draw !== 'function') return false;
      item.draw(target, symbol);
      return true;
    },
    label(type) {
      return this.get(type)?.label || type;
    }
  };

  window.PlanEditorSymbols = registry;
})();
