import { useMemo, useState } from 'react'
import Tabla from '../componentes/Tabla'
import { Campo, MetricCard, Panel, Vacio } from '../componentes/ui'

export default function Catalogo({ catalogo }) {
  const [filtro, setFiltro] = useState('')
  const [categoria, setCategoria] = useState('Todas')

  const categorias = useMemo(
    () => [...new Set((catalogo || []).map((v) => v.categoria))],
    [catalogo],
  )

  const filas = useMemo(() => {
    let lista = catalogo || []
    if (categoria !== 'Todas') lista = lista.filter((v) => v.categoria === categoria)
    if (filtro) {
      const texto = filtro.toUpperCase()
      lista = lista.filter((v) =>
        `${v.parametro} ${v.descripcion} ${v.categoria}`.toUpperCase().includes(texto),
      )
    }
    return lista
  }, [catalogo, filtro, categoria])

  return (
    <>
      <div className="grilla-metricas">
        <MetricCard icono="🧩" etiqueta="Variables" valor={filas.length} />
        <MetricCard icono="🗂️" etiqueta="Categorías" valor={categorias.length} />
        <MetricCard icono="📚" etiqueta="Total catálogo" valor={(catalogo || []).length} />
        <MetricCard icono="📅" etiqueta="Cobertura" valor="1981 → hoy" />
        <MetricCard icono="🌡️" etiqueta="Serie" valor="Diaria" />
      </div>

      <Panel titulo="Catálogo de variables">
        <div className="grilla-form">
          <Campo label="Buscar">
            <input
              type="text"
              placeholder="p. ej. T2M, precipitación, viento..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </Campo>
          <Campo label="Categoría">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="Todas">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
        </div>
        {filas.length ? <Tabla filas={filas} /> : <Vacio>Sin resultados con ese filtro.</Vacio>}
      </Panel>
    </>
  )
}
