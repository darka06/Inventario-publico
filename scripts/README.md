# Scripts de mantenimiento

Este directorio contiene scripts de mantenimiento para el sistema Sistema de inventario.

## Rotación de logs

### rotate-logs.php

Script que rota el archivo `logs/php-error.log` cuando supera 10MB. Mantiene hasta 5 archivos rotados (`.1`, `.2`, `.3`, `.4`, `.5`).

**Uso manual:**
```bash
php scripts/rotate-logs.php
```

### Configurar ejecución automática

#### Windows

Ejecutar como administrador:
```cmd
scripts\schedule-log-rotation.bat
```

Esto crea una tarea programada que ejecuta el script diariamente a las 3:00 AM.

**Comandos útiles:**
- Verificar tarea: `schtasks /query /tn "Inventario_Inventario_Log_Rotation"`
- Ejecutar manualmente: `schtasks /run /tn "Inventario_Inventario_Log_Rotation"`
- Eliminar tarea: `schtasks /delete /tn "Inventario_Inventario_Log_Rotation" /f`

**Nota:** Si PHP no está en `C:\xampp\php\php.exe`, ajusta la variable `PHP_PATH` en el archivo `.bat`.

#### Linux/Mac

```bash
bash scripts/schedule-log-rotation.sh
```

Esto agrega una entrada a crontab para ejecutar el script diariamente a las 3:00 AM.

**Comandos útiles:**
- Verificar crontab: `crontab -l`
- Editar crontab: `crontab -e`
- Eliminar entrada: editar crontab y borrar la línea de rotate-logs.php
