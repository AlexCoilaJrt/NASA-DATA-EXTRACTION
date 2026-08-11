import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { MapContainer, TileLayer, Marker, Rectangle, useMap, useMapEvents } from 'react-leaflet'

const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATRIBUCION = '&copy; OpenStreetMap &copy; CARTO'

const iconoCian = L.divIcon({
  className: '',
  html: '<div class="marcador-pin"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

export function MapaBase({ centro, zoom = 6, altura = 420, children }) {
  return (
    <div className="mapa" style={{ height: altura }}>
      <MapContainer center={centro} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution={ATRIBUCION} url={TILES} />
        <CentroVivo centro={centro} />
        {children}
      </MapContainer>
    </div>
  )
}

function CentroVivo({ centro }) {
  const mapa = useMap()
  useEffect(() => {
    mapa.setView(centro, mapa.getZoom(), { animate: true })
  }, [centro[0], centro[1]])
  return null
}

export function Marcador({ lat, lon }) {
  return <Marker position={[lat, lon]} icon={iconoCian} />
}

export function ClicCoordenadas({ onClic }) {
  useMapEvents({
    click: (e) => onClic({ lat: e.latlng.lat, lon: e.latlng.lng }),
  })
  return null
}

export function Rectangulo({ bounds }) {
  return (
    <Rectangle
      bounds={[[bounds.latMin, bounds.lonMin], [bounds.latMax, bounds.lonMax]]}
      pathOptions={{ color: '#22d3ee', weight: 2, fillOpacity: 0.12 }}
    />
  )
}

export function DibujarRectangulo({ onCreado }) {
  const mapa = useMap()
  useEffect(() => {
    if (typeof L.Control.Draw === 'undefined') return
    const capa = new L.FeatureGroup().addTo(mapa)
    const control = new L.Control.Draw({
      position: 'topright',
      draw: {
        rectangle: true, polygon: false, polyline: false,
        circle: false, circlemarker: false, marker: false,
      },
      edit: { featureGroup: capa },
    })
    mapa.addControl(control)
    const crear = (e) => {
      capa.clearLayers()
      capa.addLayer(e.layer)
      const b = e.layer.getBounds()
      onCreado({ latMin: b.getSouth(), latMax: b.getNorth(), lonMin: b.getWest(), lonMax: b.getEast() })
    }
    mapa.on(L.Draw.Event.CREATED, crear)
    return () => {
      mapa.removeControl(control)
      mapa.removeLayer(capa)
      mapa.off(L.Draw.Event.CREATED, crear)
    }
  }, [mapa])
  return null
}
