import { useEffect, useState } from 'react'
import { getCatalogo, getConfig } from './api'
import Sidebar from './componentes/Sidebar'
import ErrorBoundary from './componentes/ErrorBoundary'
import Punto from './vistas/Punto'
import Area from './vistas/Area'
import Division from './vistas/Division'
import Catalogo from './vistas/Catalogo'
import { Button } from './componentes/ui'
import { useTema } from './contexto/Tema'

const PARAMS_POR_DEFECTO = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'WS2M', 'RH2M', 'ALLSKY_SFC_SW_DWN']

const DESCRIPCIONES = {
  '📍 Punto': 'Consulta datos de una coordenada y ubícala en el Perú',
  '🗺️ Área': 'Consulta datos de una región rectangular',
  '🏛️ División': 'Extrae datos por departamento, provincia o distrito',
  '📚 Catálogo': 'Explora las variables climáticas disponibles en NASA POWER',
}

function fechasPorDefecto() {
  const hoy = new Date()
  const anioPasado = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate())
  return { inicio: anioPasado.toISOString().slice(0, 10), fin: hoy.toISOString().slice(0, 10) }
}

export default function App() {
  const [vista, setVista] = useState('📍 Punto')
  const [catalogo, setCatalogo] = useState([])
  const [config, setConfig] = useState(null)
  const [estadoApi, setEstadoApi] = useState('cargando')
  const [params, setParams] = useState(PARAMS_POR_DEFECTO)
  const [fechas, setFechas] = useState(fechasPorDefecto)
  const [frecuencia, setFrecuencia] = useState('diario')
  const [agregacion, setAgregacion] = useState('promedio')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { tema, alternar } = useTema()

  useEffect(() => {
    getCatalogo().then(setCatalogo).catch(() => {})
    getConfig().then((c) => { setConfig(c); setEstadoApi('ok') }).catch(() => setEstadoApi('mal'))
  }, [])

  return (
    <div className="app">
      <Sidebar
        vista={vista}
        setVista={setVista}
        catalogo={catalogo}
        config={config}
        estadoApi={estadoApi}
        params={params}
        setParams={setParams}
        fechas={fechas}
        setFechas={setFechas}
        frecuencia={frecuencia}
        setFrecuencia={setFrecuencia}
        agregacion={agregacion}
        setAgregacion={setAgregacion}
        menuAbierto={menuAbierto}
        cerrarMenu={() => setMenuAbierto(false)}
      />

      <div className="barra-superior">
        <Button size="icono" variant="secundario" onClick={() => setMenuAbierto(true)} title="Abrir menú">☰</Button>
        <strong>{vista}</strong>
        <span style={{ flex: 1 }} />
        <Button size="pequeno" variant="secundario" onClick={alternar} title="Cambiar modo día/noche">
          {tema === 'noche' ? '☀️ Día' : '🌙 Noche'}
        </Button>
      </div>

      <main className="contenido">
        <h1>{vista}</h1>
        <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: -4 }}>
          {DESCRIPCIONES[vista]}
        </p>

        {!params.length && <div className="estado error">⚠️ Selecciona al menos una variable en la barra lateral.</div>}

        <ErrorBoundary>
          {vista === '📍 Punto' && <Punto params={params} fechas={fechas} frecuencia={frecuencia} agregacion={agregacion} catalogo={catalogo} />}
          {vista === '🗺️ Área' && <Area params={params} fechas={fechas} frecuencia={frecuencia} agregacion={agregacion} catalogo={catalogo} />}
          {vista === '🏛️ División' && <Division params={params} fechas={fechas} frecuencia={frecuencia} agregacion={agregacion} catalogo={catalogo} />}
          {vista === '📚 Catálogo' && <Catalogo catalogo={catalogo} />}
        </ErrorBoundary>

        <div className="pie">
          Fuentes: NASA POWER (power.larc.nasa.gov) · OCHA COD-AB Perú (data.humdata.org/dataset/cod-ab-per)
        </div>
      </main>
    </div>
  )
}
