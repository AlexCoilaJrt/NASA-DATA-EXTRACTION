"""API FastAPI de DATANASA: datos climáticos NASA POWER geolocalizados en el Perú.

Ejecutar (desde la raíz del proyecto):
    uvicorn backend.main:app --reload --port 8000
"""

import io
import json
import os
import time

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.geopery import PeruGeocoder
from backend.nasa_power import NasaPowerClient

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

FRECUENCIAS = {"diario", "mensual", "anual"}
FUNCIONES = {"promedio": "mean", "suma": "sum", "maximo": "max", "minimo": "min"}

app = FastAPI(title="DATANASA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8500"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cliente = NasaPowerClient()
_geocoder = None


def geocoder():
    global _geocoder
    if _geocoder is None:
        _geocoder = PeruGeocoder(DATA_DIR)
    return _geocoder


def _catalogo():
    with open(os.path.join(DATA_DIR, "catalogo.json"), "r", encoding="utf-8") as fh:
        return json.load(fh)


def _fechas(inicio, fin):
    """Acepta YYYY-MM-DD o YYYYMMDD y normaliza al formato de POWER."""
    return inicio.replace("-", ""), fin.replace("-", "")


def _frame_a_json(df):
    datos = df.copy()
    if "date" in datos.columns:
        datos["date"] = pd.to_datetime(datos["date"]).dt.strftime("%Y-%m-%d")
    return json.loads(datos.to_json(orient="records", date_format="iso"))


def _anotar_ubicacion(df, lat, lon):
    """Agrega departamento/provincia/distrito/ubigeo al DataFrame de un punto."""
    df = df.copy()
    r = geocoder().ubicar(lat, lon) or {}
    for col in ("departamento", "provincia", "distrito", "ubigeo"):
        df[col] = r.get(col, "")
    orden = ["date", "departamento", "provincia", "distrito", "ubigeo"]
    return df[orden + [c for c in df.columns if c not in orden]]


def _agregar(df, frecuencia, agregacion, params, por_celda=False):
    """Agrupa por período (mensual/anual) aplicando la función de agregación."""
    if frecuencia == "diario":
        return df.copy()
    func = FUNCIONES.get(agregacion)
    if func is None:
        raise HTTPException(status_code=400, detail="agregacion debe ser promedio|suma|maximo|minimo")
    d = df.copy()
    fecha = pd.to_datetime(d["date"])
    claves = []
    if frecuencia == "mensual":
        d["__periodo__"] = fecha.dt.strftime("%Y-%m")
    else:
        d["__periodo__"] = fecha.dt.strftime("%Y")
    claves.append("__periodo__")
    if por_celda:
        claves += ["longitude", "latitude"]
    num_cols = [c for c in params if c in d.columns]
    agg = {c: func for c in num_cols}
    if not por_celda:
        for c in d.columns:
            if c not in claves and c not in num_cols and c != "date":
                agg[c] = "first"
    res = d.groupby(claves, as_index=False).agg(agg)
    res.rename(columns={"__periodo__": "date"}, inplace=True)
    orden = ["date"] + [c for c in d.columns if c not in ("date", "__periodo__")]
    return res[[c for c in orden if c in res.columns]]


def _datos_division(departamento, provincia, distrito, params, inicio, fin, frecuencia, agregacion):
    """Extrae datos de todas las provincias (o distritos) de la selección."""
    g = geocoder()
    if distrito:
        unidades = [f for f in g.distritos_de(departamento, provincia) if f["distrito"] == distrito]
        nivel = "distrito"
    elif provincia:
        unidades = g.distritos_de(departamento, provincia)
        nivel = "distrito"
    else:
        unidades = g.provincias_de(departamento)
        nivel = "provincia"
    if not unidades:
        raise HTTPException(status_code=404, detail="Sin unidades para la selección")

    marcos = []
    for u in unidades:
        try:
            df = _cliente.point(u["centroid"].y, u["centroid"].x, params, inicio, fin)
        except Exception:
            continue
        df = _agregar(df, frecuencia, agregacion, params)
        df["departamento"] = departamento
        if nivel == "provincia":
            df["provincia"] = u["provincia"]
            df["distrito"] = ""
        else:
            df["provincia"] = u["provincia"]
            df["distrito"] = u["distrito"]
        df["ubigeo"] = u["ubigeo"]
        marcos.append(df)
        time.sleep(0.2)
    if not marcos:
        raise HTTPException(status_code=502, detail="No se obtuvieron datos de la API NASA")
    return pd.concat(marcos, ignore_index=True)


class PuntoQuery(BaseModel):
    lat: float
    lon: float
    params: list[str] = Field(min_length=1)
    start: str
    end: str
    frecuencia: str = "diario"
    agregacion: str = "promedio"


class AreaQuery(BaseModel):
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    params: list[str] = Field(min_length=1)
    start: str
    end: str
    frecuencia: str = "diario"
    agregacion: str = "promedio"


class DivisionQuery(BaseModel):
    departamento: str
    provincia: str | None = None
    distrito: str | None = None
    params: list[str] = Field(min_length=1)
    start: str
    end: str
    frecuencia: str = "diario"
    agregacion: str = "promedio"


class ExportQuery(BaseModel):
    formato: str = "csv"
    tipo: str
    payload: dict
    nombre: str = "datos"


# --------------------------------------------------------------------------- #
#  utilidades
# --------------------------------------------------------------------------- #
@app.get("/api/config")
def config():
    try:
        return _cliente.configuration(timeout=15)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="No se pudo contactar la API NASA POWER") from exc


@app.get("/api/catalogo")
def catalogo():
    return _catalogo()


@app.get("/api/departamentos")
def departamentos():
    return geocoder().nombres_departamentos()


@app.get("/api/provincias")
def provincias(departamento: str):
    return [
        {"provincia": f["provincia"], "ubigeo": f["ubigeo"]}
        for f in geocoder().provincias_de(departamento)
    ]


@app.get("/api/distritos")
def distritos(departamento: str, provincia: str | None = None):
    return [
        {"distrito": f["distrito"], "ubigeo": f["ubigeo"]}
        for f in geocoder().distritos_de(departamento, provincia)
    ]


@app.get("/api/centroide")
def centroide(departamento: str, provincia: str, distrito: str):
    for f in geocoder().distritos_de(departamento, provincia):
        if f["distrito"] == distrito:
            return {"lat": f["centroid"].y, "lon": f["centroid"].x, "ubigeo": f["ubigeo"]}
    raise HTTPException(status_code=404, detail="Distrito no encontrado")


@app.get("/api/ubicar")
def ubicar(lat: float, lon: float):
    return geocoder().ubicar(lat, lon)


# --------------------------------------------------------------------------- #
#  consultas de datos
# --------------------------------------------------------------------------- #
@app.post("/api/punto")
def punto(q: PuntoQuery):
    inicio, fin = _fechas(q.start, q.end)
    df = _cliente.point(q.lat, q.lon, q.params, inicio, fin)
    df = _agregar(df, q.frecuencia, q.agregacion, q.params)
    df = _anotar_ubicacion(df, q.lat, q.lon)
    return {"datos": _frame_a_json(df)}


@app.post("/api/area")
def area(q: AreaQuery):
    if q.lat_min >= q.lat_max or q.lon_min >= q.lon_max:
        raise HTTPException(status_code=400, detail="Coordenadas mínimas deben ser menores que las máximas")
    if (q.lat_max - q.lat_min) < 2 or (q.lon_max - q.lon_min) < 2:
        raise HTTPException(status_code=400, detail="El rango debe ser de al menos 2° en latitud y longitud")
    inicio, fin = _fechas(q.start, q.end)
    df = _cliente.area(q.lat_min, q.lat_max, q.lon_min, q.lon_max, q.params, inicio, fin)
    df = _agregar(df, q.frecuencia, q.agregacion, q.params, por_celda=True)
    df = geocoder().anotar(df)
    return {"datos": _frame_a_json(df)}


@app.post("/api/division")
def division(q: DivisionQuery):
    inicio, fin = _fechas(q.start, q.end)
    df = _datos_division(q.departamento, q.provincia, q.distrito, q.params, inicio, fin, q.frecuencia, q.agregacion)
    return {"datos": _frame_a_json(df), "unidades": int(df["provincia"].nunique() if q.provincia is None else df["distrito"].nunique())}


# --------------------------------------------------------------------------- #
#  exportación (Excel/CSV)
# --------------------------------------------------------------------------- #
@app.post("/api/exportar")
def exportar(q: ExportQuery):
    payload = dict(q.payload)
    frecuencia = payload.pop("frecuencia", "diario")
    agregacion = payload.pop("agregacion", "promedio")
    if frecuencia not in FRECUENCIAS:
        raise HTTPException(status_code=400, detail="frecuencia debe ser diario|mensual|anual")

    if q.tipo == "punto":
        p = PuntoQuery(**payload, frecuencia=frecuencia, agregacion=agregacion)
        inicio, fin = _fechas(p.start, p.end)
        df = _cliente.point(p.lat, p.lon, p.params, inicio, fin)
        df = _agregar(df, p.frecuencia, p.agregacion, p.params)
        df = _anotar_ubicacion(df, p.lat, p.lon)
    elif q.tipo == "area":
        a = AreaQuery(**payload, frecuencia=frecuencia, agregacion=agregacion)
        inicio, fin = _fechas(a.start, a.end)
        df = _cliente.area(a.lat_min, a.lat_max, a.lon_min, a.lon_max, a.params, inicio, fin)
        df = _agregar(df, a.frecuencia, a.agregacion, a.params, por_celda=True)
        df = geocoder().anotar(df)
    elif q.tipo == "division":
        d = DivisionQuery(**payload, frecuencia=frecuencia, agregacion=agregacion)
        inicio, fin = _fechas(d.start, d.end)
        df = _datos_division(d.departamento, d.provincia, d.distrito, d.params, inicio, fin, d.frecuencia, d.agregacion)
    else:
        raise HTTPException(status_code=400, detail="tipo debe ser 'punto', 'area' o 'division'")

    if q.formato == "xlsx":
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False, engine="openpyxl")
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        nombre = f"{q.nombre}.xlsx"
        datos = buffer.getvalue()
    else:
        datos = df.to_csv(index=False).encode("utf-8-sig")
        media = "text/csv"
        nombre = f"{q.nombre}.csv"

    from fastapi.responses import Response
    return Response(
        content=datos,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
