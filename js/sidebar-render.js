// Genera el sidebar

(() => {
  const root = document.body.dataset.root || '';
  const page = document.body.dataset.page || '';
  const COLORS = ['#06c167', '#3b92ea', '#d4568a', '#ff7a5c', '#8e6bd8', '#e0a800'];
  const COLOR_MAP = { '#06c167': '1', '#3b92ea': '2', '#d4568a': '3', '#ff7a5c': '4', '#8e6bd8': '5', '#e0a800': '6' };
  function getColorClass(color) { return COLOR_MAP[color] || '1'; }

    const link = (id, href, label, spacer = true, svg = '') => `
    <li>
      <a class="side-item leaf${id === page ? ' active' : ''}" href="${href}"${id === page ? ' aria-current="page"' : ''}>
        ${svg || (spacer ? '<span class="spacer"></span>' : `<img class="home-icon" src="${root}icons/ui/home.svg" alt="">`)}
        <span class="label">${label}</span>
      </a>
    </li>`;

  const chev = `<img class="chev" src="${root}icons/ui/chev-right.svg" alt="">`;
  const ico = p => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I_INV  = ico('<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>');
  const I_USER = ico('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>');
  const I_ASSET = ico('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 7h.01M11 7h.01"/>');
  const I_CATEGORY = ico('<path d="M20 12 12 20 3 11V4h7z"/><circle cx="7.5" cy="8" r="1"/>');
  const I_BRAND = ico('<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>');
  const I_IT = ico('<rect x="4" y="4" width="16" height="12" rx="1"/><path d="M2 20h20l-2-4H4l-2 4zM9 18h6"/>');
  const I_STATS = ico('<path d="M4 19V5M4 19h17"/><rect x="7" y="11" width="3" height="5" rx="1"/><rect x="13" y="7" width="3" height="9" rx="1"/><rect x="19" y="4" width="3" height="12" rx="1"/>');
  const I_TOOL = ico('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>');
  const I_SUPPLY = ico('<path d="M4 7h16l-1 13H5L4 7z"/><path d="M9 7V4h6v3M8 12h8M8 16h5"/>');
  const I_LOAN = ico('<path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="M18 7a7 7 0 0 1 1 9M6 17a7 7 0 0 1-1-9"/>');
  const I_PURCHASE = ico('<path d="M3 4h2l2.2 11h10.9l2-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>');
  const I_MOVEMENT = ico('<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 7v5l3 2"/>');
  const I_HISTORY = ico('<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>');
  const I_SHIELD = ico('<path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>');
  const I_CONTACTS = ico('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 5.8M18 15c2 .6 3 2.2 3 5"/>');

  document.getElementById('sidebar').innerHTML = `
    <a class="brand" href="${root}index.html">
      <img class="brand-logo" src="${root}icons/logo-icon.svg?v=3" alt="Logo">
      Inventario
    </a>

    <label class="search-box">
      <input type="search" id="side-search" placeholder="Search" autocomplete="off" aria-label="Buscar en el menú">
      <img src="${root}icons/ui/search-g.svg" alt="">
    </label>

    <nav class="tree" aria-label="Menú principal">
      <ul class="tree-root">
        ${link('it', `${root}index.html`, 'Inicio', true, I_IT)}
        ${link('estadisticas', `${root}pages/estadisticas.html`, 'Estadísticas', true, I_STATS)}

        <li class="node" data-id="productos">
          <div class="side-item" role="button" tabindex="0" aria-expanded="false">
            ${chev}
            <span class="label">Productos</span>
          </div>
          <ul class="children">
            ${link('purchases', `${root}pages/compras.html`, 'Compras', true, I_PURCHASE)}
            ${link('asset-loan', `${root}pages/prestamos.html`, 'Alquiler / Venta', true, I_LOAN)}
            ${link('assets', `${root}pages/activos.html`, 'Activos', true, I_ASSET)}
            ${link('consumables', `${root}pages/insumos.html`, 'Insumos', true, I_SUPPLY)}
            ${link('tools', `${root}pages/herramientas.html`, 'Herramientas', true, I_TOOL)}
          </ul>
        </li>

        <li class="node" data-id="catalogos">
          <div class="side-item" role="button" tabindex="0" aria-expanded="false">
            ${chev}
            <span class="label">Catálogos</span>
          </div>
          <ul class="children">
            ${link('categories', `${root}pages/categorias.html`, 'Categorías', true, I_CATEGORY)}
            ${link('brands', `${root}pages/marcas.html`, 'Marcas', true, I_BRAND)}
            ${link('clients', `${root}pages/contactos.html`, 'Clientes', true, I_CONTACTS)}
            ${link('suppliers', `${root}pages/proveedores.html`, 'Proveedores', true, I_PURCHASE)}
            ${link('funcionarios', `${root}pages/funcionarios.html`, 'Funcionarios', true, I_USER)}
          </ul>
        </li>

        ${link('movements', `${root}pages/movimientos.html`, 'Movimientos', true, I_MOVEMENT)}

        <li class="node" data-id="administracion">
          <div class="side-item" role="button" tabindex="0" aria-expanded="false">
            ${chev}
            <span class="label">Administración</span>
          </div>
          <ul class="children">
            ${link('accesos', `${root}pages/accesos.html`, 'Usuarios y roles', true, I_SHIELD)}
            ${link('history', `${root}pages/historial.html`, 'Historial de cambios', true, I_HISTORY)}
          </ul>
        </li>

      </ul>
      <p class="no-results" hidden>Sin resultados</p>
    </nav>

    <div class="profile">
      <span class="avatar"></span>
      <span class="profile-info">
        <span class="profile-name">Nombre de usuario</span>
        <span class="profile-role"></span>
      </span>
      <button type="button" class="profile-logout" title="Cerrar sesión" aria-label="Cerrar sesión">
        ${ico('<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>')}
      </button>
    </div>`;

  // Menú según los permisos del usuario (la API los vuelve a validar en cada petición).
  const PAGE_PERMISSION = {
    it: 'dashboard.ver', estadisticas: 'estadisticas.ver', assets: 'activos.ver',
    consumables: 'insumos.ver', tools: ['herramientas.ver', 'inventario.ver'], 'asset-loan': 'prestamos.ver',
    purchases: 'compras.ver', inventario: 'inventario.ver', categories: 'categorias.ver',
    brands: 'marcas.ver', clients: 'contactos.ver', suppliers: 'contactos.ver',
    funcionarios: 'funcionarios.ver', movements: 'movimientos.ver', history: 'historial.ver',
    accesos: 'accesos.ver',
  };
  let account = null;
  try { account = JSON.parse(sessionStorage.getItem('inventario.session')); } catch { account = null; }
  const sidebar = document.getElementById('sidebar');
  if (account && Array.isArray(account.permissions)) {
    Object.entries(PAGE_PERMISSION).forEach(([id, permission]) => {
      if ([].concat(permission).some(item => account.permissions.includes(item))) return;
      sidebar.querySelectorAll('a.side-item').forEach(anchor => {
        const href = anchor.getAttribute('href') || '';
        const target = {
          it: 'index.html', estadisticas: 'estadisticas.html', assets: 'activos.html', consumables: 'insumos.html',
          tools: 'herramientas.html', 'asset-loan': 'prestamos.html', purchases: 'compras.html', inventario: 'inventario.html',
          categories: 'categorias.html', brands: 'marcas.html', clients: 'contactos.html', suppliers: 'proveedores.html',
          funcionarios: 'funcionarios.html', movements: 'movimientos.html', history: 'historial.html', accesos: 'accesos.html',
        }[id];
        if (href.endsWith(`/${target}`) || href === target) anchor.closest('li')?.remove();
      });
    });
    // Un grupo sin enlaces visibles se oculta completo.
    sidebar.querySelectorAll('.node').forEach(node => {
      if (!node.querySelector('.children li')) node.remove();
    });
    sidebar.querySelector('.profile-name').textContent = account.name;
    sidebar.querySelector('.profile-role').textContent = account.role?.name || '';
    const avatar = sidebar.querySelector('.avatar');
    if (account.role?.color) {
      avatar.classList.remove('avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5', 'avatar-6');
      avatar.classList.add(`avatar-${getColorClass(account.role.color)}`);
    }
  }
  sidebar.querySelector('.profile-logout').addEventListener('click', () => {
    if (window.inventarioApi) window.inventarioApi.logout();
  });
})();