// Resumen de inventario en vivo desde la API.
(() => {
  const root = document.getElementById('dash');
  const notice = document.getElementById('dashboard-notice');
  if (!root || !notice || !window.inventarioApi) return;

  const makeCell = (tag, value, className = '') => {
    const cell = document.createElement(tag);
    if (className) cell.className = className;
    cell.textContent = String(value);
    return cell;
  };

  function metric(label, value) {
    const card = document.createElement('article');
    card.className = 'wd db-stat';
    const header = document.createElement('header');
    header.className = 'wd-head';
    header.append(makeCell('h2', label));
    const body = document.createElement('div');
    body.className = 'wd-body db-stat-body';
    body.append(makeCell('p', value, 'db-stat-value'));
    card.append(header, body);
    return card;
  }

  function categoryTable(categories) {
    const card = document.createElement('article');
    card.className = 'wd db-breakdown';
    const header = document.createElement('header');
    header.className = 'wd-head';
    header.append(makeCell('h2', 'Activos por categoría'));
    const body = document.createElement('div');
    body.className = 'wd-body';
    const wrap = document.createElement('div');
    wrap.className = 'tbl-wrap';
    const table = document.createElement('table');
    table.className = 'tbl';
    const thead = document.createElement('thead');
    const heading = document.createElement('tr');
    ['Categoría', 'Total', 'En uso', 'Disponibles', 'En reparación', 'Otros'].forEach(text => heading.append(makeCell('th', text)));
    thead.append(heading);
    const tbody = document.createElement('tbody');
    if (!categories.length) {
      const row = document.createElement('tr');
      const empty = makeCell('td', 'No hay activos registrados.');
      empty.colSpan = 6;
      row.append(empty);
      tbody.append(row);
    } else {
      categories.forEach(category => {
        const row = document.createElement('tr');
        [
          category.name,
          category.total,
          category.inUse,
          category.inStore,
          category.inRepair,
          category.others,
        ].forEach((value, index) => row.append(makeCell('td', value, index ? 'c' : '')));
        tbody.append(row);
      });
    }
    table.append(thead, tbody);
    wrap.append(table);
    body.append(wrap);
    card.append(header, body);
    return card;
  }

  // Skeleton: 4 tarjetas de métrica + tabla mientras llega el resumen.
  root.replaceChildren(
    ...[0, 1, 2, 3].map(() => {
      const card = document.createElement('article');
      card.className = 'wd db-stat';
      const body = document.createElement('div');
      body.className = 'wd-body db-stat-body';
      body.append(window.inventarioSkeleton.block('48px'));
      card.append(body);
      return card;
    }),
    window.inventarioSkeleton.table(5, 5),
  );
  window.inventarioApi.get('dashboard').then(result => {
    if (!Array.isArray(result.categories)) throw new Error('La API devolvió un resumen de inventario inválido.');
    const categories = result.categories;
    const totals = categories.reduce((sum, category) => ({
      total: sum.total + Number(category.total || 0),
      inUse: sum.inUse + Number(category.inUse || 0),
      inStore: sum.inStore + Number(category.inStore || 0),
      inRepair: sum.inRepair + Number(category.inRepair || 0),
    }), { total: 0, inUse: 0, inStore: 0, inRepair: 0 });
    root.replaceChildren(
      metric('Activos registrados', totals.total),
      metric('En uso', totals.inUse),
      metric('Disponibles', totals.inStore),
      metric('En reparación', totals.inRepair),
      categoryTable(categories),
    );
    notice.textContent = 'Datos actualizados desde la base de datos.';
  }).catch(error => {
    root.replaceChildren();
    notice.textContent = error.message;
    notice.classList.add('error');
  });
})();