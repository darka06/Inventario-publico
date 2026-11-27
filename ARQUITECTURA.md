# Arquitectura de Inventario_Global

Regla general: **ningún archivo debe pasar de ~400 líneas**. Si uno crece, se divide por tema.

## CSS — `css/`
`styles.css` es solo un manifiesto de `@import`; el **orden** de los imports es el orden de la cascada.

| Carpeta | Qué va ahí |
|---|---|
| `base/` | variables (`:root`), reseteo, scrollbars |
| `layout/` | menú lateral, estructura general, responsive |
| `components/` | piezas reutilizables: botones, tablas, modales, formularios, tarjetas, detalle |
| `views/` | estilos de una pantalla concreta (inicio, usuario, técnicos, módulos…) |

- Estilo nuevo → va al módulo de su tema, o a uno nuevo + una línea en `styles.css`.
- Cada `@import` lleva `?v=N`. **Al editar un módulo, sube su N** (el `?v=` de `styles.css` no refresca los importados).
- Colores nuevos: usa variables de `base/_base.css` (`var(--brand)`, …) en vez de escribir el hexadecimal.
- `accesos.css` y `home-board.css` se cargan solo en las páginas que los usan.

## JavaScript — `js/`
- `modulos.php` ensambla `js/modulos/*.js` **en el orden de su lista `$parts`** dentro de una sola función
  (así comparten estado) y lo entrega con caché ETag. Las páginas cargan `js/modulos.php`.
- Archivo nuevo → crearlo en `js/modulos/` y añadirlo a `$parts`. No hace falta compilar nada.
- Cada archivo agrupa funciones de un tema (activos, filtros, préstamos…). Cada archivo es un fragmento
  del cuerpo de la función: no se ejecuta solo.
- Los demás scripts (`api-client.js`, `sidebar*.js`, …) siguen siendo archivos independientes.

## Backend PHP — `api/`
- `index.php`: cabeceras, `require_once` de `lib/` y el enrutador (`try { … }` con los `resource`).
- `auth.php`: sesión, cuentas y permisos. `config.php`: conexión.
- `lib/`: funciones por tema (`http`, `helpers`, `fetch`, `assets`, `supplies`, `purchases`, `records`, `audit`, `tool_audits`).
  Cada archivo declara `strict_types=1` (esa directiva vale por archivo).
- Función nueva → al `lib/` de su tema; endpoint nuevo → un caso en el enrutador de `index.php`.
- `lib/.htaccess` bloquea el acceso directo por URL.
