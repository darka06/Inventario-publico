-- Esquema simplificado para pruebas de integración (SQLite)
-- Solo las tablas necesarias para las pruebas críticas
--
-- LIMITACIONES:
-- - Este es un esquema simplificado de SQLite, no coincide exactamente con el schema MySQL de producción
-- - Faltan índices únicos, triggers, vistas y algunas columnas adicionales que existen en producción
-- - Las pruebas usan este schema para validar lógica crítica sin necesidad de configurar MySQL completo
-- - Para instalar el esquema MySQL completo de demostración, usa database/schema.mysql.sql

-- Tabla de estados de activo
CREATE TABLE estados_activo (
    estado_id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    permite_asignacion INTEGER DEFAULT 0,
    es_final INTEGER DEFAULT 0
);

-- Insertar estados básicos
INSERT INTO estados_activo (nombre, descripcion, permite_asignacion, es_final) VALUES
('Disponible', 'Activo disponible para asignar', 1, 0),
('Asignado', 'Activo asignado a una persona', 0, 0),
('Alquilado', 'Activo alquilado', 0, 0),
('Prestado', 'Activo prestado temporalmente', 0, 0),
('Vendido', 'Activo vendido', 0, 1);

-- Tabla de activos
CREATE TABLE activos (
    activo_id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_inventario TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    estado_id INTEGER NOT NULL DEFAULT 1,
    responsable_actual TEXT,
    cliente_actual TEXT,
    marca TEXT,
    marca_id INTEGER,
    fecha_ultimo_movimiento TEXT,
    creado_en TEXT,
    actualizado_en TEXT,
    FOREIGN KEY (estado_id) REFERENCES estados_activo(estado_id),
    FOREIGN KEY (marca_id) REFERENCES marcas(marca_id)
);

-- Tabla de asignaciones
CREATE TABLE asignaciones (
    asignacion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    activo_id INTEGER NOT NULL,
    persona_asignada TEXT,
    cliente_texto TEXT,
    asignado_en TEXT NOT NULL,
    devuelto_en TEXT,
    observaciones TEXT,
    FOREIGN KEY (activo_id) REFERENCES activos(activo_id)
);

-- Tabla de insumos
CREATE TABLE insumos (
    insumo_id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    unidad_medida TEXT,
    marca TEXT,
    marca_id INTEGER,
    stock_actual REAL DEFAULT 0,
    stock_minimo REAL DEFAULT 0,
    valor_unitario REAL DEFAULT 0,
    creado_en TEXT,
    actualizado_en TEXT,
    FOREIGN KEY (marca_id) REFERENCES marcas(marca_id)
);

-- Tabla de movimientos de insumos
CREATE TABLE movimientos_insumos (
    movimiento_insumo_id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_insumo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    tipo_movimiento TEXT NOT NULL,
    fecha TEXT NOT NULL,
    entregado_a TEXT,
    observaciones TEXT
);

-- Tabla de marcas (para pruebas de compras)
CREATE TABLE marcas (
    marca_id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
);

-- Tabla de categorías (para pruebas de activos)
CREATE TABLE categorias_activo (
    categoria_id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
);

-- Tabla de compras de insumos
CREATE TABLE compras_insumos (
    compra_insumo_id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_insumo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    fecha_compra TEXT NOT NULL,
    valor_unitario REAL NOT NULL
);

-- Tabla de historial de estados
CREATE TABLE historial_estados (
    historial_id INTEGER PRIMARY KEY AUTOINCREMENT,
    activo_id INTEGER NOT NULL,
    codigo_activo TEXT NOT NULL,
    estado_anterior_id INTEGER,
    estado_nuevo_id INTEGER NOT NULL,
    cambiado_en TEXT NOT NULL,
    motivo TEXT,
    FOREIGN KEY (activo_id) REFERENCES activos(activo_id),
    FOREIGN KEY (estado_anterior_id) REFERENCES estados_activo(estado_id),
    FOREIGN KEY (estado_nuevo_id) REFERENCES estados_activo(estado_id)
);

-- Tabla de préstamos de activos
CREATE TABLE prestamos_activos (
    prestamo_id INTEGER PRIMARY KEY AUTOINCREMENT,
    asignacion_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    fecha_devolucion_prevista TEXT,
    operacion_id TEXT,
    FOREIGN KEY (asignacion_id) REFERENCES asignaciones(asignacion_id)
);
