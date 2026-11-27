// Panel de Estadísticas - Módulo 7: Tooltip

/*  Tooltip  */

const tip = document.createElement('div');
tip.className = 'tip tip-pos';
tip.hidden = true;
document.body.appendChild(tip);

document.addEventListener('mousemove', e => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip;
  tip.style.setProperty('--tip-color', t.dataset.c || '#ddd');
  tip.hidden = false;
  tip.style.setProperty('--tip-x', e.clientX + 'px');
  tip.style.setProperty('--tip-y', e.clientY + 'px');
});
