// Ordena del más nuevo al más viejo. Usa la fecha cuando existe y, en empate o sin fecha,
  // el número de id (los ids autoincrementales más altos son los registros más recientes).
  function newestFirst(items, dateOf = () => '') {
    const idNumber = item => {
      const match = String(item && item.id != null ? item.id : '').match(/(\d+)\D*$/);
      return match ? Number(match[1]) : 0;
    };
    return [...items].sort((a, b) => {
      const dateA = String(dateOf(a) || '');
      const dateB = String(dateOf(b) || '');
      return dateB.localeCompare(dateA) || idNumber(b) - idNumber(a);
    });
  }

  function renderTable() {
    if (page === 'assets') {
      const fields = filterFields();
      const assets = newestFirst(data.assets, asset => asset.createdAt || asset.registeredAt || asset.purchaseDate).filter(asset => includesSearch(asset.code, asset.name, asset.category, asset.status, asset.brand, asset.model, asset.serial, asset.assignedTo, asset.client)
        && filterGroupMatches(filterTree, asset, fields));
      return makeTable(['Código', 'Activo', 'Categoría', 'Marca', 'Estado', 'Asignado a', 'Compra'], assets.map(asset => row([
        asset.code, asset.name, asset.category, asset.brand, badge(asset.status), asset.assignedTo || asset.client, money(asset.cost),
      ], asset.id)), 'No hay activos para mostrar. Registra el primero con “Nuevo activo”.');
    }
    if (page === 'categories') {
      const fields = filterFields();
      const categories = newestFirst(data.categories).filter(category => includesSearch(category.name, category.assetCount)
        && filterGroupMatches(filterTree, category, fields));
      return makeTable(['Categoría', 'Activos asociados'], categories.map(category => {
        return row([category.name, category.assetCount], category.id, 'category-detail');
      }), 'No hay categorías registradas. Crea la primera con “Nueva categoría”.');
    }
    if (page === 'brands') {
      const fields = filterFields();
      const brands = newestFirst(getBrandRecords()).filter(brand => includesSearch(brand.name, brand.assetCount, brand.supplyCount)
        && filterGroupMatches(filterTree, brand, fields));
      return makeTable(['Marca', 'Activos asociados', 'Insumos asociados', 'Total de productos'], brands.map(brand => {
        return row([brand.name, brand.assetCount, brand.supplyCount, brand.assetCount + brand.supplyCount], brand.id, 'brand-detail');
      }), 'No hay marcas registradas. Las marcas aparecen al asignarlas a un activo o insumo.');
    }
    if (page === 'consumables') {
      const fields = filterFields();
      const supplies = newestFirst(data.supplies).filter(supply => includesSearch(supply.code, supply.name, supply.brand, supply.unit, supply.notes)
        && filterGroupMatches(filterTree, supply, fields));
      return makeTable(['Código', 'Insumo', 'Marca', 'Entradas', 'Salidas', 'Stock', 'Mínimo', 'Unidad', 'Costo unitario', 'Valor en stock'], supplies.map(supply => {
        const stockCell = text('span', supply.stock);
        if (Number(supply.stock || 0) <= Number(supply.minimum || 0)) stockCell.className = 'stock-low';
        return row([
          supply.code,
          supply.name,
          supply.brand,
          supply.entries,
          supply.exits,
          stockCell,
          supply.minimum,
          supply.unit,
          money(supply.unitCost),
          money(Number(supply.stock || 0) * Number(supply.unitCost || 0)),
        ], supply.id, 'supply-detail');
      }), 'No hay insumos. Crea un insumo o registra una compra para iniciar el stock.');
    }
    if (page === 'tools') {
      const fields = filterFields();
      const tools = newestFirst(data.tools).filter(tool => includesSearch(tool.name, tool.description, tool.brand, tool.serial, tool.status, tool.responsible)
        && filterGroupMatches(filterTree, tool, fields));
      return makeTable(['Herramienta', 'Descripción', 'Marca', 'Serial', 'Cantidad', 'Precio de compra', 'Estado', 'Responsable'], tools.map(tool => row([
        tool.name, tool.description, tool.brand, tool.serial, tool.quantity, money(tool.cost), badge(tool.status), tool.responsible,
      ], tool.id, 'tool-detail')), 'Aún no hay herramientas registradas. Crea la primera con “Nueva herramienta”.');
    }
    if (page === 'purchases') {
      const fields = filterFields();
      const purchases = newestFirst(data.purchases, purchase => purchase.date).filter(purchase => includesSearch(purchase.type, purchase.code, purchase.description, purchase.supplier, purchase.invoice)
        && filterGroupMatches(filterTree, purchase, fields));
      return makeTable(['Fecha', 'Tipo', 'Código', 'Descripción', 'Cantidad', 'Proveedor', 'Factura', 'Total'], purchases.map(purchase => row([
        purchase.date, purchase.type, purchase.code, purchase.description, `${purchase.quantity} ${purchase.unit || ''}`.trim(), purchase.supplier, purchase.invoice, money(purchase.total),
      ], purchase.id, 'purchase-detail')), 'Aún no hay compras registradas.');
    }
    if (page === 'movements') {
      const fields = filterFields();
      const movements = newestFirst(data.movements, movement => movement.date).filter(movement => includesSearch(movement.date, movement.kind, movement.action, movement.code, movement.description, movement.person, movement.destination, movement.note)
        && filterGroupMatches(filterTree, movement, fields));
      return makeTable(['Fecha', 'Tipo', 'Movimiento', 'Código / artículo', 'Cantidad', 'Responsable', 'Destino / origen', 'Observaciones'], movements.map(movement => row([
        movement.date, movement.kind, movement.action, `${movement.code || ''} ${movement.description || ''}`.trim(),
        movement.quantity == null ? '—' : movement.quantity, movement.person, movement.destination, movement.note,
      ], movement.id, 'movement-detail')), 'No hay movimientos registrados.');
    }
    if (page === 'contacts') {
      const fields = filterFields();
      const contacts = newestFirst(data.contacts).filter(contact => (!contactType || contact.type === contactType)
        && includesSearch(contact.name, contact.nit, contact.email, contact.phone)
        && filterGroupMatches(filterTree, contact, fields));
      const emptyMessage = contactType === 'Proveedor' ? 'Aún no hay proveedores registrados.' : 'Aún no hay clientes registrados.';
      return makeTable(['Razón social / nombre', 'NIT / documento', 'Correo', 'Teléfono', 'Notas'], contacts.map(contact => row([
        contact.name, contact.nit, contact.email, contact.phone, contact.notes,
      ], contact.id, 'contact-detail')), emptyMessage);
    }
    if (page === 'funcionarios') {
      const fields = filterFields();
      const users = newestFirst(data.users).filter(user => includesSearch(user.nombre, user.cargo, user.documento, user.area, user.correo, user.telefono, user.estado)
        && filterGroupMatches(filterTree, user, fields));
      return makeTable(['Nombre', 'Cargo', 'Documento', 'Área', 'Correo', 'Teléfono', 'Estado'], users.map(user => row([
        user.nombre, user.cargo, user.documento, user.area, user.correo, user.telefono, user.estado,
      ], user.id, 'user-detail')), 'Aún no hay funcionarios registrados. Crea el primero con “Nuevo funcionario”.');
    }
    if (page === 'history') {
      const fields = filterFields();
      const changes = newestFirst(data.changes, change => change.date).filter(change => includesSearch(change.action, change.module, change.operation, change.record, change.user, change.justification, deviceName(change.device), formatChangeDate(change.date))
        && filterGroupMatches(filterTree, change, fields));
      const shortReason = value => (value && value.length > 70 ? `${value.slice(0, 69)}…` : value || '—');
      return makeTable(['Fecha y hora', 'Acción', 'Módulo', 'Operación', 'Registro', 'Equipo', 'Usuario', 'Motivo'], changes.map(change => row([
        formatChangeDate(change.date), changeBadge(change.action), change.module, change.operation, change.record, deviceName(change.device), change.user, shortReason(change.justification),
      ], change.id, 'change-detail')), 'Aún no hay cambios registrados. Aparecerán aquí cuando alguien cree, modifique o elimine datos.');
    }
    if (page === 'inventario') {
      const fields = filterFields();
      const technicians = newestFirst(getTechnicians()).filter(tech => includesSearch(tech.nombre, tech.cargo, tech.estado)
        && filterGroupMatches(filterTree, tech, fields));
      return makeTable(['Técnico', 'Cargo', 'Herramientas asignadas', 'En uso', 'En reparación', 'Estado', 'Última auditoría'], technicians.map(tech => row([
        tech.nombre, tech.cargo || 'Técnico', tech.equipmentCount, tech.inUseCount, tech.repairCount, tech.estado, lastAuditCell(tech.lastAudit),
      ], tech.id, 'tech-detail')), 'No hay técnicos registrados. Asigna el área TECNICA a un funcionario para verlo aquí.');
    }
    if (page === 'asset-loan') {
      const loanStatus = loan => {
        if (loan.type === 'Venta') return 'Vendido';
        const assets = (loan.items || [loan]).filter(item => !item.supplyOnly);
        return assets.length ? assets.some(item => !item.returnedAt) ? 'Vigente' : 'Devuelto' : 'Consumido';
      };
      const activeAssetLoans = activeLoans();
      const fields = filterFields();
      const groups = new Map();
      [
        ...data.loans,
        ...activeAssetLoans.filter(loan => loan.assetOnly),
      ].forEach(item => {
        const key = item.operationId ? `operation:${item.operationId}` : `item:${item.id}`;
        if (!groups.has(key)) groups.set(key, { ...item, items: [] });
        groups.get(key).items.push(item);
      });
      const loans = newestFirst([...groups.values()], loan => loan.date).filter(loan => includesSearch(loanStatus(loan), loan.type,
        ...loan.items.flatMap(item => [item.code, item.assetName, item.quantity, item.unit]), loan.person, loan.client, loan.date, loan.dueDate)
        && filterGroupMatches(filterTree, loan, fields));
      return makeTable(['Estado', 'Tipo', 'Activo / insumo', 'Responsable', 'Cliente', 'Entrega', 'Devolución prevista'], loans.map(loan => {
        const status = loanStatus(loan);
        const itemName = item => `${item.code} · ${item.assetName}${item.supplyOnly ? ` (${formatQuantity(item.quantity)} ${item.unit || ''})` : ''}`;
        const name = loan.items.length > 1 ? `${loan.items.length} artículos · ${itemName(loan.items[0])} + ${loan.items.length - 1} más` : itemName(loan.items[0]);
        return row([badge(status), loan.type, name, loan.person, loan.client, loan.date, loan.dueDate], loan.id, 'loan-detail');
      }), 'No hay alquileres ni ventas. Solo se ofrecen activos disponibles.');
    }
    return makeTable([], [], '');
  }
