const API = '/api'

async function json(res) {
  if (!res.ok) {
    let detalle = ''
    try { detalle = (await res.json()).detail || '' } catch { /* sin cuerpo */ }
    throw new Error(detalle || `Error ${res.status}`)
  }
  return res.json()
}

const get = (ruta) => fetch(`${API}${ruta}`).then(json)
const post = (ruta, cuerpo) =>
  fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  }).then(json)

export const getConfig = () => get('/config')
export const getCatalogo = () => get('/catalogo')
export const getDepartamentos = () => get('/departamentos')
export const getProvincias = (departamento) => get(`/provincias?departamento=${encodeURIComponent(departamento)}`)
export const getDistritos = (departamento, provincia) =>
  get(`/distritos?departamento=${encodeURIComponent(departamento)}${provincia ? `&provincia=${encodeURIComponent(provincia)}` : ''}`)
export const getCentroide = (departamento, provincia, distrito) =>
  get(`/centroide?departamento=${encodeURIComponent(departamento)}&provincia=${encodeURIComponent(provincia)}&distrito=${encodeURIComponent(distrito)}`)
export const getUbicacion = (lat, lon) => get(`/ubicar?lat=${lat}&lon=${lon}`)

export const consultarPunto = (cuerpo) => post('/punto', cuerpo)
export const consultarArea = (cuerpo) => post('/area', cuerpo)
export const consultarDivision = (cuerpo) => post('/division', cuerpo)

export async function exportar(tipo, payload, nombre, formato) {
  const res = await fetch(`${API}/exportar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formato, tipo, payload, nombre }),
  })
  if (!res.ok) throw new Error('No se pudo exportar')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre}.${formato}`
  a.click()
  URL.revokeObjectURL(url)
}

export function descargarCSV(filas, nombre) {
  if (!filas.length) return
  const columnas = Object.keys(filas[0])
  const escapar = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const cuerpo = [
    columnas.join(','),
    ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(',')),
  ].join('\n')
  const blob = new Blob(['\ufeff' + cuerpo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
