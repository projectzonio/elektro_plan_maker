(function () {
  'use strict';

  function drawSocket(target, label) {
    target.beginPath();
    target.arc(0, 0, 22, 0, Math.PI * 2);
    target.fill();
    target.stroke();
    target.beginPath();
    target.moveTo(-8, -9);
    target.lineTo(-8, 9);
    target.moveTo(0, -9);
    target.lineTo(0, 9);
    target.moveTo(8, -9);
    target.lineTo(8, 9);
    target.stroke();
    target.font = 'bold 12px Segoe UI, Arial';
    target.fillStyle = '#111827';
    target.textAlign = 'center';
    target.fillText(label, 0, 39);
  }

  window.PlanEditorSymbols.register('socket3', {
    label: 'Zásuvka 3f',
    draw(target) {
      drawSocket(target, '3F');
    }
  });
})();
