import { useEffect, useRef, useState } from 'react'
import { consultarPunto, getUbicacion } from '../api'
import { ClicCoordenadas, MapaBase, Marcador } from '../componentes/Mapa'
import Grafico from '../componentes/Grafico'
import Tabla from '../componentes/Tabla'
import Descargas from '../componentes/Descargas'
import { Button, Campo, Error, Loader, MetricCard, Panel, unidadDe, Vacio } from '../componentes/ui'

const POR_DEFECTO = { lat: -12.0464, lon: -77.0428 }

export default function Punto({ params, fechas, frecuencia, agregacion, catalogo }) {
  const [lat, setLat] = useState(POR_DEFECTO.lat)
  const [lon, setLon] = useState(POR_DEFECTO.lon)
  const [geo, setGeo] = useState(null)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        setGeo(await getUbicacion(lat, lon))
      } catch {
        setGeo(null)
      }
    }, 350)
    return () => clearTimeout(timer.current)
  }, [lat, lon])

  const cuerpo = () => ({ lat, lon, params, start: fechas.inicio, end: fechas.fin, frecuencia, agregacion })

  const consultar = async () => {
    setCargando(true)
    setError(null)
    try {
      const r = await consultarPunto(cuerpo())
      setDatos(r.datos)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <div className="grilla-metricas">
        <MetricCard icono="🏛️" etiqueta="Departamento" valor={geo?.departamento} />
        <MetricCard icono="🗺️" etiqueta="Provincia" valor={geo?.provincia} />
        <MetricCard icono="📍" etiqueta="Distrito" valor={geo?.distrito} />
        <MetricCard icono="🔢" etiqueta="Ubigeo" valor={geo?.ubigeo} />
        <MetricCard icono="🎯" etiqueta="Coordenadas" valor={`${lat.toFixed(4)}, ${lon.toFixed(4)}`} />
      </div>

      <div className="grilla-panel-mapa">
        <Panel titulo="Coordenadas">
          <p className="ayuda" style={{ marginTop: -4 }}>
            Escríbelas o haz clic sobre el mapa para fijar el punto. La ubicación se actualiza en vivo.
          </p>
          <Campo label="Latitud">
            <input type="number" step="0.0001" min="-18.5" max="0.5" value={lat} onChange={(e) => setLat(Number(e.target.value))} />
          </Campo>
          <Campo label="Longitud">
            <input type="number" step="0.0001" min="-81.5" max="-68.5" value={lon} onChange={(e) => setLon(Number(e.target.value))} />
          </Campo>
          <Button onClick={consultar} disabled={cargando || !params.length}>
            {cargando ? 'Consultando...' : 'Consultar datos'}
          </Button>
          <p className="ayuda" style={{ marginBottom: 0, marginTop: 10 }}>
            Ej. Lima: -12.0464, -77.0428 · Cusco: -13.5319, -71.9675
          </p>
        </Panel>

        <div>
          <MapaBase centro={[lat, lon]} zoom={8}>
            <ClicCoordenadas onClic={({ lat: la, lon: lo }) => { setLat(la); setLon(lo) }} />
            <Marcador lat={lat} lon={lon} />
          </MapaBase>
        </div>
      </div>

      {cargando && <Loader texto="Consultando la API NASA POWER..." />}
      {error && <Error>{error}</Error>}

      {!datos && !cargando && !error && (
        <Vacio>
          Configura las coordenadas y presiona <strong>Consultar datos</strong> para obtener la serie diaria.
        </Vacio>
      )}

      {datos && (
        <Panel
          titulo={`Resultado · ${datos.length.toLocaleString()} registros`}
          acciones={<span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>{datos[0]?.date} → {datos[datos.length - 1]?.date}</span>}
        >
          <Tabla filas={datos} />
          {params.map((p) => (
            <Grafico key={p} datos={datos} parametro={p} unidad={unidadDe(catalogo, p)} />
          ))}
          <div style={{ marginTop: 14 }}>
            <Descargas tipo="punto" payload={cuerpo()} filas={datos} nombre={`punto_${lat}_${lon}`} />
          </div>
        </Panel>
      )}
    </>
  )
}
