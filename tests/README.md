# Pruebas PHPUnit

Este directorio contiene las pruebas automatizadas del sistema de inventario.

## Ejecutar pruebas

```bash
# Instalar dependencias (requiere Composer)
composer install

# Ejecutar todas las pruebas
composer test
# o
phpunit

# Ejecutar un archivo específico
phpunit tests/HelpersTest.php
```

## Estructura

- `bootstrap.php` - Configuración inicial de PHPUnit, carga funciones de la API
- `HelpersTest.php` - Pruebas unitarias de funciones helpers (validDate, requiredText, etc.)
- `InventoryLogicTest.php` - Pruebas de integración para lógica crítica de inventario
- `schema.sql` - Schema simplificado de SQLite para pruebas de integración

## Pruebas que requieren base de datos

Las pruebas en `InventoryLogicTest` usan SQLite en memoria y no requieren configuración externa. El schema de pruebas (`tests/schema.sql`) es una versión simplificada del schema MySQL de producción con las tablas y columnas necesarias para las pruebas críticas.

Para más detalles sobre las limitaciones del schema de pruebas, ver los comentarios al inicio de `tests/schema.sql`.

## Funciones probadas

### HelpersTest (requiere solo PHP)
- `newSourceKey()` - Generación de claves únicas
- `validDate()` - Validación de fechas
- `requiredText()` - Validación de campos obligatorios
- `optionalText()` - Validación de campos opcionales

### InventoryLogicTest (requiere DB)
- `testStockMovementCannotGoNegative()` - Stock no puede ser negativo
- `testCanOnlyAssignAvailableAssets()` - Solo se asignan activos disponibles
- `testReturnAssetMakesItAvailableAgain()` - Devolución libera activo
- `testPurchaseUpdatesSupplyStock()` - Compra actualiza stock
- `testTransactionRollsBackOnError()` - Rollback en error
- `testCannotDeletePurchaseIfStockUsed()` - No eliminar compra si stock usado
- `testCannotDeleteAssetWithActiveAssignment()` - No eliminar activo con asignación activa
- `testStatusHistoryIsRecorded()` - Historial de estados se registra
- `testPurchaseUpdateAdjustsStock()` - Actualización de compra ajusta stock
- `testBrandRenamePropagatesToAssetsAndSupplies()` - Renombramiento de marca se propaga
- `testAssignmentWithMixedAssetAndSupplyItems()` - Asignación con items mixtos
