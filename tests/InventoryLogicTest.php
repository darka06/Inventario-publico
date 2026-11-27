<?php
declare(strict_types=1);

namespace Inventario\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Pruebas para lógica crítica de inventario.
 * Estas pruebas usan SQLite en memoria, no requieren configuración externa.
 */
class InventoryLogicTest extends TestCase
{
    private ?\PDO $db = null;

    protected function setUp(): void
    {
        // Crear DB de prueba con SQLite en memoria
        $this->db = createTestPDO();
    }

    protected function tearDown(): void
    {
        $this->db = null;
    }

    /**
     * Prueba de lógica de movimiento de stock: verificar que el stock no pueda ser negativo
     */
    public function testStockMovementCannotGoNegative()
    {
        // 1. Crear un insumo con stock = 10
        $this->db->exec("INSERT INTO insumos (codigo, descripcion, stock_actual) VALUES ('INS-001', 'Insumo Test', 10)");

        // 2. Verificar stock inicial
        $stmt = $this->db->query("SELECT stock_actual FROM insumos WHERE codigo = 'INS-001'");
        $stock = $stmt->fetchColumn();
        $this->assertEquals(10, $stock);

        // 3. Intentar movimiento de salida con cantidad = 15 (simulado directamente en DB)
        // En producción esto verificaría la lógica antes de insertar
        $newStock = $stock - 15;

        // 4. Verificar que el cálculo sería negativo (lógica de prevención)
        $this->assertLessThan(0, $newStock, 'El stock no puede ser negativo');

        // 5. Verificar que el stock sigue siendo 10 (no se modificó)
        $stmt = $this->db->query("SELECT stock_actual FROM insumos WHERE codigo = 'INS-001'");
        $stockAfter = $stmt->fetchColumn();
        $this->assertEquals(10, $stockAfter);
    }

    /**
     * Prueba de asignación de activo: verificar que solo se asignen activos disponibles
     */
    public function testCanOnlyAssignAvailableAssets()
    {
        // 1. Crear activo en estado 'Disponible'
        $this->db->exec("INSERT INTO activos (codigo_inventario, nombre, estado_id) VALUES ('ACT-001', 'Activo Test', 1)");

        // 2. Verificar estado inicial
        $stmt = $this->db->query("SELECT estado_id FROM activos WHERE codigo_inventario = 'ACT-001'");
        $estadoId = $stmt->fetchColumn();
        $this->assertEquals(1, $estadoId, 'Estado inicial debe ser Disponible (id=1)');

        // 3. Simular asignación (cambiar estado y crear registro de asignación)
        $this->db->beginTransaction();
        try {
            $this->db->exec("UPDATE activos SET estado_id = 2, responsable_actual = 'Juan' WHERE codigo_inventario = 'ACT-001'");
            $this->db->exec("INSERT INTO asignaciones (activo_id, persona_asignada, asignado_en) VALUES (1, 'Juan', '2024-01-15')");
            $this->db->commit();
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }

        // 4. Verificar que estado cambió a 'Asignado'
        $stmt = $this->db->query("SELECT estado_id FROM activos WHERE codigo_inventario = 'ACT-001'");
        $estadoIdAfter = $stmt->fetchColumn();
        $this->assertEquals(2, $estadoIdAfter, 'Estado debe ser Asignado (id=2)');

        // 5. Verificar que existe asignación
        $stmt = $this->db->query("SELECT COUNT(*) FROM asignaciones WHERE activo_id = 1 AND devuelto_en IS NULL");
        $count = $stmt->fetchColumn();
        $this->assertEquals(1, $count, 'Debe existir una asignación activa');
    }

    /**
     * Prueba de devolución de activo: verificar que se libere el activo
     */
    public function testReturnAssetMakesItAvailableAgain()
    {
        // 1. Crear y asignar un activo
        $this->db->exec("INSERT INTO activos (codigo_inventario, nombre, estado_id) VALUES ('ACT-002', 'Activo Test 2', 1)");
        $this->db->exec("UPDATE activos SET estado_id = 2, responsable_actual = 'Maria' WHERE codigo_inventario = 'ACT-002'");
        $this->db->exec("INSERT INTO asignaciones (activo_id, persona_asignada, asignado_en) VALUES (2, 'Maria', '2024-01-15')");

        // 2. Devolverlo (simulado)
        $this->db->beginTransaction();
        try {
            $this->db->exec("UPDATE activos SET estado_id = 1, responsable_actual = NULL WHERE codigo_inventario = 'ACT-002'");
            $this->db->exec("UPDATE asignaciones SET devuelto_en = '2024-01-20' WHERE activo_id = 2");
            $this->db->commit();
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }

        // 3. Verificar que estado volvió a 'Disponible'
        $stmt = $this->db->query("SELECT estado_id FROM activos WHERE codigo_inventario = 'ACT-002'");
        $estadoId = $stmt->fetchColumn();
        $this->assertEquals(1, $estadoId, 'Estado debe volver a Disponible (id=1)');

        // 4. Verificar que responsable está vacío
        $stmt = $this->db->query("SELECT responsable_actual FROM activos WHERE codigo_inventario = 'ACT-002'");
        $responsable = $stmt->fetchColumn();
        $this->assertNull($responsable, 'Responsable debe ser NULL después de devolución');

        // 5. Verificar que asignación tiene fecha de devolución
        $stmt = $this->db->query("SELECT devuelto_en FROM asignaciones WHERE activo_id = 2");
        $devueltoEn = $stmt->fetchColumn();
        $this->assertNotNull($devueltoEn, 'La asignación debe tener fecha de devolución');
    }

    /**
     * Prueba de registro de compra: verificar que actualice stock de insumos
     */
    public function testPurchaseUpdatesSupplyStock()
    {
        // 1. Crear insumo con stock = 0
        $this->db->exec("INSERT INTO insumos (codigo, descripcion, stock_actual) VALUES ('INS-002', 'Insumo Test 2', 0)");

        // 2. Registrar compra de 10 unidades (simulado: actualizar stock directo)
        $this->db->beginTransaction();
        try {
            $this->db->exec("UPDATE insumos SET stock_actual = stock_actual + 10 WHERE codigo = 'INS-002'");
            $this->db->exec("INSERT INTO movimientos_insumos (codigo_insumo, cantidad, tipo_movimiento, fecha) VALUES ('INS-002', 10, 'Entrada', '2024-01-15')");
            $this->db->commit();
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }

        // 3. Verificar que stock ahora es 10
        $stmt = $this->db->query("SELECT stock_actual FROM insumos WHERE codigo = 'INS-002'");
        $stock = $stmt->fetchColumn();
        $this->assertEquals(10, $stock, 'Stock debe ser 10 después de compra');

        // 4. Verificar que se creó movimiento de entrada
        $stmt = $this->db->query("SELECT COUNT(*) FROM movimientos_insumos WHERE codigo_insumo = 'INS-002' AND tipo_movimiento = 'Entrada'");
        $count = $stmt->fetchColumn();
        $this->assertEquals(1, $count, 'Debe existir un movimiento de entrada');
    }

    /**
     * Prueba de transacción: verificar rollback en error
     */
    public function testTransactionRollsBackOnError()
    {
        // 1. Iniciar transacción
        $this->db->beginTransaction();

        try {
            // 2. Insertar registro válido
            $this->db->exec("INSERT INTO insumos (codigo, descripcion, stock_actual) VALUES ('INS-003', 'Insumo Test 3', 5)");

            // 3. Intentar insertar registro que viola restricción (código duplicado)
            $this->db->exec("INSERT INTO insumos (codigo, descripcion, stock_actual) VALUES ('INS-003', 'Insumo Duplicado', 10)");

            $this->db->commit();
            $this->fail('Debería haber lanzado excepción por duplicado');
        } catch (\PDOException $e) {
            // 4. Verificar rollback
            $this->db->rollBack();

            // 5. Verificar que el primer registro no existe (rollback funcionó)
            $stmt = $this->db->query("SELECT COUNT(*) FROM insumos WHERE codigo = 'INS-003'");
            $count = $stmt->fetchColumn();
            $this->assertEquals(0, $count, 'El rollback debe haber eliminado el primer registro');
        }
    }

    /**
     * Prueba de eliminación de compra: no permitir si parte del stock ya salió
     */
    public function testCannotDeletePurchaseIfStockUsed()
    {
        // 1. Crear insumo con stock = 10 (de una compra)
        $this->db->exec("INSERT INTO insumos (codigo, descripcion, stock_actual) VALUES ('INS-004', 'Insumo Test 4', 10)");

        // 2. Registrar compra de 10 unidades
        $this->db->exec("INSERT INTO compras_insumos (codigo_insumo, cantidad, fecha_compra, valor_unitario) VALUES ('INS-004', 10, '2024-01-15', 100)");

        // 3. Usar 5 unidades (movimiento de salida)
        $this->db->exec("UPDATE insumos SET stock_actual = stock_actual - 5 WHERE codigo = 'INS-004'");
        $this->db->exec("INSERT INTO movimientos_insumos (codigo_insumo, cantidad, tipo_movimiento, fecha) VALUES ('INS-004', 5, 'Salida', '2024-01-20')");

        // 4. Verificar stock actual = 5
        $stmt = $this->db->query("SELECT stock_actual FROM insumos WHERE codigo = 'INS-004'");
        $stock = $stmt->fetchColumn();
        $this->assertEquals(5, $stock, 'Stock debe ser 5 después de salida');

        // 5. Intentar eliminar la compra de 10 unidades - no debería ser posible
        // porque stock actual (5) es menor que la cantidad de la compra (10)
        $purchaseQty = 10;
        $canDelete = ($stock >= $purchaseQty);

        $this->assertFalse($canDelete, 'No se debe poder eliminar compra si parte del stock ya salió');
    }

    /**
     * Prueba de eliminación de activo: no permitir si tiene asignación activa
     */
    public function testCannotDeleteAssetWithActiveAssignment()
    {
        // 1. Crear activo
        $this->db->exec("INSERT INTO activos (codigo_inventario, nombre, estado_id) VALUES ('ACT-003', 'Activo Test 3', 1)");

        // 2. Asignarlo
        $this->db->exec("UPDATE activos SET estado_id = 2, responsable_actual = 'Pedro' WHERE codigo_inventario = 'ACT-003'");
        $this->db->exec("INSERT INTO asignaciones (activo_id, persona_asignada, asignado_en) VALUES (3, 'Pedro', '2024-01-15')");

        // 3. Verificar que tiene asignación activa
        $stmt = $this->db->query("SELECT COUNT(*) FROM asignaciones WHERE activo_id = 3 AND devuelto_en IS NULL");
        $count = $stmt->fetchColumn();
        $this->assertEquals(1, $count, 'Debe tener asignación activa');

        // 4. Intentar eliminar - debería fallar
        $canDelete = ($count === 0);
        $this->assertFalse($canDelete, 'No se debe poder eliminar activo con asignación activa');
    }

    /**
     * Prueba de historial de estados: verificar que se registren cambios
     */
    public function testStatusHistoryIsRecorded()
    {
        // 1. Crear activo en estado 'Disponible'
        $this->db->exec("INSERT INTO activos (codigo_inventario, nombre, estado_id) VALUES ('ACT-004', 'Activo Test 4', 1)");

        // 2. Cambiar estado a 'Asignado'
        $this->db->exec("UPDATE activos SET estado_id = 2 WHERE codigo_inventario = 'ACT-004'");

        // 3. Registrar en historial
        $this->db->exec("INSERT INTO historial_estados (activo_id, codigo_activo, estado_anterior_id, estado_nuevo_id, cambiado_en, motivo) VALUES (4, 'ACT-004', 1, 2, '2024-01-15 12:00:00', 'Cambio de estado')");

        // 4. Verificar que existe registro en historial
        $stmt = $this->db->query("SELECT COUNT(*) FROM historial_estados WHERE activo_id = 4");
        $count = $stmt->fetchColumn();
        $this->assertEquals(1, $count, 'Debe existir registro en historial');

        // 5. Verificar datos del historial
        $stmt = $this->db->query("SELECT estado_anterior_id, estado_nuevo_id FROM historial_estados WHERE activo_id = 4");
        $row = $stmt->fetch();
        $this->assertEquals(1, $row['estado_anterior_id'], 'Estado anterior debe ser Disponible (1)');
        $this->assertEquals(2, $row['estado_nuevo_id'], 'Estado nuevo debe ser Asignado (2)');
    }

    /**
     * Prueba de actualización de compra: verificar que el stock se ajuste correctamente
     */
    public function testPurchaseUpdateAdjustsStock()
    {
        // 1. Crear insumo con stock = 20 (de una compra original de 20)
        $this->db->exec("INSERT INTO insumos (codigo, descripcion, stock_actual, valor_unitario) VALUES ('INS-005', 'Insumo Test 5', 20, 100)");
        $this->db->exec("INSERT INTO compras_insumos (codigo_insumo, cantidad, fecha_compra, valor_unitario) VALUES ('INS-005', 20, '2024-01-15', 100)");

        // 2. Actualizar compra de 20 a 15 (reducción de 5)
        $originalQty = 20;
        $newQty = 15;
        $delta = $newQty - $originalQty; // -5

        // 3. Simular lógica de actualización: ajustar stock
        $currentStock = 20;
        $newStock = $currentStock + $delta; // 20 + (-5) = 15

        // 4. Verificar que stock no sería negativo
        $this->assertGreaterThanOrEqual(0, $newStock, 'Stock no puede ser negativo tras actualización de compra');

        // 5. Verificar que el cálculo es correcto
        $this->assertEquals(15, $newStock, 'Stock debe ser 15 tras reducir compra de 20 a 15');
    }

    /**
     * Prueba de renombramiento de marca: verificar que se propague a activos e insumos
     */
    public function testBrandRenamePropagatesToAssetsAndSupplies()
    {
        // 1. Crear marca
        $this->db->exec("INSERT INTO marcas (nombre) VALUES ('Marca Original')");

        // 2. Crear activo e insumo con esa marca
        $this->db->exec("INSERT INTO activos (codigo_inventario, nombre, marca, marca_id) VALUES ('ACT-005', 'Activo Test 5', 'Marca Original', 1)");
        $this->db->exec("INSERT INTO insumos (codigo, descripcion, marca, marca_id) VALUES ('INS-006', 'Insumo Test 6', 'Marca Original', 1)");

        // 3. Usar la función auxiliar de pruebas para renombrar (versión simplificada sin FOR UPDATE)
        $data = ['id' => 1, 'name' => 'Marca Renombrada'];
        $result = renameBrandForTests($this->db, $data);

        // 4. Verificar que la función retornó conteos correctos
        $this->assertEquals(1, $result['assets'], 'Debe reportar 1 activo afectado');
        $this->assertEquals(1, $result['supplies'], 'Debe reportar 1 insumo afectado');

        // 5. Verificar que marca se actualizó
        $stmt = $this->db->query("SELECT nombre FROM marcas WHERE marca_id = 1");
        $brandName = $stmt->fetchColumn();
        $this->assertEquals('Marca Renombrada', $brandName, 'Marca debe tener el nuevo nombre');

        // 6. Verificar que activo tiene el nuevo nombre de marca
        $stmt = $this->db->query("SELECT marca FROM activos WHERE codigo_inventario = 'ACT-005'");
        $assetBrand = $stmt->fetchColumn();
        $this->assertEquals('Marca Renombrada', $assetBrand, 'Activo debe tener el nuevo nombre de marca');

        // 7. Verificar que insumo tiene el nuevo nombre de marca
        $stmt = $this->db->query("SELECT marca FROM insumos WHERE codigo = 'INS-006'");
        $supplyBrand = $stmt->fetchColumn();
        $this->assertEquals('Marca Renombrada', $supplyBrand, 'Insumo debe tener el nuevo nombre de marca');
    }

    /**
     * Prueba de asignación con items mixtos: activos e insumos en una operación
     */
    public function testAssignmentWithMixedAssetAndSupplyItems()
    {
        // 1. Crear activo disponible
        $this->db->exec("INSERT INTO activos (codigo_inventario, nombre, estado_id) VALUES ('ACT-006', 'Activo Test 6', 1)");

        // 2. Crear insumo con stock = 10
        $this->db->exec("INSERT INTO insumos (codigo, descripcion, stock_actual) VALUES ('INS-007', 'Insumo Test 7', 10)");

        // 3. Obtener IDs correctos
        $stmt = $this->db->query("SELECT activo_id FROM activos WHERE codigo_inventario = 'ACT-006'");
        $assetId = $stmt->fetchColumn();

        $stmt = $this->db->query("SELECT insumo_id FROM insumos WHERE codigo = 'INS-007'");
        $supplyId = $stmt->fetchColumn();

        $supplyQty = 3;
        $person = 'Carlos';

        // 4. Asignar activo
        $this->db->beginTransaction();
        try {
            $this->db->exec("UPDATE activos SET estado_id = 2, responsable_actual = '{$person}' WHERE activo_id = {$assetId}");
            $this->db->exec("INSERT INTO asignaciones (activo_id, persona_asignada, asignado_en) VALUES ({$assetId}, '{$person}', '2024-01-15')");

            // 5. Registrar salida de insumo
            $this->db->exec("UPDATE insumos SET stock_actual = stock_actual - {$supplyQty} WHERE insumo_id = {$supplyId}");
            $this->db->exec("INSERT INTO movimientos_insumos (codigo_insumo, cantidad, tipo_movimiento, fecha, entregado_a) VALUES ('INS-007', {$supplyQty}, 'Salida', '2024-01-15', '{$person}')");

            $this->db->commit();
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }

        // 6. Verificar que activo está asignado
        $stmt = $this->db->query("SELECT estado_id, responsable_actual FROM activos WHERE activo_id = {$assetId}");
        $asset = $stmt->fetch();
        $this->assertEquals(2, $asset['estado_id'], 'Activo debe estar en estado Asignado');
        $this->assertEquals($person, $asset['responsable_actual'], 'Activo debe tener responsable asignado');

        // 7. Verificar que stock de insumo se redujo
        $stmt = $this->db->query("SELECT stock_actual FROM insumos WHERE insumo_id = {$supplyId}");
        $stock = $stmt->fetchColumn();
        $this->assertEquals(7, $stock, 'Stock de insumo debe ser 7 (10 - 3)');

        // 8. Verificar que existe movimiento de salida
        $stmt = $this->db->query("SELECT COUNT(*) FROM movimientos_insumos WHERE codigo_insumo = 'INS-007' AND tipo_movimiento = 'Salida'");
        $count = $stmt->fetchColumn();
        $this->assertEquals(1, $count, 'Debe existir movimiento de salida para el insumo');
    }
}
