(function () {
  'use strict';

  window.PlanEditorSymbols.register('switchboard', {
    label: 'Rozvaděč',
    draw(target) {
      target.beginPath();
      target.rect(-24, -26, 48, 52);
      target.fill();
      target.stroke();

      target.beginPath();
      target.moveTo(-14, -16);
      target.lineTo(14, -16);
      target.moveTo(-14, -4);
      target.lineTo(14, -4);
      target.moveTo(-14, 8);
      target.lineTo(14, 8);
      target.stroke();

      target.beginPath();
      target.arc(0, 18, 4, 0, Math.PI * 2);
      target.fillStyle = '#111827';
      target.fill();

      target.font = 'bold 11px Segoe UI, Arial';
      target.textAlign = 'center';
      target.fillText('R', 0, -34);
    }
  });
})();
