  const pageId = document.body.dataset.page;
  // Herramientas e Inventario son una sola página con dos vistas: "Herramientas" (lista de equipos)
  // y "Por técnico" (qué herramientas tiene cada técnico). Cada vista conserva su lógica propia
  // y `page` indica cuál está activa ('tools' o 'inventario').
  const isToolsHub = pageId === 'tools' || pageId === 'inventario';
  const toolsViewKey = 'inventario-tools-view';
  const canSee = permission => !window.inventarioApi || window.inventarioApi.can(permission);
  const toolsViews = () => [
    canSee('herramientas.ver') && { id: 'tools', label: 'Herramientas' },
    canSee('inventario.ver') && { id: 'inventario', label: 'Por técnico' },
  ].filter(Boolean);
  function initialToolsView() {
    const available = toolsViews().map(view => view.id);
    let wanted = new URLSearchParams(location.search).get('vista') === 'tecnicos' || pageId === 'inventario' ? 'inventario' : null;
    if (!wanted) { try { wanted = localStorage.getItem(toolsViewKey); } catch { wanted = null; } }
    return available.includes(wanted) ? wanted : (available[0] || 'tools');
  }
  let page = isToolsHub ? initialToolsView() : (pageId === 'clients' || pageId === 'suppliers' ? 'contacts' : pageId);
  const root = document.getElementById('module-app');
  if (!root) return;
  const viewModeKey = `inventario-view-mode-${pageId}`;
  let viewMode = localStorage.getItem(viewModeKey) === 'cards' ? 'cards' : 'table';
  const cardColumnsKey = `inventario-card-columns-${pageId}`;
  const savedCardColumns = Number(localStorage.getItem(cardColumnsKey));
  let cardColumns = [1, 2, 3, 4, 5].includes(savedCardColumns) ? savedCardColumns : 2;
  const pageSizeKey = `inventario-page-size-${pageId}`;
  const savedPageSize = Number(localStorage.getItem(pageSizeKey));
  let pageSize = [10, 20, 50, 100].includes(savedPageSize) ? savedPageSize : 10;
  let currentPage = 1;

  const TODAY = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const TITLES = {
    assets: 'Activos',
    categories: 'Categorías',
    brands: 'Marcas',
    consumables: 'Insumos',
    tools: 'Herramientas',
    purchases: 'Compras',
    movements: 'Movimientos',
    history: 'Historial de cambios',
    contacts: document.body.dataset.contactType === 'Proveedor' ? 'Proveedores' : 'Clientes',
    funcionarios: 'Funcionarios',
    inventario: 'Inventario',
    'asset-loan': 'Alquiler / Venta',
  };
  const STATUSES = ['Disponible', 'Asignado', 'Alquilado', 'Prestado', 'En reparación', 'Vendido'];
  const TOOL_STATUSES = ['Disponible', 'En uso', 'En reparación', 'Dañada', 'Baja'];
  const EMPTY = { assets: [], categories: [], brands: [], supplies: [], purchases: [], movements: [], contacts: [], loans: [], users: [], tools: [], changes: [], toolAudits: [] };
  const emptyData = () => JSON.parse(JSON.stringify(EMPTY));
  // Las ventanas se crean a partir de estas plantillas del HTML (ver "Ventanas flotantes" más abajo).
  const formTemplate = document.getElementById('form-modal');
  const detailTemplate = document.getElementById('detail-modal');
  formTemplate.remove();
  detailTemplate.remove();
  let formModal = null;   // contexto del formulario activo (lo fija useForm)
  let form = null;
  let fields = null;
  const notice = document.createElement('p');
  notice.className = 'module-notice module-toast';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.setAttribute('aria-atomic', 'true');

  let data = emptyData();
  let apiReady = false;
  let loadFailed = false;
  let searchText = '';
  let filterBuilderOpen = false;
  let noticeTimer = null;
  const filterTree = { id: makeId('filter-group'), type: 'group', logic: 'all', children: [] };
  const contactType = document.body.dataset.contactType || '';
  if (filterFields()[0]) filterTree.children.push(createFilterCondition());

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async function reloadData() {
    // El historial solo necesita su propia lista; el resto de módulos usa el paquete completo.
    data = Object.assign(emptyData(), await window.inventarioApi.get(page === 'history' ? 'changes' : 'all'));
    apiReady = true;
    loadFailed = false;
    refreshDetails();
  }

  const CHANGE_BADGES = { 'Creó': 'st-use', 'Modificó': 'st-store', 'Eliminó': 'st-repair' };
  const CHANGE_LABELS = {
    id: 'ID', code: 'Código', name: 'Nombre', description: 'Descripción', brand: 'Marca', serial: 'Serial',
    quantity: 'Cantidad', status: 'Estado', responsibleId: 'Responsable (ID)', category: 'Categoría', model: 'Modelo',
    purchaseDate: 'Fecha de compra', cost: 'Costo', assignedTo: 'Asignado a', client: 'Cliente', notes: 'Observaciones',
    note: 'Observaciones', unit: 'Unidad', stock: 'Stock', entries: 'Entradas', exits: 'Salidas', minimum: 'Stock mínimo', unitCost: 'Costo unitario',
    person: 'Persona', date: 'Fecha', dueDate: 'Fecha de devolución', type: 'Tipo', assetId: 'Activo (ID)',
    supplyId: 'Insumo (ID)', supplier: 'Proveedor', invoice: 'Factura', total: 'Total', nit: 'NIT / documento',
    email: 'Correo', phone: 'Teléfono', address: 'Dirección', cargo: 'Cargo', area: 'Área',
  };

