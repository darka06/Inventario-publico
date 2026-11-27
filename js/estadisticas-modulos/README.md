# Módulos de estadisticas.js

Este directorio contiene los módulos en los que se dividió el archivo original `estadisticas.js` (3495 líneas).

## Estructura de módulos

Los módulos deben cargarse en el siguiente orden en `estadisticas.php`:

1. **01-utilidades.js** (29 líneas)
   - Funciones base: `C`, `sum`, `esc`, `nice`, `pt`, `legend`, `cell`, `table`, `empty`

2. **02-graficos-basicos.js** (192 líneas)
   - Gráficos SVG: `pie`, `bars`, `line`, `funnel`, `pyramid`, `hbar`
   - Depende de: 01-utilidades.js

3. **03-graficos-avanzados.js** (42 líneas)
   - Selector de gráficos: `chart`, `gauge`
   - Depende de: 01-utilidades.js, 02-graficos-basicos.js

4. **04-datos-api.js** (43 líneas)
   - Procesamiento de datos: `D`, `PAL`, `num`, `money`, `pct`, `bucket`, `fmt`, `day`, `group`, `filterByField`, `lastDays`, `weekDays`, `movesPerDay`
   - Declara: `D` (variable global), `notice`
   - Depende de: 01-utilidades.js

5. **05-widgets-base.js** (127 líneas)
   - Base de widgets: `W` (array), `cw`, `tw`, `colStore`, `viewStore`, `SC`, `mine`, `show`, `ICONS`, `svg`, `icon`, `card`, `modal`, `$`, `current`
   - Declara: `W`, `modal`, `$`, `current`
   - Depende de: 01-utilidades.js, 02-graficos-basicos.js, 03-graficos-avanzados.js, 04-datos-api.js

6. **06-widgets-eventos.js** (138 líneas)
   - Eventos de widgets: `closeModal`, `refresh`, `toggleLegend`, `menu`, `colMenu`, `closeMenu`, `openMenu`, `saveCols`, `fillCols`, `openCols`
   - Depende de: 01-utilidades.js, 04-datos-api.js, 05-widgets-base.js

7. **07-tooltip.js** (18 líneas)
   - Tooltip: `tip` y mousemove handler
   - Depende de: 01-utilidades.js

8. **08-handlers-modal-detail.js** (143 líneas)
   - Funciones auxiliares para detalle del modal: `getDetailContentByField`, `getMovementsContent`, `getPurchasesContent`
   - Depende de: 01-utilidades.js, 04-datos-api.js

9. **08-handlers-modal-clicks.js** (212 líneas)
   - Handlers de clicks en el modal: `handleModalClick`
   - Depende de: 01-utilidades.js, 04-datos-api.js, 05-widgets-base.js, 08-handlers-modal-detail.js, 11-modal-detail.js

10. **08-handlers-modal.js** (144 líneas)
    - Handlers del modal principal: click events, keyboard events
    - Depende de: 01-utilidades.js, 04-datos-api.js, 05-widgets-base.js, 06-widgets-eventos.js, 08-handlers-modal-detail.js, 08-handlers-modal-clicks.js, 11-modal-detail.js

11. **09-handlers-root-table.js** (262 líneas)
    - Handlers de clicks en tablas del root: `handleRootTableRowClick`, `handleRootTableCellClick`
    - Depende de: 01-utilidades.js, 04-datos-api.js, 11-modal-detail.js

12. **09-handlers-root.js** (169 líneas)
    - Handlers del root (panel principal): click events
    - Depende de: 01-utilidades.js, 04-datos-api.js, 05-widgets-base.js, 06-widgets-eventos.js, 08-handlers-modal-detail.js, 09-handlers-root-table.js, 11-modal-detail.js

13. **10-widgets-definicion.js** (113 líneas)
    - Definición de widgets por defecto: llena el array `W` con todos los widgets
    - Declara: `BASE`
    - Depende de: 01-utilidades.js, 02-graficos-basicos.js, 03-graficos-avanzados.js, 04-datos-api.js, 05-widgets-base.js

14. **11-modal-detail.js** (107 líneas)
    - Modal de detalle: `detailModal`, `openDetailModal`, `closeDetailModal`
    - Depende de: 01-utilidades.js, 04-datos-api.js, 05-widgets-base.js

15. **12-arranque.js** (59 líneas)
    - Carga inicial: `root`, `defs`, renderizado, eventos finales, `load`, `redraw`
    - Depende de: 01-utilidades.js, 04-datos-api.js, 05-widgets-base.js, 10-widgets-definicion.js

## Variables compartidas

Las siguientes variables son compartidas entre módulos y deben estar disponibles:

- `C`, `sum`, `esc`, `nice`, `pt`, `legend`, `cell`, `table`, `empty` (desde 01-utilidades.js)
- `D`, `PAL`, `num`, `money`, `pct`, `bucket`, `fmt`, `day`, `group`, `filterByField`, `lastDays`, `weekDays`, `movesPerDay` (desde 04-datos-api.js)
- `W`, `cw`, `tw`, `colStore`, `viewStore`, `SC`, `mine`, `show`, `ICONS`, `svg`, `icon`, `card`, `modal`, `$`, `current` (desde 05-widgets-base.js)
- `BASE` (desde 10-widgets-definicion.js)
- `root` (desde 12-arranque.js)

## Orden de carga recomendado

```html
<script src="js/estadisticas-modulos/01-utilidades.js"></script>
<script src="js/estadisticas-modulos/02-graficos-basicos.js"></script>
<script src="js/estadisticas-modulos/03-graficos-avanzados.js"></script>
<script src="js/estadisticas-modulos/04-datos-api.js"></script>
<script src="js/estadisticas-modulos/05-widgets-base.js"></script>
<script src="js/estadisticas-modulos/06-widgets-eventos.js"></script>
<script src="js/estadisticas-modulos/07-tooltip.js"></script>
<script src="js/estadisticas-modulos/08-handlers-modal-detail.js"></script>
<script src="js/estadisticas-modulos/08-handlers-modal-clicks.js"></script>
<script src="js/estadisticas-modulos/08-handlers-modal.js"></script>
<script src="js/estadisticas-modulos/09-handlers-root-table.js"></script>
<script src="js/estadisticas-modulos/09-handlers-root.js"></script>
<script src="js/estadisticas-modulos/10-widgets-definicion.js"></script>
<script src="js/estadisticas-modulos/11-modal-detail.js"></script>
<script src="js/estadisticas-modulos/12-arranque.js"></script>
```

## Notas importantes

1. **No incluir IIFE**: El archivo `estadisticas.php` ya envuelve todo en un IIFE `(() => { ... })()`. Los módulos no deben tener su propio IIFE.

2. **root y defs**: La inicialización de `root` y el patrón rayado `defs` se movieron a `12-arranque.js`.

3. **Widgets personalizados**: La función `mine` y la carga de widgets personalizados se dividió entre `05-widgets-base.js` (definición de la función) y `10-widgets-definicion.js` (carga después de llenar `W`).

4. **Dependencias circulares**: Se evitó mediante la extracción de funciones auxiliares a archivos separados (08-handlers-modal-detail.js, 09-handlers-root-table.js).

5. **Archivo original**: El archivo `estadisticas.js` original se mantiene como respaldo en `C:\xampp\htdocs\Inventario_Global\js\estadisticas.js`.
