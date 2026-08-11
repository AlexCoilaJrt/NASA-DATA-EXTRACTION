"""Geolocalización de coordenadas en departamento, provincia y distrito del Perú.

Fuente de datos: OCHA COD-AB (Perú - Subnational Administrative Boundaries),
dataset oficial de límites administrativos actualizado (HDX, enero 2026), con
jerarquía departamento → provincia → distrito e ubigeo (p-codes PE).

Archivos usados:
  - data/peru_departamentos.geojson  (25 departamentos)
  - data/peru_provincias.geojson     (196 provincias)
  - data/peru_distritos.geojson      (1873 distritos)
"""

import json
import os

from shapely.geometry import Point, shape
from shapely.strtree import STRtree

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

FILES = {
    "departamentos": "peru_departamentos.geojson",
    "provincias": "peru_provincias.geojson",
    "distritos": "peru_distritos.geojson",
}


class PeruGeocoder:
    """Asocia coordenadas (lat, lon) con departamento, provincia y distrito del Perú."""

    def __init__(self, data_dir=DATA_DIR):
        self.data_dir = data_dir
        self.departamentos = self._load("departamentos")
        self.provincias = self._load("provincias")
        self.distritos = self._load("distritos")
        self._tree = STRtree([f["geometry"] for f in self.distritos])

    # ------------------------------------------------------------------ #
    # carga
    # ------------------------------------------------------------------ #
    def _load(self, level):
        path = os.path.join(self.data_dir, FILES[level])
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"No se encontró {path}. Descarga los límites desde "
                "https://data.humdata.org/dataset/cod-ab-per"
            )
        with open(path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)

        features = []
        for feature in payload["features"]:
            props = feature.get("properties", {})
            name = props.get("adm1_name") or props.get("adm2_name") or props.get("adm3_name")
            if not name:
                continue
            features.append({
                "departamento": (props.get("adm1_name") or "").strip(),
                "provincia": (props.get("adm2_name") or "").strip(),
                "distrito": (props.get("adm3_name") or "").strip(),
                "ubigeo": self._ubigeo(
                    props.get("adm3_pcode") or props.get("adm2_pcode")
                    or props.get("adm1_pcode") or ""
                ),
                "geometry": shape(feature["geometry"]),
                "centroid": self._centroid(props, feature["geometry"]),
            })
        return features

    @staticmethod
    def _ubigeo(pcode):
        return (pcode or "").replace("PE", "").strip()

    @staticmethod
    def _centroid(props, geometry):
        try:
            cx = float(props.get("center_lon"))
            cy = float(props.get("center_lat"))
            return Point(cx, cy)
        except (TypeError, ValueError):
            return shape(geometry).centroid

    # ------------------------------------------------------------------ #
    # listados y búsqueda por nombre
    # ------------------------------------------------------------------ #
    def nombres_departamentos(self):
        return sorted({f["departamento"] for f in self.provincias})

    def buscar(self, departamento=None, provincia=None, distrito=None):
        """Filtra la división por departamento/provincia/distrito (coincidencia parcial)."""
        dep = (departamento or "").upper()
        prov = (provincia or "").upper()
        dis = (distrito or "").upper()

        pool = self.distritos if distrito else self.provincias
        results = []
        for f in pool:
            if dep and dep not in f["departamento"].upper():
                continue
            if prov and prov not in f["provincia"].upper():
                continue
            if dis and dis not in f["distrito"].upper():
                continue
            results.append(f)
        return results

    def provincias_de(self, departamento):
        """Provincias de un departamento (una entrada por provincia)."""
        dep = (departamento or "").upper()
        seen = {}
        for f in self.provincias:
            if f["departamento"].upper() == dep:
                seen[f["ubigeo"]] = f
        return sorted(seen.values(), key=lambda f: f["provincia"])

    def distritos_de(self, departamento, provincia=None):
        """Distritos de un departamento/provincia."""
        dep = (departamento or "").upper()
        prov = (provincia or "").upper()
        result = []
        for f in self.distritos:
            if f["departamento"].upper() != dep:
                continue
            if prov and f["provincia"].upper() != prov:
                continue
            if not f["distrito"]:
                continue
            result.append(f)
        return sorted(result, key=lambda f: f["distrito"])

    # ------------------------------------------------------------------ #
    # geolocalización
    # ------------------------------------------------------------------ #
    def ubicar(self, latitude, longitude):
        """Devuelve departamento/provincia/distrito/ubigeo o None si la
        coordenada está fuera del territorio peruano."""
        point = Point(longitude, latitude)
        for idx in self._tree.query(point):
            feature = self.distritos[idx]
            geom = feature["geometry"]
            if geom.contains(point) or geom.touches(point):
                return self._result(feature)
        return None

    def anotar(self, df, latitude="latitude", longitude="longitude"):
        """Agrega columnas departamento/provincia/distrito/ubigeo a un DataFrame."""
        df = df.copy()
        df["departamento"] = None
        df["provincia"] = None
        df["distrito"] = None
        df["ubigeo"] = None
        for index, row in df.iterrows():
            result = self.ubicar(row[latitude], row[longitude])
            if result:
                for col, key in (("departamento", "departamento"),
                                 ("provincia", "provincia"),
                                 ("distrito", "distrito"),
                                 ("ubigeo", "ubigeo")):
                    df.at[index, col] = result[key]
        return df

    @staticmethod
    def _result(f):
        return {
            "departamento": f["departamento"],
            "provincia": f["provincia"],
            "distrito": f["distrito"],
            "ubigeo": f["ubigeo"],
        }
