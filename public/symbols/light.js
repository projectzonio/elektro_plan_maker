(function () {
  'use strict';

  window.PlanEditorSymbols.register('light', {
    label: 'Světlo',
    draw(target) {
      target.beginPath();
      target.arc(0, 0, 23, 0, Math.PI * 2);
      target.fill();
      target.stroke();
      target.beginPath();
      target.moveTo(-15, -15);
      target.lineTo(15, 15);
      target.moveTo(15, -15);
      target.lineTo(-15, 15);
      target.stroke();
    }
  });
})();
