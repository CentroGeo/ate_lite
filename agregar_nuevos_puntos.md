# Guía Técnica: Integración de Nuevos Puntos Georreferenciados en el Mapa

El presente documento detalla el procedimiento técnico requerido para integrar y visualizar datos provenientes de nuevas tablas de la base de datos dentro del módulo de mapas de la aplicación. Gracias a la arquitectura modular del sistema, la incorporación de nuevas capas de información puede realizarse mediante los siguientes pasos estandarizados:

---

## 0. (Opcional) Generación Automática del Modelo de Datos

El framework Django proporciona una herramienta nativa para la inspección y generación de modelos a partir de tablas existentes en PostgreSQL. 

Para ejecutar esta utilidad, ir a la terminal dentro del directorio `backend` y escribir el siguiente comando:
```bash
python manage.py inspectdb nombre_de_la_tabla > temporal.py
```
Este proceso generará un archivo `temporal.py` con la estructura exacta de la clase del modelo. Posteriormente, esta clase deberá ser trasladada al archivo correspondiente descrito en el Paso 1.

---

## 1. Conexión de la Nueva Tabla al Backend (Django)

Es indispensable registrar la nueva tabla en el sistema creando su respectivo modelo de datos.

**Ruta del archivo:** `backend/api/models.py`

Abra el archivo [models.py](backend/api/models.py) y defina la nueva clase al final del mismo (o utilice el código autogenerado mediante `inspectdb`). A continuación, se presenta un ejemplo de referencia:

```python
class NuevosPuntos(models.Model):
    # Se debe definir la llave primaria de la tabla (primary_key=True)
    id_punto = models.IntegerField(primary_key=True) 
    nombre = models.CharField(max_length=255, null=True)
    
    # Campo requerido para el almacenamiento de coordenadas geoespaciales
    geom_texto = models.TextField(null=True) 

    class Meta:
        managed = False # Indica a Django que la tabla ya es administrada por la base de datos
        db_table = '"esquema"."nuevos_puntos"' # Nombre real de la tabla en PostgreSQL
```

---

## 2. Exposición y Procesamiento de los Datos (Backend)

Una vez registrado el modelo, es necesario extraer las coordenadas de la base de datos y enviarlas a la interfaz de usuario a través de la API.

**Ruta del archivo:** `backend/api/views.py`

Abra el archivo [views.py](backend/api/views.py). Dentro del controlador `map_data(request)`, en la sección anterior a la declaración `data = { 'status': 'success', 'stations': stations }`, incorpore el siguiente bloque lógico:

```python
    from .models import NuevosPuntos

    # Consulta a la base de datos extrayendo Latitud y Longitud del campo geom_texto
    nuevos_qs = NuevosPuntos.objects.exclude(
        geom_texto__isnull=True
    ).annotate(
        lng=ST_X(ST_GeomFromText('geom_texto')),
        lat=ST_Y(ST_GeomFromText('geom_texto'))
    )

    # Incorporación de los datos al listado principal "stations"
    for punto in nuevos_qs:
        if punto.lng is not None and punto.lat is not None:
            stations.append({
                'name': punto.nombre,
                'lng': str(punto.lng),
                'lat': str(punto.lat),
                'type': 'mi_nuevo_tipo', # Identificador fundamental para el mapeo en Frontend
                'capacity': '0 MW',      
                'capacity_mw': 0
            })
```

### Alternativa: Creación de un Endpoint Independiente

Si se desea generar nuevas rutas de API aislada, aplique los siguientes pasos:

**1. Creación del Controlador en `views.py`**:
```python
@csrf_exempt
def mis_nuevos_puntos(request):
    from .models import NuevosPuntos
    # Implementar lógica de extracción de latitud y longitud previamente descrita
    data = {'status': 'success', 'stations': stations_nuevas}
    return JsonResponse(data, safe=False)
```

**2. Registro de la Ruta en `urls.py`**:
Abra el archivo `backend/api/urls.py` e integre la nueva ruta:
```python
from .views import map_data, mis_nuevos_puntos

urlpatterns = [
    path('map/', map_data, name='map_data'),
    path('mis-puntos/', mis_nuevos_puntos, name='mis_nuevos_puntos'), # <- Nueva URL, la primera seccion es la ruta, la segunda seccion es el nombre de la funcion que genera la data y la tercera es un nombre comun para reconocer la ruta
]
```

**3. Consumo en el Frontend**:
Abra el archivo [useMapData.js](frontend/src/hooks/useMapData.js) e implemente una solicitud asíncrona para obtener y unir ambos repositorios de información:
```javascript
const stationsData = await apiFetch('/api/map/');
const misPuntosData = await apiFetch('/api/mis-puntos/');

// Fusión de conjuntos de datos
const todasLasEstaciones = [...stationsData.stations, ...misPuntosData.stations];
```

---

## 3. Configuración de Simbología y Elementos Gráficos (Frontend)

Finalmente, se debe configurar la representación visual del nuevo conjunto de datos.

**Ruta del archivo:** `frontend/src/features/map/utils/mapConfig.js`

Abra el archivo [mapConfig.js](frontend/src/features/map/utils/mapConfig.js) y modifique los siguientes diccionarios de configuración:

1. **Definición de Ícono:** Localice la constante `typeIcons` e indique la ruta relativa del activo gráfico (imagen PNG o SVG).
   ```javascript
   export const typeIcons = {
     // ...
     'mi_nuevo_tipo': '/src/assets/icons/mi_icono.png',
   };
   ```
2. **Definición de Color:** Localice la función `getPinColor` y asigne un valor hexadecimal para el marcador geométrico en el mapa.
   ```javascript
   export const getPinColor = (type) => {
     const colors = {
       // ...
       'mi_nuevo_tipo': '#FF5733', 
     };
     return colors[type] || '#9CA3AF';
   };
   ```
3. **Definición de Etiqueta Legible:** Localice la función `getReadableType`. Esta función administra las etiquetas presentadas en los elementos UI.
   ```javascript
   export const getReadableType = (type) => {
     const names = {
       // ...
       'mi_nuevo_tipo': 'Nombre del Nuevo Grupo de Puntos',
     };
     return names[type] || 'Desconocido';
   };
   ```

---

## 4. Integración Automática en Leyenda y Filtros

Es de suma importancia destacar que, gracias al diseño de la aplicación, **no se requiere programación adicional** para integrar la nueva información en los componentes interactivos de la interfaz gráfica (UI).

- **Leyenda Interactiva:** El componente `MapLegend.jsx` lee dinámicamente el diccionario `typeIcons` configurado en el Paso 3. Por lo tanto, al registrar un nuevo tipo, el sistema genera automáticamente su propia fila en la leyenda, incorporando su respectivo icono, nombre legible y control de visibilidad (checkbox).
- **Filtro de Capacidad:** Si la consulta de backend envía un valor numérico bajo la propiedad `capacity_mw` (como se configuró en el Paso 2), el filtro desplegable de capacidad (`MapFilter.jsx`) procesará los nuevos marcadores de forma inmediata. Esto les permitirá responder instantáneamente a las condiciones de filtrado por rango de megawatts sin necesidad de modificar lógica condicional alguna.

### ¿Cómo modificar la variable de filtrado?

Si se requiere filtrar el mapa por una variable distinta a la capacidad (por ejemplo: "año de operación", "voltaje", etc.), será necesario realizar ajustes en 3 archivos clave:

1. **En Backend (`backend/api/views.py`):** Modificar el diccionario que se envía al Frontend agregando la nueva variable numérica.
   ```python
   stations.append({
       'name': punto.nombre,
       'lng': str(punto.lng),
       'lat': str(punto.lat),
       'type': 'mi_nuevo_tipo',
       # Se agrega la nueva variable numérica (ej. voltaje)
       'mi_nueva_variable': punto.voltaje 
   })
   ```

2. **En Componente de Filtro (`frontend/src/features/map/components/MapFilter.jsx`):** Ajustar las etiquetas de texto (cambiar la palabra "Capacidad"), y actualizar la constante `RANGES` con los rangos numéricos correspondientes a la nueva métrica.
   ```javascript
   // 1. Cambiar los rangos numéricos y sus etiquetas
   const RANGES = [
     { label: 'Todos', min: 0, max: 99999 },
     { label: '0 - 110 kV', min: 0, max: 110 },
     { label: '110 - 230 kV', min: 110, max: 230 },
     { label: 'Más de 230 kV', min: 230, max: 99999 },
   ];

   // 2. Más abajo, cambiar la etiqueta visual
   <label style={{ fontSize: '14px', fontWeight: 'bold' }}>
     Voltaje:
   </label>
   ```

3. **En Componente del Mapa (`frontend/src/features/map/components/Map3D.jsx`):** Localizar la declaración de renderizado de marcadores (aprox. línea 90) y sustituir la variable `station.capacity_mw` por `station.mi_nueva_variable` dentro de la evaluación matemática del rango.
   ```javascript
   // Antes (buscando por capacidad):
   const inRange = station.capacity_mw >= capacityRange.min && station.capacity_mw <= capacityRange.max;

   // Después (buscando por la nueva variable):
   const inRange = station.mi_nueva_variable >= capacityRange.min && station.mi_nueva_variable <= capacityRange.max;
   ```
   *(Asegúrese de usar ese mismo `inRange` en el condicional que muestra u oculta el marcador).*

---

## Que exportar para ATE



1. **Componente Visual del Mapa (JSX):** `frontend/src/features/map/components/Map3D.jsx` (y el gestor de estado `useMapData.js`).
2. **Modelos ORM de Base de Datos:** `backend/api/models.py`
3. **Enrutador de API:** `backend/api/urls.py`
4. **Controladores de API:** `backend/api/views.py`


