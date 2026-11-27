  // ===== Animación del detalle: la ventana crece desde la fila/tarjeta pulsada y vuelve a ella al cerrar =====
  function stopWinAnim(win) {
    win.anims.forEach(anim => { anim.onfinish = null; anim.cancel(); });
    win.anims = [];
    win.closing = false;
    win.box.style.transformOrigin = '';
  }

  function playDetailAnim(win, opening, onDone) {
    const box = win.box;
    const from = win.origin && win.origin.isConnected ? win.origin.getBoundingClientRect() : null;
    const to = box.getBoundingClientRect();
    const hasOrigin = !!(from && from.width && from.height && to.width && to.height);
    box.style.transformOrigin = hasOrigin ? '0 0' : '50% 50%';
    const start = hasOrigin
      ? `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${Math.max(from.width / to.width, .08)}, ${Math.max(from.height / to.height, .08)})`
      : 'translateY(24px) scale(.94)';
    const order = frames => (opening ? frames : frames.slice().reverse());
    const timing = {
      duration: opening ? 340 : 240,
      easing: opening ? 'cubic-bezier(.2, .8, .2, 1)' : 'cubic-bezier(.4, 0, .2, 1)',
      fill: 'both',
    };
    const main = box.animate(order([{ transform: start }, { transform: 'none' }]), timing);
    win.anims = [main];
    // El contenido aparece/desaparece con un pequeño desfase para que no se vea estirado.
    box.querySelectorAll('.modal-head, .modal-body, .detail-foot').forEach(el => {
      win.anims.push(el.animate(order([{ opacity: 0 }, { opacity: 1 }]), {
        ...timing, duration: opening ? 240 : 120, delay: opening ? 110 : 0, easing: 'ease-out',
      }));
    });
    main.onfinish = () => { stopWinAnim(win); if (onDone) onDone(); };
  }

  // animate = true solo cuando la persona cierra la ventana (✕ o Escape);
  // en el resto de usos (editar, eliminar...) se cierra al instante, como antes.
  // Sin `win` cierra el detalle desde el que se lanzó la acción en curso.
  function closeDetail(animate = false, win) {
    const parent = pendingSubmit && pendingSubmit.open ? pendingSubmit.parentDetail : null;
    const target = win || (parent && parent.open ? parent : ctxDetail);
    if (!target || !target.open || target.closing) return;
    stopWinAnim(target);
    if (animate !== true || !target.box.animate || reducedMotion()) {
      removeWindow(target);
      return;
    }
    target.closing = true;
    playDetailAnim(target, false, () => removeWindow(target));
  }

  function showDetail(title, content, options = {}) {
    const refreshing = !!refreshTarget;
    const win = refreshing ? refreshTarget : createWindow('detail', detailTemplate, pendingSource && pendingSource.key);
    if (refreshing) {
      win.refreshed = true;
    } else {
      win.source = pendingSource;
      win.origin = detailOrigin;
      win.el.addEventListener('click', event => {
        if (!apiReady) return;
        const actionButton = event.target.closest('button[data-action]');
        if (actionButton) handleAction(actionButton.dataset.action, actionButton.dataset.id, win);
      });
    }
    pendingSource = null;
    detailOrigin = null;
    win.title.textContent = title;
    const box = win.box;
    box.classList.add('detail-modal-box');
    box.classList.toggle('detail-modal-wide', !!options.wide);
    // Las acciones (si hay) van en la cabecera, junto al título; se limpian en cada apertura.
    box.querySelectorAll('.detail-foot').forEach(old => old.remove());
    if (options.actions && options.actions.children.length) {
      options.actions.classList.add('detail-head-actions');
      const foot = document.createElement('footer');
      foot.className = 'detail-foot';
      foot.append(options.actions);
      box.append(foot);
    }
    // Pastilla de estado junto al título (se limpia en cada apertura).
    win.head.querySelectorAll('.detail-head-status').forEach(old => old.remove());
    if (options.status && options.status.label) {
      const pill = badge(options.status.label);
      pill.classList.add('detail-head-status');
      if (options.status.cls) pill.classList.add(options.status.cls);
      win.head.querySelector('h2').after(pill);
    }
    const scroll = win.body.scrollTop;
    win.body.replaceChildren(content);
    if (refreshing) {
      win.body.scrollTop = scroll;
      return;
    }
    Floating.clamp(box);
    if (box.animate && !reducedMotion()) playDetailAnim(win, true);
  }

  // Tras recargar los datos, los detalles abiertos se vuelven a dibujar con la información nueva;
  // si el registro ya no existe (se eliminó), su ventana se cierra.
  function refreshDetails() {
    wins.filter(win => win.kind === 'detail' && win.source).forEach(win => {
      refreshTarget = win;
      win.refreshed = false;
      try {
        dispatchRecord(win.source.action, win.source.id);
      } catch (error) {
        console.error(error);
        win.refreshed = true;
      } finally {
        refreshTarget = null;
      }
      if (!win.refreshed) removeWindow(win);
    });
  }

