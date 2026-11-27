  // Relaciona la etiqueta de un campo del formulario con el icono que ya usa el detalle.
  function formIconKey(label) {
    const value = String(label || '').toLocaleLowerCase();
    const rules = [
      [/^nombre (del|de la) (activo|insumo|producto|herramienta|marca|categor)/, 'Nombre'],
      [/marca/, 'Marca'], [/modelo/, 'Modelo'], [/serie|serial/, 'Número de serie'],
      [/código|codigo|referencia/, 'Serial'], [/categor|tipo/, 'Tipo'], [/ubicaci/, 'Ubicación'],
      [/descrip/, 'Descripción'], [/observ|nota|motivo/, 'Observaciones'],
      [/garant/, 'Fin de garantía'], [/fecha|vence|entrega|devoluci/, 'Fecha de compra'],
      [/proveedor/, 'Proveedor'], [/factura/, 'Factura'], [/iva/, 'IVA'],
      [/costo|precio|valor|total/, 'Costo'], [/unidad/, 'Unidad de medida'],
      [/cantidad|stock|mínimo|minimo/, 'Cantidad'], [/correo|email/, 'Correo'],
      [/tel[eé]fono|celular/, 'Teléfono'], [/direcci/, 'Dirección'], [/cargo/, 'Cargo'],
      [/documento|nit|cédula|cedula/, 'Documento'], [/área|area/, 'Área'],
      [/cliente/, 'Cliente'], [/responsable|funcionario|técnico|tecnico|asignad|nombre/, 'Responsable'],
      [/estado/, 'Último movimiento'],
    ];
    const match = rules.find(([pattern]) => pattern.test(value));
    return match ? match[1] : label;
  }

  function appendField(name, label, type = 'text', required = false, value = '', options = {}) {
    const wrapper = document.createElement('label');
    wrapper.className = `f${options.full ? ' full' : ''}`;
    const labelText = document.createElement('span');
    labelText.className = 'f-label';
    labelText.append(detailIcon(formIconKey(label)), text('span', label + (required ? ' *' : '')));
    wrapper.append(labelText);
    let control;
    if (type === 'select') {
      control = document.createElement('select');
      const entries = options.options || [];
      if (options.placeholder !== false) {
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = options.placeholder || 'Seleccione…';
        control.append(empty);
      }
      entries.forEach(entry => {
        const option = document.createElement('option');
        option.value = typeof entry === 'string' ? entry : entry.value;
        option.textContent = typeof entry === 'string' ? entry : entry.label;
        control.append(option);
      });
    } else if (type === 'textarea') {
      control = document.createElement('textarea');
      control.rows = options.rows || 3;
    } else {
      control = document.createElement('input');
      control.type = type;
      if (type === 'number') {
        control.min = options.min == null ? '0' : String(options.min);
        control.step = options.step || 'any';
      }
      if (options.list) {
        const listId = `options-${name}-${++listCounter}`;   // único: puede haber varios formularios abiertos
        const list = document.createElement('datalist');
        list.id = listId;
        options.list.forEach(value => list.append(text('option', value)));
        control.setAttribute('list', listId);
        wrapper.append(list);
      }
    }
    control.name = name;
    control.required = required;
    if (value !== '' && value != null) control.value = value;
    if (options.readOnly) control.readOnly = true;
    wrapper.append(control);
    (options.container || fields).append(wrapper);
    if (options.kindField) wrapper.dataset.kindField = options.kindField;
    return control;
  }

  function createFormSection(title) {
    const section = document.createElement('section');
    section.className = 'asset-form-section';
    const heading = document.createElement('div');
    heading.className = 'asset-form-section-heading';
    heading.append(text('h3', title));
    const content = document.createElement('div');
    content.className = 'asset-form-section-fields';
    section.append(heading, content);
    fields.append(section);
    return content;
  }

