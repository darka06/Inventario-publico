const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');

const cssFiles = [
  'css/base/_base.css',
  'css/base/_scrollbars.css',
  'css/layout/_sidebar.css',
  'css/layout/_layout.css',
  'css/layout/_responsive.css',
  'css/layout/_sidebar-profile.css',
  'css/components/_cards.css',
  'css/components/_tables.css',
  'css/components/_charts.css',
  'css/components/_buttons.css',
  'css/components/_modal.css',
  'css/components/_skeleton.css',
  'css/components/_detail.css',
  'css/components/_forms.css',
  'css/components/_float-windows.css',
  'css/components/_tabs.css',
  'css/components/_detail-actions.css',
  'css/views/_inicio.css',
  'css/views/_modulos.css',
  'css/views/_organize.css',
  'css/views/_widget-builder.css',
  'css/views/_inventario-usuarios.css',
  'css/views/_inventario-equipos.css',
  'css/views/_usuario.css',
  'css/views/_home-widgets.css',
  'css/views/_prestamos-historial.css',
  'css/views/_tecnicos.css',
  'css/views/_auditoria.css'
];

const cleanCss = new CleanCSS();

let combinedCss = '';
let totalOriginal = 0;

cssFiles.forEach(file => {
  const inputPath = path.join(__dirname, file);
  if (!fs.existsSync(inputPath)) {
    console.log(`⚠️  No encontrado: ${file}`);
    return;
  }

  const code = fs.readFileSync(inputPath, 'utf8');
  combinedCss += code + '\n';
  totalOriginal += Buffer.byteLength(code, 'utf8');
});

const result = cleanCss.minify(combinedCss);

if (result.errors.length > 0) {
  console.error('❌ Error minificando CSS combinado:', result.errors);
  process.exit(1);
}

const outputPath = path.join(__dirname, 'dist/css/styles.min.css');
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, result.styles);

const minifiedSize = Buffer.byteLength(result.styles, 'utf8');
const savings = ((1 - minifiedSize / totalOriginal) * 100).toFixed(1);

console.log(`✅ CSS combinado: ${totalOriginal} → ${minifiedSize} bytes (${savings}% reducción)`);
console.log(`📦 Archivos combinados: ${cssFiles.length}`);
