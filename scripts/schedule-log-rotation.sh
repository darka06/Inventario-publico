#!/bin/bash
# Script para configurar la rotación de logs en Linux/Mac usando cron
# Ejecutar: bash scripts/schedule-log-rotation.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/rotate-logs.php"
PHP_PATH=$(which php)

# Verificar si PHP existe
if [ -z "$PHP_PATH" ]; then
    echo "ERROR: PHP no encontrado en el PATH"
    echo "Instala PHP o ajusta PHP_PATH en este script"
    exit 1
fi

# Verificar si el script de rotación existe
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "ERROR: No se encuentra el script $SCRIPT_PATH"
    exit 1
fi

# Agregar entrada a cron (ejecutar diariamente a las 3:00 AM)
CRON_JOB="0 3 * * * $PHP_PATH $SCRIPT_PATH >> /dev/null 2>&1"

# Verificar si ya existe la entrada
if crontab -l 2>/dev/null | grep -q "rotate-logs.php"; then
    echo "La tarea de rotación de logs ya existe en crontab"
    echo "Para ver: crontab -l"
    echo "Para editar: crontab -e"
    echo "Para eliminar: editar crontab y borrar la línea de rotate-logs.php"
else
    # Agregar al crontab actual
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Tarea programada agregada exitosamente a crontab"
    echo "Frecuencia: Diariamente a las 3:00 AM"
    echo ""
    echo "Para verificar: crontab -l"
    echo "Para editar: crontab -e"
    echo "Para eliminar: editar crontab y borrar la línea de rotate-logs.php"
fi
