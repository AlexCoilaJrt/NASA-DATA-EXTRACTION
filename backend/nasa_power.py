"""Cliente para la API NASA POWER (datos climáticos diarios).

Endpoints usados:
  - /api/temporal/daily/point         datos diarios para un punto (lat, lon)
  - /api/temporal/daily/area          datos diarios para un área (en la API actual
                                      la ruta es /api/temporal/daily/regional, con
                                      fallback automático a /area)
  - /api/temporal/daily/configuration metadatos de los parámetros disponibles

Documentación: https://power.larc.nasa.gov/docs/
"""

import pandas as pd
import requests

POWER_API = "https://power.larc.nasa.gov/api"
FILL_VALUE = -999.0
DEFAULT_USER = "datansa"

COMMUNITIES = ("AG", "RE", "SB")


class NasaPowerClient:
    """Cliente para extraer datos diarios de la API NASA POWER."""

    def __init__(self, community="AG", user=DEFAULT_USER):
        if community not in COMMUNITIES:
            raise ValueError(f"community debe ser uno de {COMMUNITIES}")
        self.community = community
        self.user = user
        self.session = requests.Session()

    # ------------------------------------------------------------------ #
    # /api/temporal/daily/configuration
    # ------------------------------------------------------------------ #
    def configuration(self, parameters=None, timeout=60):
        """Metadatos de los parámetros disponibles (longname, unidades, descripción)."""
        params = {"community": self.community, "format": "JSON"}
        if parameters:
            params["parameters"] = ",".join(parameters)
        resp = self.session.get(
            f"{POWER_API}/temporal/daily/configuration", params=params, timeout=timeout
        )
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------ #
    # /api/temporal/daily/point
    # ------------------------------------------------------------------ #
    def point(self, latitude, longitude, parameters, start, end):
        """Datos diarios para una coordenada. Devuelve un DataFrame."""
        params = {
            "parameters": ",".join(parameters),
            "latitude": latitude,
            "longitude": longitude,
            "start": start,
            "end": end,
            "community": self.community,
            "format": "JSON",
        }
        resp = self.session.get(
            f"{POWER_API}/temporal/daily/point", params=params, timeout=180
        )
        resp.raise_for_status()
        return self._point_to_frame(resp.json())

    @staticmethod
    def _point_to_frame(payload):
        coords = payload["geometry"]["coordinates"]
        lon, lat = coords[0], coords[1]
        elevation = coords[2] if len(coords) > 2 else None

        series = payload["properties"]["parameter"]  # {param: {fecha: valor}}
        dates = set()
        for values in series.values():
            dates.update(values.keys())

        rows = []
        for date in sorted(dates):
            row = {
                "date": pd.to_datetime(date, format="%Y%m%d"),
                "longitude": lon,
                "latitude": lat,
                "elevation": elevation,
            }
            for param, values in series.items():
                value = values.get(date)
                if value is not None and float(value) == FILL_VALUE:
                    value = None
                row[param] = value
            rows.append(row)
        return pd.DataFrame(rows)

    # ------------------------------------------------------------------ #
    # /api/temporal/daily/area  (actual: /api/temporal/daily/regional)
    # ------------------------------------------------------------------ #
    def area(self, latitude_min, latitude_max, longitude_min, longitude_max,
             parameters, start, end):
        """Datos diarios para una región. Devuelve un DataFrame con una fila
        por fecha y punto de la grilla. La API regional solo permite un
        parámetro por petición, así que se recorre cada uno."""
        long_frames = []
        for parameter in parameters:
            params = {
                "parameters": parameter,
                "latitude-min": latitude_min,
                "latitude-max": latitude_max,
                "longitude-min": longitude_min,
                "longitude-max": longitude_max,
                "start": start,
                "end": end,
                "community": self.community,
                "format": "JSON",
                "user": self.user,
            }
            resp = self.session.get(
                f"{POWER_API}/temporal/daily/regional", params=params, timeout=300
            )
            if resp.status_code == 404:
                resp = self.session.get(
                    f"{POWER_API}/temporal/daily/area", params=params, timeout=300
                )
            resp.raise_for_status()
            long_frames.append(self._area_to_long(resp.json()))

        if not long_frames:
            return pd.DataFrame()

        long_df = pd.concat(long_frames, ignore_index=True)
        return long_df.pivot_table(
            index=["date", "longitude", "latitude"],
            columns="parameter",
            values="value",
        ).reset_index()

    @staticmethod
    def _area_to_long(payload):
        rows = []
        for feature in payload.get("features", []):
            lon, lat = feature["geometry"]["coordinates"][:2]
            for param, values in feature["properties"]["parameter"].items():
                for date, value in values.items():
                    if value is not None and float(value) == FILL_VALUE:
                        value = None
                    rows.append({
                        "date": pd.to_datetime(date, format="%Y%m%d"),
                        "longitude": lon,
                        "latitude": lat,
                        "parameter": param,
                        "value": value,
                    })
        return pd.DataFrame(rows)
