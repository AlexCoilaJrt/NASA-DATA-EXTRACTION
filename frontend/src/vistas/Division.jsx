import { useEffect, useMemo, useState } from 'react'
import { consultarDivision, getCentroide, getDepartamentos, getDistritos, getProvincias } from '../api'
import { MapaBase, Marcador } from '../componentes/Mapa'
import Grafico, { GraficoMulti } from '../componentes/Grafico'
import Tabla from '../componentes/Tabla'
import Descargas from '../componentes/Descargas'
import { Button, Campo, Error, Loader, MetricCard, Panel, unidadDe, Vacio } from '../componentes/ui'

const TODAS_PROVINCIAS = 'Todas las provincias'
const TODOS_DISTRITOS = 'Todos los distritos'

export default function Division({ params, fechas, frecuencia, agregacion, catalogo }) {
  const [departamentos, setDepartamentos] = useState([])
  const [dep, setDep] = useState('')
  const [provincias, setProvincias] = useState([])
  const [prov, setProv] = useState(TODAS_PROVINCIAS)
  const [distritos, setDistritos] = useState([])
  const [distrito, setDistrito] = useState(TODOS_DISTRITOS)
  const [centroide, setCentroide] = useState(null)
  const [datos, setDatos] = useState(null)
  const [unidades, setUnidades] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDepartamentos().then((d) => {
      setDepartamentos(d)
      setDep(d[0] || '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!dep) return
    setProv(TODAS_PROVINCIAS)
    setDistrito(TODOS_DISTRITOS)
    getProvincias(dep).then(setProvincias).catch(() => setProvincias([]))
  }, [dep])

  useEffect(() => {
    setDistrito(TODOS_DISTRITOS)
    if (!dep || prov === TODAS_PROVINCIAS) {
      setDistritos([])
      setCentroide(null)
      return
    }
    getDistritos(dep, prov).then(setDistritos).catch(() => setDistritos([]))
  }, [dep, prov])

  useEffect(() => {
    if (!dep || prov === TODAS_PROVINCIAS || distrito === TODOS_DISTRITOS) {
      setCentroide(null)
      return
    }
    getCentroide(dep, prov, distrito).then(setCentroide).catch(() => setCentroide(null))
  }, [dep, prov, distrito])

  const cuerpo = () => ({
    departamento: dep,
    provincia: prov === TODAS_PROVINCIAS ? null : prov,
    distrito: prov !== TODAS_PROVINCIAS && distrito !== TODOS_DISTRITOS ? distrito : null,
    params,
    start: fechas.inicio,
    end: fechas.fin,
    frecuencia,
    agregacion,
  })

  const consultar = async () => {
    if (!dep) return
    setCargando(true)
    setError(null)
    try {
      const r = await consultarDivision(cuerpo())
      setDatos(r.datos)
      setUnidades(r.unidades)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  const seriesPorParam = useMemo(() => {
    const mapa = {}
    if (!datos) return mapa
    params.forEach((p) => {
      const series = {}
      datos.forEach((f) => {
        const nombre = f.distrito ? `${f.provincia} · ${f.distrito}` : f.provincia
        if (f[p] == null) return
        ;(series[nombre] ||= []).push({ fecha: f.date, valor: f[p] })
      })
      mapa[p] = series
    })
    return mapa
  }, [datos, params])

  const nivel = prov === TODAS_PROVINCIAS
    ? `Todas las provincias de ${dep}`
    : distrito === TODOS_DISTRITOS
      ? `Todos los distritos de ${prov}`
      : `${prov} · ${distrito}`

  return (
    <>
      <div className="grilla-metricas">
        <MetricCard icono="🏛️" etiqueta="Departamento" valor={dep} />
        <MetricCard icono="🗺️" etiqueta="Provincia" valor={prov} />
        <MetricCard icono="📍" etiqueta="Distrito" valor={distrito} />
        <MetricCard icono="🔢" etiqueta="Unidades" valor={unidades || null} />
        <MetricCard icono="🎯" etiqueta="Centroide" valor={centroide ? `${centroide.lat.toFixed(4)}, ${centroide.lon.toFixed(4)}` : null} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(270px, 340px) 1fr', gap: 18, alignItems: 'start' }}>
        <Panel titulo="División política">
          <p className="ayuda" style={{ marginTop: -4 }}>
            Elige un departamento completo, una provincia (todos sus distritos) o un distrito puntual.
          </p>
          <Campo label="Departamento">
            <select value={dep} onChange={(e) => setDep(e.target.value)}>
              {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Campo>
          <Campo label="Provincia">
            <select value={prov} onChange={(e) => setProv(e.target.value)}>
              <option value={TODAS_PROVINCIAS}>{TODAS_PROVINCIAS}</option>
              {provincias.map((p) => <option key={p.ubigeo} value={p.provincia}>{p.provincia}</option>)}
            </select>
          </Campo>
          {prov !== TODAS_PROVINCIAS && (
            <Campo label="Distrito">
              <select value={distrito} onChange={(e) => setDistrito(e.target.value)}>
                <option value={TODOS_DISTRITOS}>{TODOS_DISTRITOS}</option>
                {distritos.map((d) => <option key={d.ubigeo} value={d.distrito}>{d.distrito}</option>)}
              </select>
            </Campo>
          )}
          <Button onClick={consultar} disabled={cargando || !dep || !params.length}>
            {cargando ? 'Extrayendo...' : 'Extraer datos'}
          </Button>
          {prov !== TODAS_PROVINCIAS && distrito !== TODOS_DISTRITOS && (
            <p className="ayuda" style={{ marginBottom: 0, marginTop: 10 }}>
              El tiempo de extracción crece con la cantidad de unidades ({provincias.length} provincias o {distritos.length} distritos) y variables.
            </p>
          )}
        </Panel>

        <div>
          {centroide ? (
            <MapaBase centro={[centroide.lat, centroide.lon]} zoom={10}>
              <Marcador lat={centroide.lat} lon={centroide.lon} />
            </MapaBase>
          ) : (
            <MapaBase centro={[-9.2, -75]} zoom={5} />
          )}
        </div>
      </div>

      {cargando && <Loader texto="Extrayendo datos de la API NASA POWER (una petición por variable y unidad)..." />}
      {error && <Error>{error}</Error>}

      {!datos && !cargando && !error && (
        <Vacio>Selecciona el nivel y presiona <strong>Extraer datos</strong>.</Vacio>
      )}

      {datos && (
        <Panel
          titulo={`Resultado · ${datos.length.toLocaleString()} registros · ${unidades} unidad(es)`}
          acciones={<span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>{nivel}</span>}
        >
          <Tabla filas={datos} />
          {params.map((p) => {
            const serie = seriesPorParam[p]
            if (!serie) return null
            const serieUnica = Object.keys(serie).length === 1
            return serieUnica
              ? <Grafico key={p} datos={datos} parametro={p} unidad={unidadDe(catalogo, p)} />
              : <GraficoMulti key={p} series={serie} parametro={p} unidad={unidadDe(catalogo, p)} />
          })}
          <div style={{ marginTop: 14 }}>
            <Descargas tipo="division" payload={cuerpo()} filas={datos} nombre={`division_${dep.replace(/ /g, '_')}_${frecuencia}`} />
          </div>
        </Panel>
      )}
    </>
  )
}
