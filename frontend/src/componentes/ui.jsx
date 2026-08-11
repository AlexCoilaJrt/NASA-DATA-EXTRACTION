export function Button({ children, variant = 'primario', size, className = '', disabled, onClick, title }) {
  const clases = [
    'btn',
    variant === 'primario' ? 'btn-primario' : variant === 'secundario' ? 'btn-secundario' : 'btn-fantasma',
    size === 'pequeno' ? 'btn-pequeno' : '',
    size === 'icono' ? 'btn-icono' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button type="button" className={clases} disabled={disabled} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

export function Campo({ label, children, ayuda, className = '' }) {
  return (
    <div className={`campo ${className}`.trim()}>
      {label && <label>{label}</label>}
      {children}
      {ayuda && <p className="ayuda">{ayuda}</p>}
    </div>
  )
}

export function MetricCard({ icono, etiqueta, valor }) {
  return (
    <div className="metrica">
      <div className="metrica-cab">
        {icono && <span className="metrica-icono">{icono}</span>}
        <span className="etiqueta">{etiqueta}</span>
      </div>
      <div className="valor">{valor ?? '—'}</div>
    </div>
  )
}

export function Panel({ titulo, acciones, children, className = '' }) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(titulo || acciones) && (
        <div className="panel-cab">
          {titulo && <h3>{titulo}</h3>}
          {acciones && <div className="panel-acciones">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Chips({ items, catalogo }) {
  if (!items || !items.length) return null
  return (
    <div className="chips">
      {items.map((p) => (
        <span className="chip" key={p}>
          {p} <span className="unidad">{unidadDe(catalogo, p)}</span>
        </span>
      ))}
    </div>
  )
}

export function Loader({ texto = 'Procesando...' }) {
  return (
    <div className="estado info">
      <span className="spinner" />
      {texto}
    </div>
  )
}

export function Error({ children }) {
  return <div className="estado error">⚠️ {children}</div>
}

export function Vacio({ children }) {
  return <div className="vacio">{children}</div>
}

export function unidadDe(catalogo, parametro) {
  const v = (catalogo || []).find((i) => i.parametro === parametro)
  return v?.unidad || ''
}
