export default function Tabla({ filas, maxAltura = 440 }) {
  if (!filas || !filas.length) return null
  const columnas = Object.keys(filas[0])
  const numerica = (v) => typeof v === 'number' && Number.isFinite(v)
  return (
    <div className="tabla-wrap" style={{ maxHeight: maxAltura }}>
      <table>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              {columnas.map((c) => (
                <td key={c} style={numerica(f[c]) ? { textAlign: 'right' } : undefined}>
                  {f[c] == null ? '' : numerica(f[c]) ? Number(f[c]).toLocaleString('es-PE') : f[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
