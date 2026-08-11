# DATANASA

Programa para extraer datos climáticos diarios de la **NASA POWER** usando sus
endpoints y asociar cada coordenada con su **departamento, provincia y distrito**
del Perú.

## Endpoints utilizados

| Endpoint | Uso |
| --- | --- |
| `/api/temporal/daily/point` | Datos diarios para un punto (lat, lon) |
| `/api/temporal/daily/area` | Datos diarios para una región (en la API actual la ruta es `/api/temporal/daily/regional`, el programa intenta `/regional` y cae a `/area` si estuviera disponible) |
| `/api/temporal/daily/configuration` | Información de la API (versión, comunidades, cobertura) y metadatos de parámetros |

> La API de área exige un rango de al menos **2 grados** en latitud y longitud,
> un `user` alfanumérico de menos de 15 caracteres y acepta **1 parámetro por petición**
> (el programa recorre cada parámetro automáticamente).

## División administrativa del Perú

Los límites provienen del dataset oficial **OCHA COD-AB** "Peru - Subnational
Administrative Boundaries" (HDX, actualizado en enero de 2026), con la jerarquía
completa:

- **25 departamentos** (`data/peru_departamentos.geojson`)
- **196 provincias** (`data/peru_provincias.geojson`)
- **1873 distritos** (`data/peru_distritos.geojson`)

Cada coordenada se ubica usando `shapely` con índice espacial (STRtree), por lo
que consultas masivas sobre grillas de área son rápidas.

## Instalación

Backend (Python):

```bash
python3 -m pip install -r requirements.txt
```

Frontend (React, requiere Node 18+):

```bash
cd frontend && npm install
```

## Interfaz web (React + FastAPI)

Interfaz **profesional, dinámica y responsive** (tema oscuro "NASA") construida
con **React + Vite** en el frontend y **FastAPI** en el backend.

Levantar en dos terminales:

```bash
# 1. Backend API
uvicorn backend.main:app --reload --port 8000

# 2. Frontend (proxy automático hacia /api)
cd frontend && npm run dev
# abre http://localhost:5173
```

Vistas:

- **📍 Punto** — coordenadas manuales o **clic sobre el mapa** para fijar el
  punto; la geolocalización a departamento/provincia/distrito se actualiza
  **en vivo** (debounce) al mover las coordenadas y los datos consultados ya
  vienen **categorizados** con departamento/provincia/distrito/ubigeo (tabla,
  gráficos y exportación).
- **🗺️ Área** — definida por coordenadas o **dibujando un rectángulo** sobre el
  mapa (leaflet-draw); promedio por fecha y cada punto de la grilla ubicado
  administrativamente.
- **🏛️ División** — extracción por **departamento completo** (todas sus
  provincias), por **provincia** (todos sus distritos) o por **distrito puntual**
  (centroide con mapa). Desplegables encadenados con reseteo automático.
- **📚 Catálogo** — buscador y filtro por categoría sobre las ~40 variables POWER.

La barra lateral comparte el **rango de fechas**, la **frecuencia**
(**Diario / Mensual / Anual** con agregación por **Promedio / Suma / Máximo /
Mínimo**) y el **selector de variables por categorías con checkboxes** (botones
*Todos / Comunes / Limpiar*, chips con unidades), y muestra el estado de la API.
Los resultados se descargan en **CSV** (local) y **Excel** (backend, respetando
frecuencia y agregación elegidas). La interfaz es totalmente **responsive**: en
móvil la barra lateral se convierte en un menú deslizante.

### API (backend)

| Endpoint | Método | Descripción |
| --- | --- | --- |
| `/api/config` | GET | Estado de la API POWER |
| `/api/catalogo` | GET | Catálogo de variables |
| `/api/departamentos` | GET | Lista de departamentos |
| `/api/provincias?departamento=` | GET | Provincias con ubigeo |
| `/api/distritos?departamento=&provincia=` | GET | Distritos con ubigeo |
| `/api/centroide?departamento=&provincia=&distrito=` | GET | Centroide y ubigeo de un distrito |
| `/api/ubicar?lat=&lon=` | GET | Coordenada → departamento/provincia/distrito |
| `/api/punto` | POST | Datos de un punto (frecuencia + agregación) |
| `/api/area` | POST | Datos de una región, grilla ubicada (frecuencia + agregación) |
| `/api/division` | POST | Datos masivos por departamento/provincia/distrito |
| `/api/exportar` | POST | Exporta CSV/Excel (`{formato, tipo, payload, nombre}`) |

Documentación interactiva en http://localhost:8000/docs

## Línea de comandos

```bash
# Datos diarios por coordenada (agrega departamento, provincia y distrito)
python3 main.py punto --lat -12.04 --lon -77.04 --start 20240101 --end 20240131

# Datos diarios para una región (cada punto de la grilla queda ubicado)
python3 main.py area --lat-min -13 --lat-max -11 --lon-min -78 --lon-max -76

# Información de la API y detalle de parámetros
python3 main.py config
python3 main.py config --params T2M,PRECTOTCORR,WS2M,RH2M

# Dada una coordenada, indica departamento, provincia y distrito (sin internet)
python3 main.py ubicar --lat -16.4 --lon -71.54

# Anotar un CSV de coordenadas con departamento, provincia y distrito
python3 main.py ubicar --archivo coords.csv --lat-col latitude --lon-col longitude --csv salida.csv

# Ubicar un distrito y extraer datos en su centroide
python3 main.py distrito AREQUIPA AREQUIPA "CERRO COLORADO" --datos

# Ubicar una provincia y extraer datos en su centroide
python3 main.py provincia LIMA HUAROCHIRI --datos

# Listar provincias de un departamento con sus centroides
python3 main.py departamento PUNO

# Listar y extraer datos de todas las provincias de un departamento
python3 main.py departamento CUSCO --datos
```

### Opciones comunes

- `--params T2M,PRECTOTCORR,...` — variables (por defecto: `T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M,RH2M,ALLSKY_SFC_SW_DWN`)
- `--start YYYYMMDD --end YYYYMMDD` — rango de fechas (por defecto: el último año)
- `--community AG|RE|SB` — comunidad POWER (AG = agrícola)
- `--csv archivo.csv --excel archivo.xlsx` — exportar resultados
- `--pausa N` — segundos de espera entre provincias en `departamento --datos`

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

## Estructura

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

## Fuentes de datos

- NASA POWER API: https://power.larc.nasa.gov/docs/
- OCHA COD-AB Perú (límites administrativos oficiales): https://data.humdata.org/dataset/cod-ab-per
