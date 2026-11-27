-- MariaDB 10.6+ / MySQL 8.0+
-- Esquema reconstruido desde consultas e inserciones de la API.
-- Base ficticia de demostración; no contiene datos de producción.
CREATE DATABASE IF NOT EXISTS inventario_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventario_demo;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS auditoria_herramientas_detalle, auditorias_herramientas, entregas_herramientas,
 registro_cambios, prestamos_activos, historial_estados, movimientos_activos, movimientos_insumos,
 compras_activos, compras_insumos, asignaciones, herramientas, activos, insumos, clientes, proveedores,
 usuarios, departamentos, categorias_activo, estados_activo, marcas, app_rol_permisos, app_usuarios, app_roles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE app_roles (
 rol_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE,
 descripcion VARCHAR(255) NULL, color CHAR(7) NOT NULL DEFAULT '#130a74', es_admin TINYINT(1) NOT NULL DEFAULT 0,
 creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE app_usuarios (
 app_usuario_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, username VARCHAR(80) NOT NULL UNIQUE,
 nombre_visible VARCHAR(150) NOT NULL, password_hash VARCHAR(255) NOT NULL, rol_id INT UNSIGNED NOT NULL,
 estado VARCHAR(20) NOT NULL DEFAULT 'Activo', intentos_fallidos INT NOT NULL DEFAULT 0,
 bloqueado_hasta DATETIME NULL, ultimo_acceso DATETIME NULL, creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_app_usuarios_rol FOREIGN KEY (rol_id) REFERENCES app_roles(rol_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE app_rol_permisos (
 rol_id INT UNSIGNED NOT NULL, permiso VARCHAR(120) NOT NULL, PRIMARY KEY (rol_id, permiso),
 CONSTRAINT fk_app_permisos_rol FOREIGN KEY (rol_id) REFERENCES app_roles(rol_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE marcas (
 marca_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE categorias_activo (
 categoria_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE estados_activo (
 estado_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE,
 descripcion VARCHAR(255) NULL, permite_asignacion TINYINT(1) NOT NULL DEFAULT 0, es_final TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE departamentos (
 departamento_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE usuarios (
 usuario_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre_completo VARCHAR(180) NOT NULL, cargo VARCHAR(120) NULL,
 documento VARCHAR(40) NULL, correo VARCHAR(190) NULL, departamento_id INT UNSIGNED NULL,
 estado VARCHAR(40) NOT NULL DEFAULT 'Activo', rol VARCHAR(80) NULL, sede VARCHAR(120) NULL, ingreso DATE NULL, telefono VARCHAR(40) NULL, notas TEXT NULL,
 CONSTRAINT fk_usuarios_departamento FOREIGN KEY (departamento_id) REFERENCES departamentos(departamento_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE clientes (
 cliente_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, razon_social VARCHAR(180) NOT NULL, nit VARCHAR(40) NULL,
 correo VARCHAR(190) NULL, telefono VARCHAR(40) NULL, direccion VARCHAR(255) NULL, notas TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE proveedores (
 proveedor_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, razon_social VARCHAR(180) NOT NULL, nit VARCHAR(40) NULL,
 correo VARCHAR(190) NULL, telefono VARCHAR(40) NULL, direccion VARCHAR(255) NULL, notas TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE activos (
 activo_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, codigo_inventario VARCHAR(60) NOT NULL UNIQUE,
 categoria_id INT UNSIGNED NOT NULL, estado_id INT UNSIGNED NOT NULL, nombre VARCHAR(180) NOT NULL,
 marca VARCHAR(120) NULL, marca_id INT UNSIGNED NULL, modelo VARCHAR(120) NULL, numero_serie VARCHAR(120) NULL,
 descripcion TEXT NULL, fecha_compra DATE NULL, costo_compra DECIMAL(14,2) NOT NULL DEFAULT 0,
 tipo VARCHAR(80) NULL, subtipo VARCHAR(80) NULL, proveedor_texto VARCHAR(180) NULL, factura VARCHAR(80) NULL,
 iva_porcentaje DECIMAL(5,2) NULL, valor_con_iva DECIMAL(14,2) NULL, fecha_registro_compra DATETIME NULL,
 fecha_ultimo_movimiento DATETIME NULL, cliente_actual VARCHAR(180) NULL, responsable_actual VARCHAR(180) NULL,
 notas TEXT NULL, fin_garantia DATE NULL, ubicacion VARCHAR(180) NULL,
 creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_activos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_activo(categoria_id),
 CONSTRAINT fk_activos_estado FOREIGN KEY (estado_id) REFERENCES estados_activo(estado_id),
 CONSTRAINT fk_activos_marca FOREIGN KEY (marca_id) REFERENCES marcas(marca_id) ON DELETE SET NULL,
 INDEX idx_activos_estado (estado_id), INDEX idx_activos_categoria (categoria_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE insumos (
 insumo_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, codigo VARCHAR(80) NOT NULL UNIQUE, descripcion VARCHAR(255) NOT NULL,
 unidad_medida VARCHAR(80) NULL, marca VARCHAR(120) NULL, marca_id INT UNSIGNED NULL,
 entradas DECIMAL(14,3) NOT NULL DEFAULT 0, salidas DECIMAL(14,3) NOT NULL DEFAULT 0,
 stock_actual DECIMAL(14,3) NOT NULL DEFAULT 0, stock_actual_data DECIMAL(14,3) NOT NULL DEFAULT 0,
 stock_minimo DECIMAL(14,3) NOT NULL DEFAULT 0, valor_unitario DECIMAL(14,2) NOT NULL DEFAULT 0,
 valor_total_stock DECIMAL(16,2) NOT NULL DEFAULT 0, notas TEXT NULL,
 creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_insumos_marca FOREIGN KEY (marca_id) REFERENCES marcas(marca_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE asignaciones (
 asignacion_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, activo_id INT UNSIGNED NOT NULL,
 usuario_id INT UNSIGNED NULL, entregado_por_id INT UNSIGNED NULL, persona_asignada VARCHAR(180) NULL,
 cliente_texto VARCHAR(180) NULL, asignado_en DATETIME NOT NULL, devuelto_en DATETIME NULL,
 observaciones TEXT NULL, fuente_clave VARCHAR(100) NULL UNIQUE,
 CONSTRAINT fk_asignaciones_activo FOREIGN KEY (activo_id) REFERENCES activos(activo_id) ON DELETE CASCADE,
 CONSTRAINT fk_asignaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE SET NULL,
 CONSTRAINT fk_asignaciones_entregador FOREIGN KEY (entregado_por_id) REFERENCES usuarios(usuario_id) ON DELETE SET NULL,
 INDEX idx_asignaciones_abiertas (activo_id, devuelto_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE prestamos_activos (
 prestamo_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, asignacion_id INT UNSIGNED NOT NULL,
 tipo VARCHAR(40) NOT NULL, fecha_devolucion_prevista DATE NULL, operacion_id VARCHAR(100) NULL,
 CONSTRAINT fk_prestamos_asignacion FOREIGN KEY (asignacion_id) REFERENCES asignaciones(asignacion_id) ON DELETE CASCADE,
 INDEX idx_prestamos_operacion (operacion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE historial_estados (
 historial_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, activo_id INT UNSIGNED NOT NULL, codigo_activo VARCHAR(60) NOT NULL,
 estado_anterior_id INT UNSIGNED NULL, estado_nuevo_id INT UNSIGNED NOT NULL, cambiado_por_id INT UNSIGNED NULL,
 cambiado_en DATETIME NOT NULL, motivo TEXT NULL, responsable_texto VARCHAR(180) NULL, fuente_clave VARCHAR(100) NULL UNIQUE,
 CONSTRAINT fk_historial_activo FOREIGN KEY (activo_id) REFERENCES activos(activo_id) ON DELETE CASCADE,
 CONSTRAINT fk_historial_estado_anterior FOREIGN KEY (estado_anterior_id) REFERENCES estados_activo(estado_id) ON DELETE SET NULL,
 CONSTRAINT fk_historial_estado_nuevo FOREIGN KEY (estado_nuevo_id) REFERENCES estados_activo(estado_id),
 CONSTRAINT fk_historial_usuario FOREIGN KEY (cambiado_por_id) REFERENCES usuarios(usuario_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE movimientos_activos (
 movimiento_activo_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, fuente_clave VARCHAR(100) NULL UNIQUE,
 activo_id INT UNSIGNED NULL, codigo_activo VARCHAR(60) NOT NULL, estado_id INT UNSIGNED NULL,
 cliente_id INT UNSIGNED NULL, cliente_texto VARCHAR(180) NULL, responsable_id INT UNSIGNED NULL,
 responsable_texto VARCHAR(180) NULL, fecha_movimiento DATETIME NOT NULL, observaciones TEXT NULL,
 CONSTRAINT fk_movimientos_activo FOREIGN KEY (activo_id) REFERENCES activos(activo_id) ON DELETE SET NULL,
 CONSTRAINT fk_movimientos_estado FOREIGN KEY (estado_id) REFERENCES estados_activo(estado_id) ON DELETE SET NULL,
 CONSTRAINT fk_movimientos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id) ON DELETE SET NULL,
 CONSTRAINT fk_movimientos_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(usuario_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE movimientos_insumos (
 movimiento_insumo_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, fuente_clave VARCHAR(100) NULL UNIQUE,
 fecha DATETIME NOT NULL, tipo_movimiento VARCHAR(40) NOT NULL, origen VARCHAR(180) NULL, destino VARCHAR(180) NULL,
 codigo_insumo VARCHAR(80) NOT NULL, cantidad DECIMAL(14,3) NOT NULL, entregado_a VARCHAR(180) NULL,
 responsable VARCHAR(180) NULL, observaciones TEXT NULL, operacion_id VARCHAR(100) NULL, operacion_tipo VARCHAR(40) NULL,
 CONSTRAINT fk_movimientos_insumos_codigo FOREIGN KEY (codigo_insumo) REFERENCES insumos(codigo) ON UPDATE CASCADE,
 INDEX idx_movimientos_insumos_operacion (operacion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE compras_insumos (
 compra_insumo_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, fuente_clave VARCHAR(100) NULL UNIQUE,
 fecha_compra DATE NOT NULL, codigo_insumo VARCHAR(80) NOT NULL, descripcion VARCHAR(255) NOT NULL,
 cantidad DECIMAL(14,3) NOT NULL, unidad_medida VARCHAR(80) NULL, marca VARCHAR(120) NULL,
 proveedor_texto VARCHAR(180) NULL, factura VARCHAR(80) NULL, valor_unitario DECIMAL(14,2) NOT NULL DEFAULT 0,
 iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0, valor_unitario_iva DECIMAL(14,2) NOT NULL DEFAULT 0,
 costo_total DECIMAL(16,2) NOT NULL DEFAULT 0, responsable_compra VARCHAR(180) NULL, tipo_movimiento VARCHAR(40) NULL,
 CONSTRAINT fk_compras_insumos_codigo FOREIGN KEY (codigo_insumo) REFERENCES insumos(codigo) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE compras_activos (
 compra_activo_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, fuente_clave VARCHAR(100) NULL UNIQUE,
 activo_id INT UNSIGNED NULL, codigo_activo VARCHAR(60) NULL, fecha_compra DATE NOT NULL,
 proveedor_id INT UNSIGNED NULL, proveedor_texto VARCHAR(180) NULL, factura VARCHAR(80) NULL,
 valor_unitario DECIMAL(14,2) NOT NULL DEFAULT 0, iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
 valor_con_iva DECIMAL(14,2) NOT NULL DEFAULT 0, responsable_compra VARCHAR(180) NULL,
 usuario_registro VARCHAR(180) NULL, fecha_registro DATETIME NULL,
 CONSTRAINT fk_compras_activos_activo FOREIGN KEY (activo_id) REFERENCES activos(activo_id) ON DELETE SET NULL,
 CONSTRAINT fk_compras_activos_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(proveedor_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE herramientas (
 herramienta_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(180) NOT NULL, descripcion TEXT NULL,
 marca VARCHAR(120) NULL, marca_id INT UNSIGNED NULL, serial VARCHAR(120) NULL, cantidad INT NOT NULL DEFAULT 1,
 estado VARCHAR(40) NOT NULL DEFAULT 'Disponible', usuario_id INT UNSIGNED NULL, costo_compra DECIMAL(14,2) NOT NULL DEFAULT 0,
 CONSTRAINT fk_herramientas_marca FOREIGN KEY (marca_id) REFERENCES marcas(marca_id) ON DELETE SET NULL,
 CONSTRAINT fk_herramientas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE entregas_herramientas (
 entrega_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, herramienta_id INT UNSIGNED NOT NULL,
 herramienta_nombre VARCHAR(180) NOT NULL, tecnico_id INT UNSIGNED NOT NULL, tecnico_nombre VARCHAR(180) NOT NULL,
 entregado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, registrado_por VARCHAR(180) NULL,
 CONSTRAINT fk_entregas_herramienta FOREIGN KEY (herramienta_id) REFERENCES herramientas(herramienta_id) ON DELETE CASCADE,
 CONSTRAINT fk_entregas_tecnico FOREIGN KEY (tecnico_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE auditorias_herramientas (
 auditoria_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, tecnico_id INT UNSIGNED NOT NULL,
 tecnico_nombre VARCHAR(180) NOT NULL, fecha_auditoria TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 auditor VARCHAR(180) NOT NULL, resultado VARCHAR(40) NOT NULL, total_herramientas INT NOT NULL DEFAULT 0,
 unidades_registradas INT NOT NULL DEFAULT 0, unidades_encontradas INT NOT NULL DEFAULT 0,
 novedades INT NOT NULL DEFAULT 0, nota_general TEXT NULL, ip VARCHAR(45) NULL,
 CONSTRAINT fk_auditorias_tecnico FOREIGN KEY (tecnico_id) REFERENCES usuarios(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE auditoria_herramientas_detalle (
 detalle_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, auditoria_id INT UNSIGNED NOT NULL,
 herramienta_id INT UNSIGNED NULL, herramienta_nombre VARCHAR(180) NOT NULL, marca VARCHAR(120) NULL,
 serial VARCHAR(120) NULL, cantidad_registrada INT NOT NULL DEFAULT 0, cantidad_encontrada INT NOT NULL DEFAULT 0,
 estado_registrado VARCHAR(40) NULL, estado_encontrado VARCHAR(40) NULL, resultado VARCHAR(40) NOT NULL,
 nota TEXT NULL,
 CONSTRAINT fk_auditoria_detalle_auditoria FOREIGN KEY (auditoria_id) REFERENCES auditorias_herramientas(auditoria_id) ON DELETE CASCADE,
 CONSTRAINT fk_auditoria_detalle_herramienta FOREIGN KEY (herramienta_id) REFERENCES herramientas(herramienta_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE registro_cambios (
 cambio_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, accion VARCHAR(80) NOT NULL, modulo VARCHAR(100) NOT NULL,
 operacion VARCHAR(180) NOT NULL, registro VARCHAR(100) NULL, registro_id VARCHAR(80) NULL,
 datos_antes LONGTEXT NULL, datos_enviados LONGTEXT NULL, ip VARCHAR(45) NULL, equipo VARCHAR(255) NULL,
 usuario_app VARCHAR(150) NULL, justificacion TEXT NULL, fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_registro_cambios_fecha (fecha_hora), INDEX idx_registro_cambios_modulo (modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
