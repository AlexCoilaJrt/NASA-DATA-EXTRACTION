"""DATANASA: extrae datos climáticos diarios de la NASA POWER y los asocia
con el departamento y la provincia del Perú según las coordenadas.

Ejemplos:
  python main.py punto --lat -12.04 --lon -77.04
  python main.py area --lat-min -13 --lat-max -11 --lon-min -78 --lon-max -76
  python main.py config --params T2M,PRECTOTCORR
  python main.py ubicar --lat -12.04 --lon -77.04
  python main.py provincia "LIMA" --datos
  python main.py departamento "CUSCO"
"""

import argparse
import sys
import time

import pandas as pd
import requests

from backend.geopery import PeruGeocoder
from backend.nasa_power import NasaPowerClient

DEFAULT_PARAMS = [
    "T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "WS2M", "RH2M", "ALLSKY_SFC_SW_DWN",
]
POWER_API = "https://power.larc.nasa.gov/api"


def _split_params(text):
    if not text:
        return list(DEFAULT_PARAMS)
    return [p.strip().upper() for p in text.split(",") if p.strip()]


def _date_range(start, end):
    end_dt = pd.Timestamp.today()
    start_dt = end_dt - pd.DateOffset(years=1)
    start = start or start_dt.strftime("%Y%m%d")
    end = end or end_dt.strftime("%Y%m%d")
    return start, end


def _export(df, csv, excel, name="datos"):
    paths = []
    if csv:
        df.to_csv(csv, index=False)
        paths.append(csv)
    if excel:
        df.to_excel(excel, index=False)
        paths.append(excel)
    return paths


def _show(df):
    if df.empty:
        print("Sin datos.")
        return
    print(df.to_string(index=False, max_rows=15))


# --------------------------------------------------------------------- #
# comandos
# --------------------------------------------------------------------- #
def cmd_punto(client, geocoder, args):
    start, end = _date_range(args.start, args.end)
    params = _split_params(args.params)

    geo = geocoder.ubicar(args.lat, args.lon)
    print(f"Coordenada: lat={args.lat}, lon={args.lon}")
    if geo:
        print(f"Ubicación : {geo['departamento']} / {geo['provincia']} / {geo['distrito']} "
              f"(ubigeo {geo['ubigeo']})")
    else:
        print("Ubicación : fuera del territorio peruano")

    df = client.point(args.lat, args.lon, params, start, end)
    if geo:
        for col, key in (("departamento", "departamento"), ("provincia", "provincia"),
                         ("distrito", "distrito"), ("ubigeo", "ubigeo")):
            df[col] = geo[key]

    _show(df)
    paths = _export(df, args.csv, args.excel, "punto")
    print(f"\n{len(df)} filas ({start} a {end}).")
    for p in paths:
        print(f"Guardado: {p}")


def cmd_area(client, geocoder, args):
    start, end = _date_range(args.start, args.end)
    params = _split_params(args.params)

    print(f"Área: lon [{args.lon_min}, {args.lon_max}] x lat [{args.lat_min}, {args.lat_max}]")
    df = client.area(
        args.lat_min, args.lat_max, args.lon_min, args.lon_max,
        params, start, end,
    )
    df = geocoder.anotar(df)
    _show(df)
    paths = _export(df, args.csv, args.excel, "area")
    print(f"\n{len(df)} filas ({start} a {end}).")
    for p in paths:
        print(f"Guardado: {p}")


def cmd_config(client, args):
    payload = client.configuration()
    doc = payload.get("documentation", {})
    settings = payload.get("settings", {})
    print(f"API : {doc.get('title', 'NASA POWER')} ({doc.get('version', '?')})")
    print(f"     {doc.get('description', '')}")
    print(f"     comunidades: {', '.join(settings.get('community', []))}")
    print(f"     cobertura  : {settings.get('start', '')} a {settings.get('end', '')}")

    params = _split_params(args.params) if args.params else None
    if not params:
        print("\nUsa --params T2M,PRECTOTCORR,... para ver el detalle de cada parámetro.")
        return

    # El detalle (nombre y unidad) se obtiene del campo "parameters" de una
    # respuesta de punto; se consulta una sola fecha en una coordenada por defecto.
    lat = args.lat if args.lat is not None else -12.04
    lon = args.lon if args.lon is not None else -77.04
    resp = requests.get(
        f"{POWER_API}/temporal/daily/point",
        params={
            "parameters": ",".join(params),
            "latitude": lat,
            "longitude": lon,
            "start": "20240101",
            "end": "20240102",
            "community": client.community,
            "format": "JSON",
        },
        timeout=60,
    )
    resp.raise_for_status()
    rows = []
    for name, meta in resp.json().get("parameters", {}).items():
        rows.append({
            "parámetro": name,
            "descripción": meta.get("longname", ""),
            "unidad": meta.get("units", ""),
        })
    df = pd.DataFrame(rows)
    _show(df)
    print(f"\n{len(df)} parámetros.")


def cmd_ubicar(geocoder, args):
    if args.archivo:
        df = pd.read_csv(args.archivo)
        lat_col = args.lat_col or "latitude"
        lon_col = args.lon_col or "longitude"
        for col in (lat_col, lon_col):
            if col not in df.columns:
                sys.exit(f"Columna '{col}' no encontrada en {args.archivo}.")
        df = geocoder.anotar(df, latitude=lat_col, longitude=lon_col)
        _show(df)
        paths = _export(df, args.csv, None, "ubicar")
        for p in paths:
            print(f"Guardado: {p}")
        return

    if args.lat is None or args.lon is None:
        sys.exit("Usa --lat y --lon, o --archivo con un CSV de coordenadas.")
    geo = geocoder.ubicar(args.lat, args.lon)
    if geo:
        print(f"Departamento: {geo['departamento']}")
        print(f"Provincia   : {geo['provincia']}")
        print(f"Distrito    : {geo['distrito']}")
        print(f"Ubigeo      : {geo['ubigeo']}")
    else:
        print("La coordenada está fuera del territorio peruano.")


def cmd_provincia(client, geocoder, args):
    matches = geocoder.buscar(args.departamento, args.provincia)
    if not matches:
        sys.exit("No se encontró ninguna provincia con esos nombres.")
    if len(matches) > 1 and not args.datos:
        print("Coincidencias encontradas:")
        for m in matches:
            c = m["centroid"]
            print(f"  {m['departamento']} / {m['provincia']} "
                  f"(ubigeo {m['ubigeo']}, centro lat={c.y:.4f}, lon={c.x:.4f})")
        sys.exit("Especifica --provincia para una sola provincia.")

    target = matches[0]
    c = target["centroid"]
    print(f"{target['departamento']} / {target['provincia']} "
          f"(ubigeo {target['ubigeo']}, centro lat={c.y:.4f}, lon={c.x:.4f})")

    if not args.datos:
        return

    start, end = _date_range(args.start, args.end)
    params = _split_params(args.params)
    df = client.point(c.y, c.x, params, start, end)
    df["departamento"] = target["departamento"]
    df["provincia"] = target["provincia"]
    df["ubigeo"] = target["ubigeo"]
    geo = geocoder.ubicar(c.y, c.x)
    df["distrito"] = geo["distrito"] if geo else None
    _show(df)
    paths = _export(df, args.csv, args.excel, "provincia")
    print(f"\n{len(df)} filas ({start} a {end}).")
    for p in paths:
        print(f"Guardado: {p}")


def cmd_departamento(client, geocoder, args):
    provs = geocoder.provincias_de(args.departamento)
    if not provs:
        sys.exit("No se encontró ese departamento.")
    print(f"Provincias de {args.departamento.upper()} ({len(provs)}):")
    for m in provs:
        c = m["centroid"]
        print(f"  {m['provincia']:<40} ubigeo {m['ubigeo']}  lat={c.y:.4f}, lon={c.x:.4f}")

    if not args.datos:
        return

    start, end = _date_range(args.start, args.end)
    params = _split_params(args.params)
    frames = []
    for i, m in enumerate(provs):
        c = m["centroid"]
        print(f"\n[{i + 1}/{len(provs)}] {m['departamento']} / {m['provincia']} "
              f"(lat={c.y:.4f}, lon={c.x:.4f})")
        df = client.point(c.y, c.x, params, start, end)
        df["departamento"] = m["departamento"]
        df["provincia"] = m["provincia"]
        df["ubigeo"] = m["ubigeo"]
        geo = geocoder.ubicar(c.y, c.x)
        df["distrito"] = geo["distrito"] if geo else None
        frames.append(df)
        time.sleep(args.pausa)

    all_df = pd.concat(frames, ignore_index=True)
    _show(all_df)
    paths = _export(all_df, args.csv, args.excel, "departamento")
    print(f"\n{len(all_df)} filas totales ({start} a {end}).")
    for p in paths:
        print(f"Guardado: {p}")


def cmd_distrito(client, geocoder, args):
    matches = geocoder.buscar(args.departamento, args.provincia, args.distrito)
    if not matches:
        sys.exit("No se encontró ningún distrito con esos nombres.")
    if len(matches) > 1 and not args.datos:
        print("Coincidencias encontradas:")
        for m in matches:
            c = m["centroid"]
            print(f"  {m['departamento']} / {m['provincia']} / {m['distrito']} "
                  f"(ubigeo {m['ubigeo']}, centro lat={c.y:.4f}, lon={c.x:.4f})")
        sys.exit("Especifica el departamento y la provincia para un solo distrito.")

    target = matches[0]
    c = target["centroid"]
    print(f"{target['departamento']} / {target['provincia']} / {target['distrito']} "
          f"(ubigeo {target['ubigeo']}, centro lat={c.y:.4f}, lon={c.x:.4f})")

    if not args.datos:
        return

    start, end = _date_range(args.start, args.end)
    params = _split_params(args.params)
    df = client.point(c.y, c.x, params, start, end)
    for col, key in (("departamento", "departamento"), ("provincia", "provincia"),
                     ("distrito", "distrito"), ("ubigeo", "ubigeo")):
        df[col] = target[key]
    _show(df)
    paths = _export(df, args.csv, args.excel, "distrito")
    print(f"\n{len(df)} filas ({start} a {end}).")
    for p in paths:
        print(f"Guardado: {p}")


# --------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------- #
def build_parser():
    parser = argparse.ArgumentParser(
        prog="datanasa",
        description="Extrae datos climáticos diarios de la NASA POWER y los "
                    "asocia con departamento, provincia y distrito del Perú.",
    )
    parser.add_argument("--community", default="AG", choices=["AG", "RE", "SB"],
                        help="comunidad POWER: AG=agrícola, RE=renovable, SB=edificios")
    parser.add_argument("--user", default="datansa",
                        help="identificador para la API de área (alfanumérico, < 15 caracteres)")

    sub = parser.add_subparsers(dest="comando", required=True)

    p_punto = sub.add_parser("punto", help="datos diarios por coordenada")
    p_punto.add_argument("--lat", type=float, required=True)
    p_punto.add_argument("--lon", type=float, required=True)
    _add_datos_common(p_punto)

    p_area = sub.add_parser("area", help="datos diarios por región")
    p_area.add_argument("--lat-min", type=float, required=True)
    p_area.add_argument("--lat-max", type=float, required=True)
    p_area.add_argument("--lon-min", type=float, required=True)
    p_area.add_argument("--lon-max", type=float, required=True)
    _add_datos_common(p_area)

    p_config = sub.add_parser("config", help="parámetros disponibles en la API")
    p_config.add_argument("--params", help="lista separada por comas (opcional)")
    p_config.add_argument("--lat", type=float, help="latitud para consultar metadatos (opcional)")
    p_config.add_argument("--lon", type=float, help="longitud para consultar metadatos (opcional)")

    p_ubicar = sub.add_parser("ubicar", help="dado lat/lon, indica departamento, provincia y distrito")
    p_ubicar.add_argument("--lat", type=float)
    p_ubicar.add_argument("--lon", type=float)
    p_ubicar.add_argument("--archivo", help="CSV con coordenadas para anotar")
    p_ubicar.add_argument("--lat-col", help="nombre de la columna de latitud en el CSV")
    p_ubicar.add_argument("--lon-col", help="nombre de la columna de longitud en el CSV")
    p_ubicar.add_argument("--csv")

    p_prov = sub.add_parser("provincia", help="ubica una provincia y opcionalmente extrae sus datos")
    p_prov.add_argument("departamento")
    p_prov.add_argument("provincia", nargs="?", default=None)
    p_prov.add_argument("--datos", action="store_true", help="extraer datos en el centroide")
    _add_datos_common(p_prov)

    p_dep = sub.add_parser("departamento", help="lista las provincias de un departamento")
    p_dep.add_argument("departamento")
    p_dep.add_argument("--datos", action="store_true", help="extraer datos de cada provincia")
    p_dep.add_argument("--pausa", type=float, default=1.0,
                       help="segundos de espera entre provincias (predeterminado 1.0)")
    _add_datos_common(p_dep)

    p_dis = sub.add_parser("distrito", help="ubica un distrito y opcionalmente extrae sus datos")
    p_dis.add_argument("departamento")
    p_dis.add_argument("provincia", nargs="?", default=None)
    p_dis.add_argument("distrito", nargs="?", default=None)
    p_dis.add_argument("--datos", action="store_true", help="extraer datos en el centroide")
    _add_datos_common(p_dis)

    return parser


def _add_datos_common(parser):
    parser.add_argument("--params", help="parámetros separados por comas "
                        "(predeterminado: T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M,RH2M,ALLSKY_SFC_SW_DWN)")
    parser.add_argument("--start", help="fecha inicio YYYYMMDD (predeterminado: hace 1 año)")
    parser.add_argument("--end", help="fecha fin YYYYMMDD (predeterminado: hoy)")
    parser.add_argument("--csv", help="guardar resultados en CSV")
    parser.add_argument("--excel", help="guardar resultados en Excel")


def main():
    args = build_parser().parse_args()
    client = NasaPowerClient(community=args.community, user=args.user)
    geocoder = PeruGeocoder()

    try:
        if args.comando == "punto":
            cmd_punto(client, geocoder, args)
        elif args.comando == "area":
            cmd_area(client, geocoder, args)
        elif args.comando == "config":
            cmd_config(client, args)
        elif args.comando == "ubicar":
            cmd_ubicar(geocoder, args)
        elif args.comando == "provincia":
            cmd_provincia(client, geocoder, args)
        elif args.comando == "departamento":
            cmd_departamento(client, geocoder, args)
        elif args.comando == "distrito":
            cmd_distrito(client, geocoder, args)
    except Exception as exc:  # noqa: BLE001
        sys.exit(f"Error: {exc}")


if __name__ == "__main__":
    main()
