(function () {
  'use strict';

  window.PlanEditorSymbols.register('switch6', {
    label: 'Vyp. č.6',
    draw(target) {
      target.beginPath();
      target.arc(0, 0, 20, 0, Math.PI * 2);
      target.fill();
      target.stroke();
      target.beginPath();
      target.moveTo(-12, 10);
      target.lineTo(12, -10);
      target.moveTo(-13, -2);
      target.lineTo(13, -2);
      target.stroke();
      target.font = 'bold 14px Segoe UI, Arial';
      target.fillStyle = '#111827';
      target.textAlign = 'center';
      target.fillText('6', 0, 15);
    }
  });
})();
