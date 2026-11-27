const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const cssFiles = [
  // styles.css se omite porque usa @import con parámetros de versión
  'css/home-board.css',
  'css/base/_base.css',
  'css/base/_scrollbars.css',
  'css/components/_buttons.css',
  'css/components/_cards.css',
  'css/components/_charts.css',
  'css/components/_detail-actions.css',
  'css/components/_detail.css',
  'css/components/_float-windows.css',
  'css/components/_forms.css',
  'css/components/_modal.css',
  'css/components/_skeleton.css',
  'css/components/_tables.css',
  'css/components/_tabs.css',
  'css/layout/_layout.css',
  'css/layout/_responsive.css',
  'css/layout/_sidebar-profile.css',
  'css/layout/_sidebar.css',
  'css/views/_auditoria.css',
  'css/views/_home-widgets.css',
  'css/views/_inicio.css',
  'css/views/_inventario-equipos.css',
  'css/views/_inventario-usuarios.css',
  'css/views/_modulos.css',
  'css/views/_organize.css',
  'css/views/_prestamos-historial.css',
  'css/views/_tecnicos.css',
  'css/views/_usuario.css',
  'css/views/_widget-builder.css'
];

const jsFiles = [
  'js/accesos.js',
  'js/api-client.js',
  'js/constants.js',
  'js/dashboard.js',
  'js/estadisticas-custom.js',
  'js/float-windows.js',
  'js/funcionarios.js',
  'js/historial.js',
  'js/home-board.js',
  'js/home-widgets.js',
  'js/inventario.js',
  'js/it-dashboard.js',
  'js/login.js',
  'js/new-menu.js',
  'js/organize.js',
  'js/sidebar-render.js',
  'js/sidebar.js',
  'js/usuario.js'
];

const jsModuleFiles = [
  'js/modulos/01-estado.js',
  'js/modulos/02-utilidades.js',
  'js/modulos/03-formularios-campos.js',
  'js/modulos/04-ventanas.js',
  'js/modulos/05-detalle-animacion.js',
  'js/modulos/06-detalle-componentes.js',
  'js/modulos/07-shell-y-busqueda.js',
  'js/modulos/08-filtros.js',
  'js/modulos/09-resumen-tablas.js',
  'js/modulos/10-tecnicos.js',
  'js/modulos/11-render-tabla.js',
  'js/modulos/12-activos.js',
  'js/modulos/13-insumos-compras.js',
  'js/modulos/14-catalogos-contactos.js',
  'js/modulos/15-usuarios-herramientas.js',
  'js/modulos/16-prestamos.js',
  'js/modulos/17-acciones-y-arranque.js',
  'js/modulos/18-auditoria-herramientas.js'
];

const estadisticasFiles = [
  'js/estadisticas-modulos/00-inicializacion.js',
  'js/estadisticas-modulos/01-utilidades.js',
  'js/estadisticas-modulos/02-graficos-basicos.js',
  'js/estadisticas-modulos/03-graficos-avanzados.js',
  'js/estadisticas-modulos/04-datos-api.js',
  'js/estadisticas-modulos/05-widgets-base.js',
  'js/estadisticas-modulos/06-widgets-eventos.js',
  'js/estadisticas-modulos/07-tooltip.js',
  'js/estadisticas-modulos/08-handlers-modal-clicks.js',
  'js/estadisticas-modulos/08-handlers-modal-detail.js',
  'js/estadisticas-modulos/08-handlers-modal.js',
  'js/estadisticas-modulos/09-handlers-root-table.js',
  'js/estadisticas-modulos/09-handlers-root.js',
  'js/estadisticas-modulos/10-widgets-definicion.js',
  'js/estadisticas-modulos/11-modal-detail.js',
  'js/estadisticas-modulos/12-arranque.js',
  'js/estadisticas-modulos/constants.js'
];

const cleanCss = new CleanCSS();

function minifyCss(files) {
  let processed = 0;
  files.forEach(file => {
    const inputPath = path.join(__dirname, file);
    const outputPath = path.join(__dirname, 'dist', file.replace('.css', '.min.css'));

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  No encontrado: ${file}`);
      return;
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const code = fs.readFileSync(inputPath, 'utf8');
    const result = cleanCss.minify(code);

    if (result.errors.length > 0) {
      console.error(`❌ Error minificando ${file}:`, result.errors);
      return;
    }

    fs.writeFileSync(outputPath, result.styles);
    const originalSize = Buffer.byteLength(code, 'utf8');
    const minifiedSize = Buffer.byteLength(result.styles, 'utf8');
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    console.log(`✅ CSS: ${file} (${originalSize} → ${minifiedSize} bytes, ${savings}% reducción)`);
    processed++;
  });
  return processed;
}

async function minifyJs(files) {
  let processed = 0;
  for (const file of files) {
    const inputPath = path.join(__dirname, file);
    const outputPath = path.join(__dirname, 'dist', file.replace('.js', '.min.js'));

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  No encontrado: ${file}`);
      continue;
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const code = fs.readFileSync(inputPath, 'utf8');
    try {
      const result = await minify(code, {
        compress: {
          dead_code: true,
          drop_debugger: true,
          conditionals: true,
          evaluate: true,
          booleans: true,
          loops: true,
          unused: true,
          hoist_funs: true,
          keep_fargs: false,
          hoist_vars: false,
          if_return: true,
          join_vars: true,
          side_effects: true
        },
        mangle: {
          toplevel: false
        },
        output: {
          comments: false,
          beautify: false
        },
        parse: {
          bare_returns: true
        }
      });

      fs.writeFileSync(outputPath, result.code);
      const originalSize = Buffer.byteLength(code, 'utf8');
      const minifiedSize = Buffer.byteLength(result.code, 'utf8');
      const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
      console.log(`✅ JS:  ${file} (${originalSize} → ${minifiedSize} bytes, ${savings}% reducción)`);
      processed++;
    } catch (error) {
      console.error(`❌ Error minificando ${file}:`, error.message);
    }
  }
  return processed;
}

async function main() {
  console.log('🚀 Iniciando minificación...\n');

  const cssProcessed = minifyCss(cssFiles);
  console.log(`\n📦 CSS procesados: ${cssProcessed}/${cssFiles.length}\n`);

  const jsProcessed = await minifyJs(jsFiles);
  console.log(`\n📦 JS principales procesados: ${jsProcessed}/${jsFiles.length}\n`);

  const modulosProcessed = await minifyJs(jsModuleFiles);
  console.log(`\n📦 JS módulos procesados: ${modulosProcessed}/${jsModuleFiles.length}\n`);

  const estadisticasProcessed = await minifyJs(estadisticasFiles);
  console.log(`\n📦 JS estadísticas procesados: ${estadisticasProcessed}/${estadisticasFiles.length}\n`);

  const total = cssProcessed + jsProcessed + modulosProcessed + estadisticasProcessed;
  const totalFiles = cssFiles.length + jsFiles.length + jsModuleFiles.length + estadisticasFiles.length;
  console.log(`\n✨ Total: ${total}/${totalFiles} archivos minificados`);
}

main().catch(console.error);
