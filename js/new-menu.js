// Menús de los botones del encabezado (lista y Nuevo)

(() => {
  const buttons = ['btn-list', 'btn-new'].map(id => document.getElementById(id)).filter(Boolean);
  if (!buttons.length) return;

  const menuOf = btn => btn.nextElementSibling;

  const closeAll = () => buttons.forEach(b => {
    menuOf(b).hidden = true;
    b.setAttribute('aria-expanded', 'false');
  });

  buttons.forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const wasClosed = menuOf(btn).hidden;
    closeAll();
    if (wasClosed) {
      menuOf(btn).hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }
  }));

  document.addEventListener('click', e => {
    const link = e.target.closest('.new-menu a');
    if (link && link.getAttribute('href') === '#') e.preventDefault();
    closeAll();
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
})();