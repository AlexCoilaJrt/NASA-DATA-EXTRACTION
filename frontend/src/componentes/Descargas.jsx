import { descargarCSV, exportar } from '../api'
import { Button } from './ui'

export default function Descargas({ tipo, payload, filas, nombre }) {
  const guardarExcel = async () => {
    try {
      await exportar(tipo, payload, nombre, 'xlsx')
    } catch (e) {
      alert(`No se pudo exportar: ${e.message}`)
    }
  }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button variant="secundario" onClick={() => descargarCSV(filas, nombre)}>
        ⬇ CSV
      </Button>
      <Button variant="secundario" onClick={guardarExcel}>
        ⬇ Excel
      </Button>
    </div>
  )
}
