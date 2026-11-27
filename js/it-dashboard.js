// Pinta el resumen de equipos de IT con datos de la base MySQL.
(() => {
  const cards = document.querySelector('.cards');
  if (!cards || !window.inventarioApi) return;

  const error = document.createElement('p');
  error.className = 'module-notice';
  error.setAttribute('role', 'status');
  cards.before(error);
  const icons = [
    ['router', 'router.svg'],
    ['switch', 'switch.svg'],
    ['impres', 'printer.svg'],
    ['phone', 'phone.svg'],
    ['teléfono', 'phone.svg'],
    ['cámara', 'cooling.svg'],
    ['firewall', 'firewall.svg'],
    ['red', 'network.svg'],
    ['servidor', 'rack.svg'],
    ['rack', 'rack.svg'],
    ['comput', 'computer.svg'],
  ];

  function iconFor(name) {
    const key = name.toLocaleLowerCase();
    const match = icons.find(([part]) => key.includes(part));
    return match ? match[1] : 'cube.svg';
  }

  function render(categories) {
    cards.replaceChildren();
    // No mostrar ninguna categoría
    error.textContent = '';
  }

  window.inventarioApi.get('dashboard')
    .then(result => render(result.categories))
    .catch(problem => {
      error.textContent = problem.message;
      error.classList.add('error');
      cards.replaceChildren();
    });
})();
