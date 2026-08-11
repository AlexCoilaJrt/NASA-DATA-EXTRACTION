import { useMemo, useState } from 'react'
import { consultarArea } from '../api'
import { DibujarRectangulo, MapaBase, Rectangulo } from '../componentes/Mapa'
import Grafico from '../componentes/Grafico'
import Tabla from '../componentes/Tabla'
import Descargas from '../componentes/Descargas'
import { Button, Campo, Error, Loader, MetricCard, Panel, unidadDe, Vacio } from '../componentes/ui'

const POR_DEFECTO = { latMin: -14.5, latMax: -10.0, lonMin: -78.0, lonMax: -74.0 }

export default function Area({ params, fechas, frecuencia, agregacion, catalogo }) {
  const [bounds, setBounds] = useState(POR_DEFECTO)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const cuerpo = () => ({ ...bounds, params, start: fechas.inicio, end: fechas.fin, frecuencia, agregacion })

  const valido =
    bounds.latMin < bounds.latMax &&
    bounds.lonMin < bounds.lonMax &&
    bounds.latMax - bounds.latMin >= 2 &&
    bounds.lonMax - bounds.lonMin >= 2

  const promedio = useMemo(() => {
    if (!datos?.length) return null
    const porFecha = {}
    datos.forEach((f) => {
      const grupo = (porFecha[f.date] ||= {})
      params.forEach((p) => {
        const v = f[p]
        if (v == null) return
        if (!(p in grupo)) grupo[p] = { suma: 0, n: 0 }
        grupo[p].suma += v
        grupo[p].n += 1
      })
    })
    return Object.entries(porFecha)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([fecha, cols]) => ({
        date: fecha,
        ...Object.fromEntries(Object.entries(cols).map(([p, c]) => [p, +(c.suma / c.n).toFixed(3)])),
      }))
  }, [datos, params])

  const consultar = async () => {
    setCargando(true)
    setError(null)
    try {
      const r = await consultarArea(cuerpo())
      setDatos(r.datos)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  const puntoCentrales = [
    { e: 'Lat. mínima (sur)', v: bounds.latMin, k: 'latMin' },
    { e: 'Lat. máxima (norte)', v: bounds.latMax, k: 'latMax' },
    { e: 'Lon. mínima (oeste)', v: bounds.lonMin, k: 'lonMin' },
    { e: 'Lon. máxima (este)', v: bounds.lonMax, k: 'lonMax' },
  ]

  return (
    <>
      <div className="grilla-metricas">
        {puntoCentrales.map((c) => (
          <MetricCard key={c.k} icono="🧭" etiqueta={c.e} valor={c.v.toFixed(2)} />
        ))}
        <MetricCard icono="📐" etiqueta="Estado" valor={valido ? 'Válido' : 'Rango &lt; 2°'} />
      </div>

      <div className="grilla-panel-mapa">
        <Panel titulo="Definir el área">
          <p className="ayuda" style={{ marginTop: -4 }}>
            Usa las coordenadas o dibuja un rectángulo sobre el mapa.
          </p>
          {puntoCentrales.slice(0, 2).map((c) => (
            <Campo key={c.k} label={c.e}>
              <input type="number" step="0.1" min="-18.5" max="0.5" value={c.v} onChange={(e) => setBounds({ ...bounds, [c.k]: Number(e.target.value) })} />
            </Campo>
          ))}
          {puntoCentrales.slice(2).map((c) => (
            <Campo key={c.k} label={c.e}>
              <input type="number" step="0.1" min="-81.5" max="-68.5" value={c.v} onChange={(e) => setBounds({ ...bounds, [c.k]: Number(e.target.value) })} />
            </Campo>
          ))}
          {!valido && (
            <p className="ayuda" style={{ color: 'var(--danger)' }}>
              El rango debe tener al menos 2° en latitud y longitud, con mínimas menores que las máximas.
            </p>
          )}
          <Button onClick={consultar} disabled={cargando || !valido || !params.length}>
            {cargando ? 'Consultando...' : 'Consultar datos'}
          </Button>
        </Panel>

        <div>
          <MapaBase centro={[(bounds.latMin + bounds.latMax) / 2, (bounds.lonMin + bounds.lonMax) / 2]} zoom={6}>
            <Rectangulo bounds={bounds} />
            <DibujarRectangulo onCreado={setBounds} />
          </MapaBase>
        </div>
      </div>

      {cargando && <Loader texto="Consultando la API NASA POWER (una petición por variable)..." />}
      {error && <Error>{error}</Error>}

      {!datos && !cargando && !error && (
        <Vacio>Dibuja el rectángulo o ajusta las coordenadas y presiona <strong>Consultar datos</strong>.</Vacio>
      )}

      {datos && (
        <Panel
          titulo={`Resultado · ${datos.length.toLocaleString()} registros · ${new Set(datos.map((d) => d.date)).size} fechas`}
          acciones={<span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>Promedio {frecuencia === 'diario' ? 'diario' : frecuencia === 'mensual' ? 'mensual' : 'anual'} del área</span>}
        >
          <Tabla filas={datos} />
          {params.map((p) => (
            <Grafico key={p} datos={promedio} parametro={p} unidad={unidadDe(catalogo, p)} />
          ))}
          <div style={{ marginTop: 14 }}>
            <Descargas tipo="area" payload={cuerpo()} filas={datos} nombre="area" />
          </div>
        </Panel>
      )}
    </>
  )
}
