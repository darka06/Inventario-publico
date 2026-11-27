// options.technician: alta desde "Por técnico" (título propio y área TECNICA precargada).
  function editUser(id = null, options = {}) {
    const existing = data.users.find(user => user.id === id);
    const asTechnician = !existing && options.technician === true;
    openForm(existing ? 'Editar funcionario' : (asTechnician ? 'Nuevo técnico' : 'Nuevo funcionario'), () => {
      const identityFields = createFormSection('Datos del funcionario');
      appendField('nombre', 'Nombre completo', 'text', true, existing && existing.nombre, { container: identityFields });
      appendField('cargo', 'Cargo', 'text', false, existing && existing.cargo, { container: identityFields });
      appendField('documento', 'Documento de identidad', 'text', false, existing && existing.documento, { container: identityFields });
      appendField('correo', 'Correo', 'email', false, existing && existing.correo, { container: identityFields });
      appendField('telefono', 'Teléfono', 'tel', false, existing && existing.telefono, { container: identityFields });
      appendField('area', 'Área / Departamento', 'text', false, existing ? existing.area : (asTechnician ? 'TECNICA' : ''), { container: identityFields, list: distinctFilterOptions(data.users, 'area') });
      appendField('estado', 'Estado', 'select', true, existing ? existing.estado : 'Activo', { options: ['Activo', 'Inactivo'], placeholder: false, container: identityFields });

      const notesFields = createFormSection('Notas');
      appendField('notas', 'Observaciones adicionales', 'textarea', false, existing && existing.notas, { full: true, rows: 2, container: notesFields });

      const foot = form.querySelector('.modal-foot');
      foot.querySelector('[data-delete-user]')?.remove();
      if (existing && window.inventarioApi.can('funcionarios.eliminar')) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-danger';
        remove.dataset.deleteUser = '';
        remove.textContent = 'Eliminar';
        remove.addEventListener('click', () => deleteUser(existing.id));
        foot.prepend(remove);
      }
    }, async values => {
      await window.inventarioApi.post(existing ? 'user.update' : 'user.create', { ...(existing ? { id: existing.id } : {}), ...values });
      await reloadData();
      closeForm();
      renderShell();
      showNotice(existing ? 'Funcionario actualizado.' : (asTechnician ? 'Técnico creado.' : 'Funcionario creado.'));
    });
  }

  function editTool(id = null) {
    const existing = data.tools.find(tool => tool.id === id);
    openForm(existing ? 'Editar herramienta' : 'Nueva herramienta', () => {
      formModal.querySelector('.modal-box').classList.add('modal-compact');
      const section = createFormSection('Datos de la herramienta');
      const name = appendField('name', 'Nombre', 'text', true, existing && existing.name, { full: true, container: section });
      name.maxLength = 180;
      const brand = appendField('brand', 'Marca', 'text', false, existing && existing.brand, {
        list: getBrandRecords().map(item => item.name),
        container: section,
      });
      brand.maxLength = 120;
      const description = appendField('description', 'Descripción del equipo', 'text', false, existing && existing.description, { full: true, container: section });
      description.maxLength = 255;
      const serial = appendField('serial', 'Serial del equipo', 'text', false, existing && existing.serial, { container: section });
      serial.maxLength = 120;
      const cost = appendField('cost', 'Precio de compra (COP)', 'number', true, existing ? existing.cost : 0, { container: section });
      cost.min = 0;
      cost.step = '0.01';
      const quantity = appendField('quantity', 'Cantidad', 'number', true, existing ? existing.quantity : 1, { container: section });
      quantity.min = 0;
      quantity.step = 1;
      appendField('status', 'Estado', 'select', true, existing ? existing.status : 'Disponible', { options: TOOL_STATUSES, placeholder: false, container: section });
      const people = data.users
        .filter(person => person.estado !== 'Inactivo' || (existing && existing.responsibleId === person.id))
        .map(person => ({ value: person.id, label: person.nombre }));
      appendField('responsibleId', 'Responsable', 'select', false, existing && existing.responsibleId, { options: people, placeholder: 'Sin responsable', full: true, container: section });

      const foot = form.querySelector('.modal-foot');
      foot.querySelector('[data-delete-tool]')?.remove();
      if (existing && window.inventarioApi.can('herramientas.eliminar')) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-danger';
        remove.dataset.deleteTool = '';
        remove.textContent = 'Eliminar';
        remove.addEventListener('click', () => deleteTool(existing.id));
        foot.prepend(remove);
      }
    }, async values => {
      const name = values.name.trim();
      if (data.tools.some(tool => tool.id !== id && tool.name.toLocaleLowerCase() === name.toLocaleLowerCase() && String(tool.brand || '').toLocaleLowerCase() === values.brand.trim().toLocaleLowerCase())) {
        showNotice('Ya existe una herramienta con ese nombre y marca.', true);
        return;
      }
      await window.inventarioApi.post(existing ? 'tool.update' : 'tool.create', { ...(existing ? { id: existing.id } : {}), ...values, name });
      await reloadData();
      closeForm();
      renderShell();
      showNotice(existing ? 'Herramienta actualizada.' : 'Herramienta creada.');
    });
  }

  function deleteTool(id) {
    const tool = data.tools.find(item => item.id === id);
    if (!window.inventarioApi.can('herramientas.eliminar')) return showNotice('No tienes permiso para eliminar herramientas.', true);
    if (!tool) return;
    deleteWithReason({
      title: `Eliminar la herramienta ${tool.name}`,
      message: 'Esta acción no se puede deshacer. Explica por qué se elimina.',
      action: 'tool.delete',
      id,
      done: () => { closeForm(); closeDetail(); renderShell(); showNotice('Herramienta eliminada.'); },
    });
  }

  function deleteUser(id) {
    const user = data.users.find(item => item.id === id);
    if (!window.inventarioApi.can('funcionarios.eliminar')) return showNotice('No tienes permiso para eliminar funcionarios.', true);
    if (!user) return;
    deleteWithReason({
      title: `Eliminar al funcionario ${user.nombre}`,
      message: 'Esta acción no se puede deshacer. Explica por qué se elimina.',
      action: 'user.delete',
      id,
      done: () => { closeForm(); closeDetail(); renderShell(); showNotice('Funcionario eliminado.'); },
    });
  }
