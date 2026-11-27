@echo off
REM Script para configurar la rotación de logs en Windows Task Scheduler
REM Ejecutar como administrador

set PHP_PATH=C:\xampp\php\php.exe
set SCRIPT_PATH=%~dp0rotate-logs.php
set TASK_NAME=Inventario_Inventario_Log_Rotation

REM Verificar si PHP existe
if not exist "%PHP_PATH%" (
    echo ERROR: No se encuentra PHP en %PHP_PATH%
    echo Ajusta la variable PHP_PATH en este script
    pause
    exit /b 1
)

REM Verificar si el script de rotación existe
if not exist "%SCRIPT_PATH%" (
    echo ERROR: No se encuentra el script %SCRIPT_PATH%
    pause
    exit /b 1
)

REM Eliminar tarea existente si existe
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Crear tarea programada: ejecutar diariamente a las 3:00 AM
schtasks /create /tn "%TASK_NAME%" /tr "\"%PHP_PATH%\" \"%SCRIPT_PATH%\"" /sc daily /st 03:00 /ru SYSTEM /f

if %errorlevel% equ 0 (
    echo.
    echo Tarea programada creada exitosamente.
    echo Nombre: %TASK_NAME%
    echo Frecuencia: Diariamente a las 3:00 AM
    echo.
    echo Para verificar: schtasks /query /tn "%TASK_NAME%"
    echo Para ejecutar manualmente: schtasks /run /tn "%TASK_NAME%"
    echo Para eliminar: schtasks /delete /tn "%TASK_NAME%" /f
) else (
    echo ERROR: No se pudo crear la tarea programada
    echo Intenta ejecutar este script como administrador
)

pause
