import { useEffect, useMemo, useState } from 'react'

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const normalizedApiUrl = rawApiUrl.replace(/\/$/, '')
const fallbackApiOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const API_BASE = normalizedApiUrl
  ? (normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`)
  : (fallbackApiOrigin ? `${fallbackApiOrigin}/api` : '/api')
const USER_ROLE_HEADER = { 'X-User-Role': 'Admin' }

function normalizeText(value) {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function Reportes({ refreshKey = 0 }) {
  const [loadingReport, setLoadingReport] = useState(true)
  const [reportError, setReportError] = useState('')
  const [reportData, setReportData] = useState([])

  const fetchReportData = async () => {
    try {
      setLoadingReport(true)
      setReportError('')

      const response = await fetch(`${API_BASE}/AllExampleData`, {
        headers: USER_ROLE_HEADER,
      })

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`)
      }

      const payload = await response.json()
      setReportData(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setReportData([])
      setReportError(err instanceof Error ? err.message : 'No fue posible cargar los reportes')
    } finally {
      setLoadingReport(false)
    }
  }

  useEffect(() => {
    fetchReportData()
  }, [refreshKey])

  const kpis = useMemo(() => {
    const distribucion = {}

    for (const item of reportData) {
      const modalidadOriginal = item.modalidadAcademica || 'Sin modalidad'
      const modalidadKey = normalizeText(modalidadOriginal) || 'sin modalidad'
      distribucion[modalidadKey] = {
        label: modalidadOriginal,
        total: (distribucion[modalidadKey]?.total || 0) + 1,
      }
    }

    const distribucionOrdenada = Object.values(distribucion).sort((a, b) => b.total - a.total)

    return {
      totalEstudiantes: reportData.length,
      tendencia: reportData.length,
      distribucion: distribucionOrdenada,
    }
  }, [reportData])

  return (
    <section style={{ background: '#ffffff', border: '1px solid #dbe5f2', borderRadius: '14px', boxShadow: '0 8px 24px rgba(2, 24, 63, 0.06)', padding: '16px' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>Reportes de Inteligencia de Negocios</h2>

      {loadingReport && <p>Cargando reportes...</p>}

      {reportError && (
        <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px' }}>
          Error en reportes: {reportError}
        </div>
      )}

      {!loadingReport && !reportError && (
        <>
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <article style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 6px', color: '#1e3a8a', fontWeight: 600 }}>Total de estudiantes</p>
              <strong style={{ fontSize: '1.5rem' }}>{kpis.totalEstudiantes}</strong>
            </article>
            <article style={{ background: '#ecfeff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 6px', color: '#155e75', fontWeight: 600 }}>Tendencia (registros)</p>
              <strong style={{ fontSize: '1.5rem' }}>{kpis.tendencia}</strong>
            </article>
            <article style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 6px', color: '#334155', fontWeight: 600 }}>Modalidades registradas</p>
              <strong style={{ fontSize: '1.5rem' }}>{kpis.distribucion.length}</strong>
            </article>
          </div>

          <div style={{ marginTop: '14px', display: 'grid', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Distribución por modalidad</h3>
            {kpis.distribucion.length === 0 && <p style={{ margin: 0 }}>Sin datos disponibles.</p>}
            {kpis.distribucion.map((item) => {
              const porcentaje = kpis.totalEstudiantes > 0 ? Math.round((item.total / kpis.totalEstudiantes) * 100) : 0
              return (
                <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', background: '#fafcff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span>{item.label}</span>
                    <strong>{item.total} ({porcentaje}%)</strong>
                  </div>
                  <div style={{ marginTop: '6px', height: '8px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ width: `${porcentaje}%`, height: '100%', background: '#2563eb' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

export default Reportes
