(function () {
  'use strict';

  window.PlanEditorSymbols.register('switch5', {
    label: 'Vyp. č.5',
    draw(target) {
      target.beginPath();
      target.arc(0, 0, 20, 0, Math.PI * 2);
      target.fill();
      target.stroke();
      target.beginPath();
      target.moveTo(-13, 10);
      target.lineTo(13, -10);
      target.moveTo(-8, -12);
      target.lineTo(8, 12);
      target.stroke();
      target.font = 'bold 14px Segoe UI, Arial';
      target.fillStyle = '#111827';
      target.textAlign = 'center';
      target.fillText('5', 0, 5);
    }
  });
})();
