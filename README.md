# Inventario

Aplicación web para administrar activos, herramientas, insumos, compras, préstamos y movimientos. La interfaz usa HTML, CSS y JavaScript; la API está escrita en PHP y se conecta a MySQL o MariaDB.

## Requisitos

- PHP 8.1+ con PDO MySQL y mbstring
- MySQL 8.0+ o MariaDB 10.6+
- Apache con PHP
- Node.js y npm para reconstruir recursos minimizados
- Composer para ejecutar las pruebas PHP

## Inicio local

1. Crea una base de demostración con el esquema incluido:

   ```sh
   mysql -u root -p < database/schema.mysql.sql
   mysql -u root -p inventario_demo < database/seed.demo.sql
   ```

2. Copia `api/config.local.php.example` como `api/config.local.php` y configura el acceso a tu servidor MySQL local. El archivo local está ignorado por Git. No uses cuentas administrativas ni contraseñas de ejemplo en producción.

3. Sirve el proyecto mediante Apache/PHP y abre `/pages/login.html`. La primera cuenta se crea desde esa pantalla si la tabla de cuentas todavía está vacía.

La semilla usa exclusivamente datos ficticios con códigos `DEMO-`, teléfonos de ejemplo y correos reservados en `example.invalid`. No hay contraseña de demostración.

## Desarrollo

```sh
npm ci
composer install
composer test
npm run minify
```

La integración continua ejecuta las pruebas PHP y verifica los archivos minimizados.

## Estructura

- `api/`: API PHP y configuración de ejemplo
- `css/`, `js/`, `pages/`: interfaz
- `dist/`: recursos minimizados versionados
- `database/schema.mysql.sql`: esquema reconstruido para instalación local
- `database/seed.demo.sql`: registros sintéticos reejecutables
- `tests/`: pruebas

## Seguridad y privacidad

No subas `api/config.local.php`, archivos `.env`, bases de datos, volcados ni hojas de cálculo con datos reales. En producción establece `INVENTARIO_ENV=production` en el entorno de PHP, configura credenciales propias y HTTPS, y prepara copias de seguridad. El modo seguro es el valor predeterminado; el ejemplo local activa explícitamente `development` para permitir trabajar por HTTP.

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta [LICENSE](LICENSE).
