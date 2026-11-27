# Inventario

Aplicación web para registrar y consultar activos, herramientas, insumos, compras, préstamos y movimientos. Incluye una interfaz en HTML, CSS y JavaScript, una API en PHP y persistencia en MySQL o MariaDB.

> **Estado:** proyecto preparado para instalación y pruebas locales. Configura y valida tu propio servidor antes de usarlo en producción.

## Funcionalidades

- Catálogo de activos, herramientas e insumos
- Registro de compras, préstamos y movimientos
- Panel de resumen, contactos y administración de usuarios
- API PHP con acceso a datos mediante PDO
- Datos sintéticos para probar la instalación

## Requisitos

- PHP 8.1 o superior, con extensiones PDO MySQL y mbstring
- MySQL 8.0 o superior, o MariaDB 10.6 o superior
- Apache con PHP configurado
- Node.js y npm para regenerar los archivos minimizados
- Composer para instalar y ejecutar las pruebas PHP

## Instalación local

1. Clona el repositorio y entra a su carpeta:

   ```sh
   git clone https://github.com/darka06/inventario.git
   cd Inventario-publico
   ```

2. **Usa una base de datos nueva y desechable para la demostración.** El esquema elimina y vuelve a crear las tablas de Inventario al importarse. No lo ejecutes contra una base existente ni contra producción.

   ```sh
   mysql -u root -p < database/schema.mysql.sql
   mysql -u root -p inventario_demo < database/seed.demo.sql
   ```

   La primera orden crea la base y las tablas; la segunda carga los registros ficticios. Si ya existe una instalación de demostración con datos que quieras conservar, haz una copia antes de importar el esquema.

3. Crea una cuenta de base de datos exclusiva para la aplicación, con acceso solo a `inventario_demo`. Para el uso normal bastan los permisos `SELECT`, `INSERT`, `UPDATE` y `DELETE`. Importa el esquema con una cuenta administrativa local y no uses esa cuenta para ejecutar la aplicación.

4. Copia `api/config.local.php.example` a `api/config.local.php` y configura host, puerto, nombre de base de datos, usuario y contraseña locales. Este archivo está excluido de Git. Usa una clave propia y no reutilices credenciales de otros servicios.

5. Configura Apache para servir la carpeta del proyecto con PHP y abre `/pages/login.html`. Si aún no hay cuentas, la aplicación permite crear la primera desde esa pantalla. No existe una contraseña predeterminada.

La semilla contiene únicamente ejemplos ficticios: códigos `DEMO-`, teléfonos de ejemplo y correos del dominio reservado `example.invalid`. Se puede ejecutar de nuevo para restablecer los registros de demostración.

## Desarrollo y comprobaciones

Instala las dependencias y ejecuta las pruebas y la generación de recursos:

```sh
npm ci
composer install
composer test
npm run minify
```

La integración continua ejecuta las pruebas PHP y comprueba que los recursos minimizados estén sincronizados con sus fuentes.

## Estructura

- `api/`: API PHP y plantilla de configuración local
- `css/`, `js/`, `pages/`: estilos, lógica e interfaz
- `dist/`: archivos minimizados versionados
- `database/schema.mysql.sql`: esquema de instalación para una base de demostración nueva
- `database/seed.demo.sql`: registros ficticios de demostración
- `tests/`: pruebas automatizadas

## Seguridad y privacidad

- Nunca subas `api/config.local.php`, archivos `.env`, contraseñas, tokens, copias de bases de datos, volcados ni hojas de cálculo con información real.
- En producción, configura `INVENTARIO_ENV=production` en el entorno de PHP, usa HTTPS y credenciales únicas con permisos mínimos.
- Mantén copias de seguridad y prueba su restauración antes de actualizar una instalación.
- No cargues en GitHub datos personales, datos de una empresa ni información de clientes.

El ejemplo de configuración activa explícitamente el modo `development` para el trabajo local. El modo seguro es el predeterminado; revisa la configuración del servidor antes de exponer la aplicación en Internet.

## Licencia

Inventario se distribuye bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE).
