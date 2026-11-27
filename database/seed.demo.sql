-- Datos exclusivamente ficticios para la demostración local.
-- Importa después de schema.mysql.sql. Puedes ejecutar este archivo más de una vez.
USE inventario_demo;

INSERT IGNORE INTO marcas (nombre) VALUES ('Acer'), ('Dell'), ('Bosch'), ('Genérica');
INSERT IGNORE INTO categorias_activo (nombre) VALUES ('Cómputo'), ('Herramientas'), ('Mobiliario');
INSERT IGNORE INTO estados_activo (nombre, descripcion, permite_asignacion, es_final) VALUES
 ('Disponible','Disponible para asignar',1,0), ('Asignado','Asignado a una persona',0,0),
 ('Alquilado','En alquiler',0,0), ('Prestado','En préstamo',0,0), ('Vendido','Venta registrada',0,1),
 ('En reparación','En mantenimiento',0,0), ('Baja','Fuera de servicio',0,1);
INSERT IGNORE INTO departamentos (nombre) VALUES ('Operaciones'), ('Tecnología');
INSERT INTO usuarios (nombre_completo,cargo,documento,correo,departamento_id,estado,telefono,notas)
SELECT 'Ana Ejemplo','Técnica','DEMO-001','ana@example.invalid',departamento_id,'Activo','000-000-0000','Registro ficticio de demostración'
FROM departamentos WHERE nombre='Operaciones'
AND NOT EXISTS (SELECT 1 FROM usuarios WHERE documento='DEMO-001');
INSERT INTO usuarios (nombre_completo,cargo,documento,correo,departamento_id,estado,telefono,notas)
SELECT 'Luis Muestra','Analista','DEMO-002','luis@example.invalid',departamento_id,'Activo','000-000-0000','Registro ficticio de demostración'
FROM departamentos WHERE nombre='Tecnología'
AND NOT EXISTS (SELECT 1 FROM usuarios WHERE documento='DEMO-002');
INSERT INTO clientes (razon_social,nit,correo,telefono,direccion,notas)
SELECT 'Cliente de demostración','DEMO-CLIENTE','contacto@example.invalid','000-000-0000','Dirección ficticia','Datos de ejemplo; no es un cliente real'
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE nit='DEMO-CLIENTE');
INSERT INTO proveedores (razon_social,nit,correo,telefono,direccion,notas)
SELECT 'Proveedor de demostración','DEMO-PROVEEDOR','ventas@example.invalid','000-000-0000','Dirección ficticia','Datos de ejemplo; no es un proveedor real'
WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nit='DEMO-PROVEEDOR');

INSERT INTO activos (codigo_inventario,categoria_id,estado_id,nombre,marca,marca_id,modelo,numero_serie,descripcion,fecha_compra,costo_compra,tipo,notas,ubicacion)
SELECT 'DEMO-ACT-001', c.categoria_id, e.estado_id, 'Portátil de demostración','Acer',m.marca_id,'Modelo ficticio','SERIE-DEMO-001',
 'Equipo sintético para explorar la aplicación','2025-01-15',1800000,'Equipo','Registro ficticio; no corresponde a un activo real','Sede de ejemplo'
FROM categorias_activo c JOIN estados_activo e ON e.nombre='Disponible' JOIN marcas m ON m.nombre='Acer'
WHERE c.nombre='Cómputo' AND NOT EXISTS (SELECT 1 FROM activos WHERE codigo_inventario='DEMO-ACT-001');
INSERT INTO activos (codigo_inventario,categoria_id,estado_id,nombre,marca,marca_id,modelo,numero_serie,descripcion,fecha_compra,costo_compra,tipo,notas,ubicacion)
SELECT 'DEMO-ACT-002', c.categoria_id, e.estado_id, 'Taladro de demostración','Bosch',m.marca_id,'Modelo ficticio','SERIE-DEMO-002',
 'Herramienta sintética para explorar la aplicación','2025-02-10',420000,'Herramienta','Registro ficticio; no corresponde a un activo real','Bodega de ejemplo'
FROM categorias_activo c JOIN estados_activo e ON e.nombre='Disponible' JOIN marcas m ON m.nombre='Bosch'
WHERE c.nombre='Herramientas' AND NOT EXISTS (SELECT 1 FROM activos WHERE codigo_inventario='DEMO-ACT-002');

INSERT INTO insumos (codigo,descripcion,unidad_medida,marca,marca_id,entradas,salidas,stock_actual,stock_actual_data,stock_minimo,valor_unitario,valor_total_stock,notas)
SELECT 'DEMO-INS-001','Cable de demostración','Unidad','Genérica',m.marca_id,25,0,25,25,5,12000,300000,'Datos sintéticos'
FROM marcas m WHERE m.nombre='Genérica'
AND NOT EXISTS (SELECT 1 FROM insumos WHERE codigo='DEMO-INS-001');
INSERT INTO insumos (codigo,descripcion,unidad_medida,marca,marca_id,entradas,salidas,stock_actual,stock_actual_data,stock_minimo,valor_unitario,valor_total_stock,notas)
SELECT 'DEMO-INS-002','Guantes de demostración','Par','Genérica',m.marca_id,12,0,12,12,3,8000,96000,'Datos sintéticos'
FROM marcas m WHERE m.nombre='Genérica'
AND NOT EXISTS (SELECT 1 FROM insumos WHERE codigo='DEMO-INS-002');

INSERT INTO herramientas (nombre,descripcion,marca,marca_id,serial,cantidad,estado,usuario_id,costo_compra)
SELECT 'Multímetro de demostración','Herramienta de ejemplo','Genérica',m.marca_id,'HERR-DEMO-001',1,'Disponible',NULL,95000
FROM marcas m WHERE m.nombre='Genérica'
AND NOT EXISTS (SELECT 1 FROM herramientas WHERE serial='HERR-DEMO-001');

INSERT INTO movimientos_insumos (fuente_clave,fecha,tipo_movimiento,origen,destino,codigo_insumo,cantidad,entregado_a,responsable,observaciones)
SELECT 'DEMO-SEED-INS-001',CURRENT_DATE,'Entrada','Compra de demostración','Bodega','DEMO-INS-001',25,NULL,'Sistema de ejemplo','Movimiento sintético'
WHERE NOT EXISTS (SELECT 1 FROM movimientos_insumos WHERE fuente_clave='DEMO-SEED-INS-001');
