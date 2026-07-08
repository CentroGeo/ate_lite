# ATE (Análisis Técnico de Operaciones)

Proyecto de plataforma web para el análisis de operaciones, desempeño y gestión de la red. 
El sistema consta de un backend desarrollado en Python con Django y un frontend en React (Vite).

## Requisitos Previos

- Python 3.10 o superior (o [Anaconda](https://www.anaconda.com/download)/Miniconda)
- Node.js 18+ y npm
- Sistema de base de datos correspondiente (según configuración de Django)

---

## 1. Configuración del Backend (Django)

Se recomienda encarecidamente utilizar un entorno virtual aislado para instalar las dependencias de Python. Puedes utilizar **Anaconda** o el módulo integrado **venv** de Python.

### Opción A: Usando Anaconda / Miniconda (Recomendado)

Abre tu terminal (Anaconda Prompt) y ejecuta los siguientes comandos:

```bash
# 1. Crear entorno llamado "ate" con la versión de Python recomendada
conda create -n ate python=3.10 -y

# 2. Activar el entorno
conda activate ate

# 3. Navegar a la carpeta del backend
cd backend

# 4. Instalar las dependencias del proyecto
pip install -r requirements.txt
```

### Opción B: Usando venv (Python Nativo)

Abre tu terminal de comandos (CMD o PowerShell) y ejecuta:

```bash
# 1. Navegar a la carpeta del backend
cd backend

# 2. Crear un entorno virtual llamado "venv"
python -m venv venv

# 3. Activar el entorno virtual
# En Windows:
venv\Scripts\activate
# En Linux/Mac:
source venv/bin/activate

# 4. Instalar las dependencias del proyecto
pip install -r requirements.txt
```

### Preparación de Base de Datos y Migraciones

Antes de levantar el servidor por primera vez, debes aplicar las migraciones de los modelos de base de datos y permisos:

```bash
# Asegúrate de estar en el directorio "backend" y tener tu entorno virtual activado
python manage.py makemigrations
python manage.py migrate
```

---

## 2. Configuración del Frontend (React + Vite)

Abre **una nueva pestaña o ventana** en tu terminal, navega a la raíz del proyecto y ejecuta:

```bash
# 1. Navegar a la carpeta del frontend
cd frontend

# 2. Instalar todas las dependencias de Node
npm install
```

---

## 3. Ejecutar la Aplicación para Desarrollo

Para poder trabajar o previsualizar el proyecto localmente, debes mantener ambos servidores corriendo en paralelo.

### Iniciar el Backend (Django)
En tu primera terminal, con el entorno virtual (conda o venv) activo:
```bash
cd backend
python manage.py runserver 8000
```
El servidor backend escuchará peticiones en: `http://localhost:8000`

### Iniciar el Frontend (React)
En tu segunda terminal:
```bash
cd frontend
npm run dev
```
La aplicación web levantará un servidor de desarrollo. Podrás acceder desde tu navegador en la URL que te indique (usualmente `http://localhost:5173`).

---

## Notas de Desarrollo
- La comunicación de la API está configurada para que el Frontend busque los datos del backend local (asegúrate que el puerto `8000` esté libre para Django).
- Autenticación: El sistema maneja autenticación y permisos vía JSON Web Tokens (JWT) y se validan en el backend con decoradores de sesión y permisos.
