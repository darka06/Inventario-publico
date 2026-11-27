//  Sidebar  

(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const layout  = $('.layout');
  const menuBtn = $('.menu-btn');
  const tree    = $('.tree');
  const search  = $('#side-search');
  const expandB = $('#expand-all');
  const empty   = $('.no-results');
  const mobileMQ = matchMedia('(max-width: 800px)');

  // localStorage puede fallar (modo privado, etc.), así que va protegido.

  const store = {
    get(k)    { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  /*  1. Botón ☰: ocultar / mostrar el menú  */

  function toggleSidebar() {
    if (mobileMQ.matches) layout.classList.toggle('mobile-open');   // en móvil no hay hover, se queda el botón
  }

  menuBtn.addEventListener('click', toggleSidebar);
  menuBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSidebar(); }
  });

  $('.backdrop').addEventListener('click', () => layout.classList.remove('mobile-open'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') layout.classList.remove('mobile-open');
  });

  /*  2. Abrir / cerrar ramas del árbol  */

  const nodes = () => $$('.node', tree);

  function setOpen(node, open) {
    node.classList.toggle('open', open);
    const head = $(':scope > .side-item', node);
    if (head) head.setAttribute('aria-expanded', String(open));
  }

  function saveOpen() {
    const ids = nodes().filter(n => n.classList.contains('open')).map(n => n.dataset.id);
    store.set('sidebar-open', JSON.stringify(ids));
  }

  function syncExpandLabel() {
    if (!expandB) return;
    const all = nodes().every(n => n.classList.contains('open'));
    expandB.textContent = all ? 'Collapse' : 'Expand';
  }

  // restaurar el estado guardado

  try {
    const saved = JSON.parse(store.get('sidebar-open') || 'null');
    if (Array.isArray(saved)) nodes().forEach(n => setOpen(n, saved.includes(n.dataset.id)));
  } catch { /* JSON inválido: se ignora */ }
  nodes().forEach(node => {
    if (node.querySelector('a.side-item.active')) setOpen(node, true);
  });
  syncExpandLabel();

  function toggleNode(head) {
    const node = head.parentElement;
    setOpen(node, !node.classList.contains('open'));
    saveOpen();
    syncExpandLabel();
  }

  tree.addEventListener('click', e => {
    if (e.target.closest('#expand-all')) return;     // tiene su propio manejador
    const head = e.target.closest('.node > .side-item');
    if (head) toggleNode(head);
  });
  tree.addEventListener('keydown', e => {
    const head = e.target.closest('.node > .side-item');
    if (head && e.target === head && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggleNode(head);
    }
  });

  // "Expand" / "Collapse" abre o cierra todas las ramas

  if (expandB) {
    expandB.addEventListener('click', e => {
      e.stopPropagation();
      const open = expandB.textContent === 'Expand';
      nodes().forEach(n => setOpen(n, open));
      saveOpen();
      syncExpandLabel();
    });
  }

  /*  3. Elemento activo  */

  tree.addEventListener('click', e => {
    const leaf = e.target.closest('a.side-item.leaf');
    if (!leaf) return;
    if (leaf.getAttribute('href') !== '#') return;   // enlace real: navega a la otra página
    e.preventDefault();                             
    $$('.side-item.active', tree).forEach(a => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
    leaf.classList.add('active');
    leaf.setAttribute('aria-current', 'page');
    if (mobileMQ.matches) layout.classList.remove('mobile-open');
  });

  /*  4. Buscador que filtra el menú  */

  function filter(q) {
    let visibleCount = 0;

    // devuelve true si el <li> (o algo dentro de él) debe mostrarse

    function visit(li, parentMatched) {
      if (li.classList.contains('side-sep')) { li.hidden = !!q; return false; }

      const label = ($(':scope > .side-item .label', li)?.textContent || '').toLowerCase();
      const selfMatch = !!q && label.includes(q);
      const kids = $$(':scope > .children > li', li);
      let childMatch = false;
      kids.forEach(k => { if (visit(k, parentMatched || selfMatch)) childMatch = true; });

      const show = !q || selfMatch || parentMatched || childMatch;
      li.hidden = !show;
      li.classList.toggle('forced-open', !!q && childMatch);   // abre ramas con coincidencias
      if (show && !kids.length) visibleCount++;
      return show;
    }

    $$(':scope > .tree-root > li, :scope > ul > li', tree).forEach(li => visit(li, false));
    empty.hidden = !q || visibleCount > 0;
  }

  search.addEventListener('input', () => filter(search.value.trim().toLowerCase()));
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') { search.value = ''; filter(''); }
  });

    /*  5. Mantener el sidebar abierto al cambiar de página  */

  const sidebar = $('.sidebar');

  sidebar.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (a && a.getAttribute('href') !== '#') store.set('sidebar-keep-open', '1');
  });

  if (store.get('sidebar-keep-open') === '1') {
    store.set('sidebar-keep-open', '0');
    sidebar.classList.add('keep-open');

    const close = () => {
      sidebar.classList.remove('keep-open');
      document.removeEventListener('mousemove', onMove);
    };
    const onMove = e => { if (!sidebar.contains(e.target)) close(); };

    sidebar.addEventListener('mouseleave', close, { once: true });
    document.addEventListener('mousemove', onMove);
  }

})();