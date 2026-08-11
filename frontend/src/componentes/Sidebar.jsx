import { useEffect, useMemo, useState } from 'react'
import { Button, Chips } from './ui'
import { useTema } from '../contexto/Tema'

const VISTAS = [
  { clave: '📍 Punto', icono: '🎯', descripcion: 'Coordenadas y mapa' },
  { clave: '🗺️ Área', icono: '🧭', descripcion: 'Región rectangular' },
  { clave: '🏛️ División', icono: '🗂️', descripcion: 'Dep. · Prov. · Dist.' },
  { clave: '📚 Catálogo', icono: '📖', descripcion: 'Variables POWER' },
]

export default function Sidebar({
  vista, setVista, catalogo, config, estadoApi,
  params, setParams, fechas, setFechas, menuAbierto, cerrarMenu,
  frecuencia, setFrecuencia, agregacion, setAgregacion,
}) {
  const [filtro, setFiltro] = useState('')
  const [abiertos, setAbiertos] = useState(() => {
    const inicial = {}
    categoriasDe(catalogo).forEach((c) => { inicial[c] = true })
    return inicial
  })

  useEffect(() => {
    setAbiertos((a) => {
      const siguiente = { ...a }
      categoriasDe(catalogo).forEach((c) => { if (siguiente[c] === undefined) siguiente[c] = true })
      return siguiente
    })
  }, [catalogo])

  const visibles = useMemo(
    () => (catalogo || []).filter((v) => v.parametro.includes(filtro.toUpperCase())),
    [catalogo, filtro],
  )

  const porCategoria = useMemo(() => {
    const mapa = {}
    visibles.forEach((v) => { ;(mapa[v.categoria] ||= []).push(v) })
    return mapa
  }, [visibles])

  const anios = useMemo(() => {
    const lista = []
    for (let y = new Date().getFullYear(); y >= 2001; y--) lista.push(y)
    return lista
  }, [])

  return (
    <>
      <aside className={`sidebar ${menuAbierto ? 'abierta' : ''}`}>
        <div className="logo-bloque">
          <div className="logo-icono">🛰️</div>
          <div>
            <div className="logo-titulo">DATANASA</div>
            <div className="logo-sub">Datos climáticos NASA POWER<br />División política del Perú</div>
          </div>
        </div>

        <div className="estado-api">
          <span className={`punto-estado ${estadoApi === 'ok' ? 'ok' : estadoApi === 'mal' ? 'mal' : ''}`} />
          {estadoApi === 'ok' && <span>API POWER v{config?.header?.['POWERAPI Version'] ?? 'conectada'}</span>}
          {estadoApi === 'mal' && <span>Sin conexión con la API NASA</span>}
          {estadoApi === 'cargando' && <span>Comprobando API...</span>}
        </div>

        <nav className="nav">
          {VISTAS.map((v) => (
            <div
              key={v.clave}
              className={`nav-item ${vista === v.clave ? 'activo' : ''}`}
              onClick={() => { setVista(v.clave); cerrarMenu() }}
            >
              <span>{v.icono}</span>
              <span>
                <div>{v.clave.replace(/^..\s/, '')}</div>
                <div style={{ fontSize: '.66rem', color: 'var(--muted)' }}>{v.descripcion}</div>
              </span>
            </div>
          ))}
        </nav>

        <div className="seccion">Rango de fechas</div>
        {frecuencia === 'diario' && (
          <div className="grilla-form">
            <div className="campo">
              <label>Inicio</label>
              <input type="date" value={fechas.inicio} max={fechas.fin} onChange={(e) => setFechas({ ...fechas, inicio: e.target.value })} />
            </div>
            <div className="campo">
              <label>Fin</label>
              <input type="date" value={fechas.fin} min={fechas.inicio} max={hoy()} onChange={(e) => setFechas({ ...fechas, fin: e.target.value })} />
            </div>
          </div>
        )}
        {frecuencia === 'mensual' && (
          <div className="grilla-form">
            <div className="campo">
              <label>Desde (mes)</label>
              <input
                type="month"
                value={fechas.inicio.slice(0, 7)}
                min="2001-01"
                max={fechas.fin.slice(0, 7)}
                onChange={(e) => {
                  const mes = e.target.value
                  if (!mes) return
                  const finMes = `${mes}-${String(ultimoDiaMes(mes)).padStart(2, '0')}`
                  setFechas({
                    inicio: `${mes}-01`,
                    fin: fechas.fin < `${mes}-01` ? clampFin(finMes) : fechas.fin,
                  })
                }}
              />
            </div>
            <div className="campo">
              <label>Hasta (mes)</label>
              <input
                type="month"
                value={fechas.fin.slice(0, 7)}
                min={fechas.inicio.slice(0, 7)}
                max={hoy().slice(0, 7)}
                onChange={(e) => {
                  const mes = e.target.value
                  if (!mes) return
                  setFechas({ ...fechas, fin: clampFin(`${mes}-${String(ultimoDiaMes(mes)).padStart(2, '0')}`) })
                }}
              />
            </div>
          </div>
        )}
        {frecuencia === 'anual' && (
          <div className="grilla-form">
            <div className="campo">
              <label>Desde año</label>
              <select
                value={fechas.inicio.slice(0, 4)}
                onChange={(e) => {
                  const y = e.target.value
                  if (!y) return
                  setFechas({ inicio: `${y}-01-01`, fin: clampFin(`${y}-12-31`) })
                }}
              >
                {anios.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="campo">
              <label>Hasta año</label>
              <select
                value={fechas.fin.slice(0, 4)}
                onChange={(e) => {
                  const y = e.target.value
                  if (!y) return
                  setFechas({ ...fechas, fin: clampFin(`${y}-12-31`) })
                }}
              >
                {anios.filter((y) => y >= Number(fechas.inicio.slice(0, 4))).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="seccion">Frecuencia</div>
        <div className="grilla-form">
          <div className="campo">
            <label>Período</label>
            <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>
              <option value="diario">Diario</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          {frecuencia !== 'diario' && (
            <div className="campo">
              <label>Agregar por</label>
              <select value={agregacion} onChange={(e) => setAgregacion(e.target.value)}>
                <option value="promedio">Promedio</option>
                <option value="suma">Suma</option>
                <option value="maximo">Máximo</option>
                <option value="minimo">Mínimo</option>
              </select>
            </div>
          )}
        </div>
        <p className="ayuda" style={{ marginBottom: 0 }}>
          {frecuencia === 'diario'
            ? 'Valores diarios originales de NASA POWER.'
            : `Valores ${frecuencia === 'mensual' ? 'mensuales' : 'anuales'} calculados por ${agregacion} de la serie diaria.`}
        </p>

        <div className="seccion">Variables</div>
        <div className="campo">
          <input
            type="text"
            placeholder="Filtrar (ej. T2M, precip...)"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <div className="botones-fila">
          <Button size="pequeno" variant="secundario" onClick={() => setParams((catalogo || []).map((v) => v.parametro))}>Todos</Button>
          <Button size="pequeno" variant="secundario" onClick={() => setParams(COMUNES)}>Comunes</Button>
          <Button size="pequeno" variant="secundario" onClick={() => setParams([])}>Limpiar</Button>
        </div>

        {Object.entries(porCategoria).map(([categoria, variables]) => (
          <div className="grupo-var" key={categoria}>
            <div className="grupo-var-cab" onClick={() => setAbiertos((a) => ({ ...a, [categoria]: !a[categoria] }))}>
              <span>{categoria}</span>
              <span className="cuenta">{params.filter((p) => variables.some((v) => v.parametro === p)).length}</span>
            </div>
            {abiertos[categoria] && (
              <div className="grupo-var-cuerpo">
                {variables.map((v) => (
                  <label className="check" key={v.parametro}>
                    <input
                      type="checkbox"
                      checked={params.includes(v.parametro)}
                      onChange={(e) => {
                        const activas = new Set(params)
                        if (e.target.checked) activas.add(v.parametro)
                        else activas.delete(v.parametro)
                        setParams([...activas])
                      }}
                    />
                    <span>{v.parametro}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <Chips items={params} catalogo={catalogo} />
        <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--accent)' }}>{params.length}</strong> variable(s) seleccionada(s)
        </div>
      </aside>
      {menuAbierto && <div className="superposicion" onClick={cerrarMenu} />}
    </>
  )
}

const COMUNES = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'WS2M', 'RH2M', 'ALLSKY_SFC_SW_DWN']

function categoriasDe(catalogo) {
  return [...new Set((catalogo || []).map((v) => v.categoria))]
}

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function ultimoDiaMes(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function clampFin(fecha) {
  const h = hoy()
  return fecha > h ? h : fecha
}
