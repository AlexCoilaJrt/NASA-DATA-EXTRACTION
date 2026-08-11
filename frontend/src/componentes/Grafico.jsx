import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const ACENTO = '#22d3ee'
const REJILLA = '#1d2b4d'
const PALETA = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#fb923c', '#4ade80', '#f87171', '#c084fc', '#2dd4bf', '#facc15']

function formatearFechas(v) {
  return v.replace(/-/g, '/').slice(5)
}

function estiloTooltip() {
  return {
    background: '#0c1326', border: '1px solid #1d2b4d', borderRadius: 10,
    fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.5)',
  }
}

export default function Grafico({ datos, parametro, unidad = '', altura = 270 }) {
  const serie = (datos || [])
    .map((f) => ({ fecha: f.date, valor: f[parametro] }))
    .filter((p) => p.valor != null)

  if (!serie.length) return null

  return (
    <div className="grafico">
      <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#aab4d0', marginBottom: 6 }}>
        {parametro} <span style={{ color: '#6b7896', fontWeight: 400 }}>({unidad})</span>
      </div>
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={serie} margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={REJILLA} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="fecha"
            tickFormatter={formatearFechas}
            stroke="#566381"
            fontSize={11}
            minTickGap={44}
            axisLine={{ stroke: REJILLA }}
            tickLine={false}
          />
          <YAxis stroke="#566381" fontSize={11} width={46} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: ACENTO, strokeOpacity: 0.25 }}
            contentStyle={estiloTooltip()}
            labelStyle={{ color: '#6b7896', fontWeight: 600 }}
            itemStyle={{ color: ACENTO }}
            formatter={(valor) => [valor != null ? Number(valor).toFixed(2) : '—', parametro]}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke={ACENTO}
            strokeWidth={2.2}
            dot={false}
            connectNulls
            activeDot={{ r: 4, fill: ACENTO, stroke: '#0a0f1f', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoMulti({ series, parametro, unidad = '', altura = 300 }) {
  const unidades = Object.keys(series)
  if (!unidades.length) return null

  return (
    <div className="grafico">
      <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#aab4d0', marginBottom: 6 }}>
        {parametro} <span style={{ color: '#6b7896', fontWeight: 400 }}>({unidad}) · {unidades.length} serie(s)</span>
      </div>
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={REJILLA} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="fecha"
            tickFormatter={formatearFechas}
            stroke="#566381"
            fontSize={11}
            minTickGap={44}
            axisLine={{ stroke: REJILLA }}
            tickLine={false}
          />
          <YAxis stroke="#566381" fontSize={11} width={46} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: ACENTO, strokeOpacity: 0.25 }}
            contentStyle={estiloTooltip()}
            labelStyle={{ color: '#6b7896', fontWeight: 600 }}
          />
          {unidades.map((u, i) => (
            <Line
              key={u}
              type="monotone"
              data={series[u]}
              dataKey="valor"
              name={u}
              stroke={PALETA[i % PALETA.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
              activeDot={{ r: 3.5, stroke: '#0a0f1f', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
