# DATANASA

Sistema para extraer datos climáticos diarios de la **NASA POWER** y asociar cada coordenada con su **departamento, provincia y distrito** del Perú (con ubigeo).

Cuenta con tres formas de uso:

- **🌐 Interfaz web** — aplicación responsive con mapas, gráficos y exportación (React + FastAPI).
- **🔌 API REST** — endpoints JSON consumibles desde cualquier programa.
- **⌨️ Línea de comandos** — scripts directos en Python.

---

## Tabla de contenidos

- [Características](#características)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Inicio rápido](#inicio-rápido)
  - [Interfaz web](#interfaz-web)
  - [API REST](#api-rest)
  - [Línea de comandos](#línea-de-comandos)
- [Documentación de la API](#documentación-de-la-api)
- [Uso desde otros programas](#uso-desde-otros-programas)
- [Variables climáticas comunes (NASA POWER)](#variables-climáticas-comunes-nasa-power)
- [División administrativa del Perú](#división-administrativa-del-perú)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Fuentes de datos](#fuentes-de-datos)

---

## Características

- **Ubicación administrativa automática**: cada coordenada se geolocaliza en departamento, provincia y distrito con ubigeo, usando `shapely` con índice espacial (STRtree). Rápido incluso en grillas grandes.
- **Tres modos de consulta**:
  - **Punto** — coordenada (lat, lon).
  - **Área** — rectángulo (lat/lon mín/máx) que devuelve todos los puntos de la grilla ubicados administrativamente.
  - **División** — datos masivos por **departamento** (todas sus provincias), por **provincia** (todos sus distritos) o por **distrito puntual** (centroide).
- **Frecuencias y agregaciones**: **diario / mensual / anual** con agregación por **promedio / suma / máximo / mínimo**.
- **Catálogo de ~40 variables** POWER agrupadas por categoría.
- **Exportación a CSV y Excel** de los resultados.
- **Interfaz responsive** con tema oscuro "NASA", mapa interactivo (clic / dibujo de rectángulo con leaflet-draw) y gráficos.
- **Documentación interactiva** de la API en `/docs` (Swagger).

### Endpoints de la NASA POWER utilizados

| Endpoint | Uso |
| --- | --- |
| `/api/temporal/daily/point` | Datos diarios para un punto (lat, lon) |
| `/api/temporal/daily/area` | Datos diarios para una región. La API actual usa `/api/temporal/daily/regional`; el programa intenta `/regional` y cae automáticamente a `/area` (404) |
| `/api/temporal/daily/configuration` | Información de la API (versión, comunidades, cobertura) y metadatos de parámetros |

> La API de área exige un rango de al menos **2 grados** en latitud y longitud,
> un `user` alfanumérico de **menos de 15 caracteres** y acepta **1 parámetro por
> petición** (el programa recorre cada parámetro automáticamente y luego los
> combina en un solo DataFrame).

> Los valores de relleno de la NASA (`-999.0`) se convierten a `null`/vacío.

---

## Requisitos

| Componente | Requerimiento |
| --- | --- |
| Python | 3.9+ |
| Node.js | 18+ (solo para el frontend) |
| Internet | solo para consultar la NASA POWER (la geolocalización es 100% local) |

---

## Instalación

**Backend (Python):**

```bash
pip install -r requirements.txt
```

**Frontend (React, opcional):**

```bash
cd frontend && npm install
```

---

## Inicio rápido

### Interfaz web

Levantar en dos terminales:

```bash
# 1. Backend API
uvicorn backend.main:app --reload --port 8000

# 2. Frontend (proxy automático hacia /api)
cd frontend && npm run dev
# abre http://localhost:5173
```

Vistas de la interfaz:

- **📍 Punto** — coordenadas manuales o **clic sobre el mapa**; la ubicación administrativa se actualiza **en vivo** al mover las coordenadas. Los datos consultados vienen categorizados con departamento/provincia/distrito/ubigeo (tabla, gráficos y exportación).
- **🗺️ Área** — definida por coordenadas o **dibujando un rectángulo** sobre el mapa; promedio por fecha y cada punto de la grilla ubicado administrativamente.
- **🏛️ División** — extracción por **departamento completo** (todas sus provincias), por **provincia** (todos sus distritos) o por **distrito puntual** (centroide con mapa). Desplegables encadenados con reseteo automático.
- **📚 Catálogo** — buscador y filtro por categoría sobre las ~40 variables POWER.

La barra lateral comparte el **rango de fechas**, la **frecuencia** (Diario/Mensual/Anual con agregación por Promedio/Suma/Máximo/Mínimo), el **selector de variables por categorías** (botones *Todos / Comunes / Limpiar*, chips con unidades) y el **estado de la API**. En móvil la barra se convierte en un menú deslizante. Los resultados se descargan en **CSV** (local) y **Excel** (backend, respetando frecuencia y agregación elegidas).

### API REST

El backend **ya es** una API REST. Con el backend levantado en `http://localhost:8000`, cualquier programa la puede consumir:

```bash
curl -X POST "http://localhost:8000/api/punto" \
  -H "Content-Type: application/json" \
  -d '{"lat":-12.04,"lon":-77.04,"start":"2024-01-01","end":"2024-01-31","params":["T2M","PRECTOTCORR"]}'
```

Ejemplo en Python:

```python
import requests

r = requests.post("http://localhost:8000/api/punto", json={
    "lat": -12.04, "lon": -77.04,
    "start": "2024-01-01", "end": "2024-01-31",
    "params": ["T2M", "PRECTOTCORR"],
    "frecuencia": "diario",   # opcional: diario | mensual | anual
    "agregacion": "promedio", # opcional: promedio | suma | maximo | minimo
})
print(r.json())
```

> **Para compartirla en una red local** (otras máquinas), levántala con
> `--host 0.0.0.0`:
>
> ```bash
> uvicorn backend.main:app --host 0.0.0.0 --port 8000
> # la otra persona accede desde: http://<IP_DE_TU_MÁQUINA>:8000
> ```
>
> Nota: el CORS por defecto solo permite orígenes locales (`localhost:5173`,
> `127.0.0.1:5173`, `localhost:8500`). Para consumo desde otras aplicaciones web
> o para publicarla, hay que ampliar `allow_origins` en `backend/main.py:29`.

Documentación interactiva en http://localhost:8000/docs

### Línea de comandos

```bash
# Datos diarios por coordenada (agrega departamento, provincia y distrito)
python main.py punto --lat -12.04 --lon -77.04 --start 20240101 --end 20240131

# Datos diarios para una región (cada punto de la grilla queda ubicado)
python main.py area --lat-min -13 --lat-max -11 --lon-min -78 --lon-max -76

# Información de la API y detalle de parámetros
python main.py config
python main.py config --params T2M,PRECTOTCORR,WS2M,RH2M

# Dada una coordenada, indica departamento, provincia y distrito (sin internet)
python main.py ubicar --lat -16.4 --lon -71.54

# Anotar un CSV de coordenadas con departamento, provincia y distrito
python main.py ubicar --archivo coords.csv --lat-col latitude --lon-col longitude --csv salida.csv

# Ubicar un distrito y extraer datos en su centroide
python main.py distrito AREQUIPA AREQUIPA "CERRO COLORADO" --datos

# Ubicar una provincia y extraer datos en su centroide
python main.py provincia LIMA HUAROCHIRI --datos

# Listar provincias de un departamento con sus centroides
python main.py departamento PUNO

# Listar y extraer datos de todas las provincias de un departamento
python main.py departamento CUSCO --datos
```

#### Referencia de comandos

| Comando | Descripción | Opciones |
| --- | --- | --- |
| `punto` | Datos diarios por coordenada | `--lat`, `--lon` (obligatorios) + opciones comunes |
| `area` | Datos diarios por región (grilla) | `--lat-min`, `--lat-max`, `--lon-min`, `--lon-max` (obligatorios) + opciones comunes |
| `config` | Parámetros disponibles en la API | `--params`, `--lat`, `--lon` (opcional) |
| `ubicar` | Coordenada → departamento/provincia/distrito | `--lat`, `--lon` **o** `--archivo` (+ `--lat-col`, `--lon-col`, `--csv`) |
| `distrito` | Ubica un distrito y opcionalmente extrae sus datos | `departamento [provincia [distrito]]` + `--datos` + opciones comunes |
| `provincia` | Ubica una provincia y opcionalmente extrae sus datos | `departamento [provincia]` + `--datos` + opciones comunes |
| `departamento` | Lista las provincias de un departamento (y opcionalmente extrae sus datos) | `departamento` + `--datos`, `--pausa` + opciones comunes |

#### Opciones comunes (`punto`, `area`, `distrito`, `provincia`, `departamento --datos`)

- `--params T2M,PRECTOTCORR,...` — variables separadas por comas (por defecto: `T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M,RH2M,ALLSKY_SFC_SW_DWN`)
- `--start YYYYMMDD --end YYYYMMDD` — rango de fechas (por defecto: los últimos 12 meses hasta hoy)
- `--csv archivo.csv --excel archivo.xlsx` — exportar resultados
- `--pausa N` — segundos de espera entre provincias en `departamento --datos` (por defecto: 1.0)

#### Opciones globales (antes del subcomando)

- `--community AG|RE|SB` — comunidad POWER: **AG** = agrícola, **RE** = renovable, **SB** = edificios (por defecto: `AG`)
- `--user NOMBRE` — identificador para la API de área (alfanumérico, < 15 caracteres; por defecto: `datansa`)

---

## Documentación de la API

### Endpoints

| Endpoint | Método | Descripción |
| --- | --- | --- |
| `/api/config` | GET | Estado de la API POWER (versión, comunidades, cobertura) |
| `/api/catalogo` | GET | Catálogo de variables POWER |
| `/api/departamentos` | GET | Lista de los 25 departamentos |
| `/api/provincias?departamento=` | GET | Provincias con ubigeo de un departamento |
| `/api/distritos?departamento=&provincia=` | GET | Distritos con ubigeo (provincia opcional) |
| `/api/centroide?departamento=&provincia=&distrito=` | GET | Centroide y ubigeo de un distrito |
| `/api/ubicar?lat=&lon=` | GET | Coordenada → departamento/provincia/distrito/ubigeo |
| `/api/punto` | POST | Datos de un punto (frecuencia + agregación) |
| `/api/area` | POST | Datos de una región, grilla ubicada (frecuencia + agregación) |
| `/api/division` | POST | Datos masivos por departamento/provincia/distrito |
| `/api/exportar` | POST | Descarga CSV/Excel de un punto, área o división |

### Cuerpos de petición (POST)

**`/api/punto`** — `PuntoQuery`

```json
{
  "lat": -12.04,
  "lon": -77.04,
  "params": ["T2M", "PRECTOTCORR"],
  "start": "2024-01-01",
  "end": "2024-01-31",
  "frecuencia": "diario",
  "agregacion": "promedio"
}
```

- `params` — lista de variables (obligatorio, mínimo 1). Acepta nombres en cualquier formato, se convierten a mayúsculas.
- `start` / `end` — acepta `YYYY-MM-DD` o `YYYYMMDD`.
- `frecuencia` — `diario` | `mensual` | `anual` (por defecto: `diario`).
- `agregacion` — `promedio` | `suma` | `maximo` | `minimo` (por defecto: `promedio`).

Respuesta: `{"datos": [ ...filas con date, departamento, provincia, distrito, ubigeo, variables... ]}`

**`/api/area`** — `AreaQuery`

```json
{
  "lat_min": -13,
  "lat_max": -11,
  "lon_min": -78,
  "lon_max": -76,
  "params": ["T2M"],
  "start": "2024-01-01",
  "end": "2024-01-31",
  "frecuencia": "diario",
  "agregacion": "promedio"
}
```

- El rango debe ser de al menos **2°** en latitud y longitud (400 si es menor).
- Las coordenadas mínimas deben ser menores que las máximas (400).
- Respuesta: cada fila incluye `longitude`, `latitude` + ubicación administrativa.

**`/api/division`** — `DivisionQuery`

```json
{
  "departamento": "AREQUIPA",
  "provincia": "AREQUIPA",
  "distrito": null,
  "params": ["T2M"],
  "start": "2024-01-01",
  "end": "2024-01-31",
  "frecuencia": "diario",
  "agregacion": "promedio"
}
```

- Sin `provincia` → todas las provincias del departamento.
- Con `provincia` pero sin `distrito` → todos los distritos de la provincia.
- Con `distrito` → solo ese distrito (centroide).
- Respuesta: `{"datos": [...], "unidades": N}` donde `unidades` es el número de provincias o distritos consultados.

**`/api/exportar`** — `ExportQuery`

```json
{
  "formato": "csv",
  "tipo": "punto",
  "payload": { "lat": -12.04, "lon": -77.04, "params": ["T2M"], "start": "2024-01-01", "end": "2024-01-31" },
  "nombre": "datos"
}
```

- `formato` — `csv` | `xlsx` (CSV con codificación UTF-8-BOM para Excel).
- `tipo` — `punto` | `area` | `division`; `payload` debe contener los campos de la consulta correspondiente.
- `frecuencia` y `agregacion` pueden ir dentro de `payload`.
- Respuesta: archivo descargable (headers `Content-Disposition: attachment`).

### Respuestas de error

| Código | Caso |
| --- | --- |
| 400 | Parámetros inválidos (rango < 2°, coordenadas mal ordenadas, frecuencia/agregación/tipo incorrectos) |
| 404 | Unidad administrativa no encontrada / sin unidades para la selección |
| 502 | La API NASA no devolvió datos para ninguna unidad |
| 503 | No se pudo contactar la API NASA POWER (`/api/config`) |

---

## Uso desde otros programas

La API se puede consumir desde cualquier lenguaje. Ejemplos:

**Python (requests):**

```python
import requests

r = requests.post("http://localhost:8000/api/area", json={
    "lat_min": -13, "lat_max": -11, "lon_min": -78, "lon_max": -76,
    "params": ["T2M"], "start": "2024-01-01", "end": "2024-01-31"
})
for fila in r.json()["datos"][:5]:
    print(fila)
```

**Ubicación de una coordenada (GET):**

```bash
curl "http://localhost:8000/api/ubicar?lat=-16.4&lon=-71.54"
# {"departamento":"Arequipa","provincia":"Arequipa","distrito":"Arequipa","ubigeo":"040101"}
```

**Descargar Excel:**

```bash
curl -X POST "http://localhost:8000/api/exportar" \
  -H "Content-Type: application/json" \
  -d '{"formato":"xlsx","tipo":"punto","payload":{"lat":-12.04,"lon":-77.04,"params":["T2M"],"start":"2024-01-01","end":"2024-01-31"}}' \
  --output datos.xlsx
```

**Desde Excel** — con *Power Query* (Obtener datos > Desde JSON) apuntando a `http://localhost:8000/api/config` o a cualquier endpoint.

---

## Variables climáticas comunes (NASA POWER)

| Parámetro | Descripción | Unidad |
| --- | --- | --- |
| `T2M` | Temperatura a 2 m | °C |
| `T2M_MAX` | Temperatura máxima diaria a 2 m | °C |
| `T2M_MIN` | Temperatura mínima diaria a 2 m | °C |
| `PRECTOTCORR` | Precipitación corregida | mm/día |
| `WS2M` | Velocidad del viento a 2 m | m/s |
| `RH2M` | Humedad relativa a 2 m | % |
| `ALLSKY_SFC_SW_DWN` | Radiación solar de superficie | kWh/m²/día |

> El catálogo completo (~40 variables con categoría y unidad) está en
> `backend/data/catalogo.json` y se consulta en `/api/catalogo`.

---

## División administrativa del Perú

Los límites provienen del dataset oficial **OCHA COD-AB** "Peru - Subnational Administrative Boundaries" (HDX, actualizado en enero de 2026), con la jerarquía completa:

- **25 departamentos** (`backend/data/peru_departamentos.geojson`)
- **196 provincias** (`backend/data/peru_provincias.geojson`)
- **1873 distritos** (`backend/data/peru_distritos.geojson`)

Cada coordenada se ubica con `shapely` + índice espacial (STRtree), lo que hace rápidas las consultas masivas sobre grillas de área. Las coordenadas fuera del territorio peruano se marcan como "fuera" (sin ubicación administrativa).

---

## Estructura del proyecto

```
DATANASA/
  main.py                 # interfaz de línea de comandos
  requirements.txt        # dependencias del backend (Python)
  backend/                # API FastAPI
    main.py               #   endpoints y lógica de la API
    nasa_power.py         #   cliente de la API NASA POWER
    geopery.py            #   geolocalización lat/lon → departamento, provincia y distrito
    data/
      catalogo.json               # ~40 variables POWER con categoría y unidad
      peru_departamentos.geojson  # 25 departamentos (OCHA)
      peru_provincias.geojson     # 196 provincias (OCHA)
      peru_distritos.geojson      # 1873 distritos (OCHA)
  frontend/               # interfaz web (React + Vite)
    package.json
    vite.config.js        #   proxy /api → backend:8000
    src/
      App.jsx             #   estado global y rutas de vista
      api.js              #   cliente de la API
      estilos.css         #   tema oscuro responsive
      componentes/        #   Sidebar, Mapa, Grafico, Tabla, Descargas
      vistas/             #   Punto, Area, Division, Catalogo
```

---

## Fuentes de datos

- NASA POWER API: https://power.larc.nasa.gov/docs/
- OCHA COD-AB Perú (límites administrativos oficiales): https://data.humdata.org/dataset/cod-ab-per
