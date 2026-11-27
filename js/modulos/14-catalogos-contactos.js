  function editCategory(id = null) {
    const existing = data.categories.find(category => category.id === id);
    openForm(existing ? 'Editar categoría' : 'Nueva categoría', () => {
      formModal.querySelector('.modal-box').classList.add('modal-compact');
      const section = createFormSection('Datos de la categoría');
      const name = appendField('name', 'Nombre de la categoría', 'text', true, existing && existing.name, { full: true, container: section });
      name.maxLength = 120;
    }, async values => {
      const name = values.name.trim();
      if (data.categories.some(category => category.id !== id && category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        showNotice('Ya existe una categoría con ese nombre.', true);
        return;
      }
      await window.inventarioApi.post('category.save', { ...(existing ? { id: existing.id } : {}), name });
      await reloadData();
      closeForm();
      renderShell();
    });
  }

  function createBrand() {
    openForm('Nueva marca', () => {
      formModal.querySelector('.modal-box').classList.add('modal-compact');
      const section = createFormSection('Datos de la marca');
      const name = appendField('name', 'Nombre de la marca', 'text', true, '', { container: section });
      name.maxLength = 120;
    }, async values => {
      await window.inventarioApi.post('brand.create', { name: values.name.trim() });
      await reloadData();
      closeForm();
      renderShell();
      showNotice('Marca creada correctamente.');
    });
  }

  function renameBrand(id) {
    const existing = data.brands.find(brand => brand.id === id);
    if (!existing) return;
    openForm('Renombrar / unir marca', () => {
      formModal.querySelector('.modal-box').classList.add('modal-compact');
      const section = createFormSection('Nombre de la marca');
      const name = appendField('name', 'Marca', 'text', true, existing.name, { container: section });
      name.maxLength = 120;
    }, async values => {
      const name = values.name.trim();
      if (!name) {
        showNotice('Escribe el nombre de la marca.', true);
        return;
      }
      if (name === existing.name) {
        showNotice('Escribe un cambio en el nombre de la marca.', true);
        return;
      }
      const result = await window.inventarioApi.post('brand.rename', { id: existing.id, name });
      await reloadData();
      closeForm();
      renderShell();
      showNotice(`Marca actualizada: ${result.assets} activos y ${result.supplies} insumos asociados.`);
    });
  }

  // Pide el motivo de la eliminación (reemplaza al confirm) y, si se da, elimina y recarga.
  function deleteWithReason({ title, message, action, id, done }) {
    return window.inventarioApi.askReason({ title, message, confirmLabel: 'Eliminar', danger: true })
      .then(reason => {
        if (reason === null) return null;
        return window.inventarioApi.post(action, { id, justification: reason }).then(reloadData).then(done);
      })
      .catch(error => { if (!error.cancelled) showNotice(error.message, true); });
  }

  function deleteAsset(id) {
    const asset = data.assets.find(item => item.id === id);
    if (!asset) return;
    if (!window.inventarioApi.can('activos.eliminar')) {
      showNotice('No tienes permiso para eliminar activos.', true);
      return;
    }
    if (['Asignado', 'Alquilado', 'Prestado'].includes(asset.status)) {
      showNotice('Este activo está en uso. Registra su devolución antes de eliminarlo.', true);
      return;
    }
    deleteWithReason({
      title: `Eliminar el activo ${asset.code} - ${asset.name}`,
      message: 'Esta acción no se puede deshacer. Explica por qué se elimina.',
      action: 'asset.delete',
      id,
      done: () => { closeDetail(); renderShell(); showNotice('Activo eliminado.'); },
    });
  }

  function deleteCategory(id) {
    const category = data.categories.find(item => item.id === id);
    if (!window.inventarioApi.can('categorias.eliminar')) return showNotice('No tienes permiso para eliminar categorías.', true);
    if (!category) return;
    deleteWithReason({
      title: `Eliminar la categoría “${category.name}”`,
      message: 'Esta acción no se puede deshacer. Explica por qué se elimina.',
      action: 'category.delete',
      id,
      done: () => { closeDetail(); renderShell(); showNotice('Categoría eliminada.'); },
    });
  }

  function deleteBrand(id) {
    const brand = data.brands.find(item => item.id === id);
    if (!window.inventarioApi.can('marcas.eliminar')) return showNotice('No tienes permiso para eliminar marcas.', true);
    if (!brand) return;
    deleteWithReason({
      title: `Eliminar la marca “${brand.name}”`,
      message: 'Solo se puede eliminar si no tiene activos ni insumos asociados. Si está en uso, cambia su asignación o renómbrala. Explica el motivo.',
      action: 'brand.delete',
      id,
      done: () => { closeDetail(); renderShell(); showNotice('Marca eliminada.'); },
    });
  }

  function editContact(id = null) {
    const existing = data.contacts.find(contact => contact.id === id);
    const type = existing ? existing.type : contactType;
    const label = type === 'Proveedor' ? 'proveedor' : 'cliente';
    openForm(existing ? `Editar ${label}` : `Nuevo ${label}`, () => {
      const identityFields = createFormSection(`Datos del ${label}`);
      appendField('name', 'Razón social / nombre', 'text', true, existing && existing.name, { container: identityFields });
      appendField('nit', 'NIT / documento', 'text', false, existing && existing.nit, { container: identityFields });
      appendField('email', 'Correo', 'email', false, existing && existing.email, { container: identityFields });
      appendField('phone', 'Teléfono', 'tel', false, existing && existing.phone, { container: identityFields });
      appendField('address', 'Dirección', 'text', false, existing && existing.address, { container: identityFields, full: true });

      const notesFields = createFormSection('Notas');
      appendField('notes', 'Observaciones adicionales', 'textarea', false, existing && existing.notes, {
        full: true,
        rows: 2,
        container: notesFields,
      });
    }, async values => {
      await window.inventarioApi.post(existing ? 'contact.update' : 'contact.create', { ...(existing ? { id: existing.id } : {}), ...values, type });
      await reloadData();
      closeForm();
      renderShell();
    });
  }

  function deleteContact(id) {
    const contact = data.contacts.find(item => item.id === id);
    if (!window.inventarioApi.can('contactos.eliminar')) return showNotice('No tienes permiso para eliminar contactos.', true);
    if (!contact) return;
    deleteWithReason({
      title: `Eliminar a ${contact.name}`,
      message: 'Esta acción no se puede deshacer. Explica por qué se elimina.',
      action: 'contact.delete',
      id,
      done: () => { closeDetail(); renderShell(); showNotice('Registro eliminado.'); },
    });
  }

