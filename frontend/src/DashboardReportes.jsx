import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const normalizedApiUrl = rawApiUrl.replace(/\/$/, '')
const fallbackApiOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const API_BASE = normalizedApiUrl
  ? (normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`)
  : (fallbackApiOrigin ? `${fallbackApiOrigin}/api` : '/api')

const USER_ROLE_HEADER = { 'X-User-Role': 'Admin' }
const MODALIDAD_ACADEMICA = 'Modalidad Académica'
const MODALIDAD_TECNICO = 'Modalidad Técnico Profesional'

function normalizeLabel(value, fallback) {
  const text = (value ?? '').toString().trim()
  return text || fallback
}

function normalizeModalidad(value) {
  const text = (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!text) return MODALIDAD_ACADEMICA
  if (text.includes('tecnico')) return MODALIDAD_TECNICO
  return MODALIDAD_ACADEMICA
}

function DashboardReportes({ refreshKey = 0 }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [students, setStudents] = useState([])

  useEffect(() => {
    let isMounted = true

    const fetchReportData = async () => {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(`${API_BASE}/AllExampleData`, {
          headers: USER_ROLE_HEADER,
        })

        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`)
        }

        const payload = await response.json()
        if (!isMounted) return
        setStudents(Array.isArray(payload) ? payload : [])
      } catch (err) {
        if (!isMounted) return
        setStudents([])
        setError(err instanceof Error ? err.message : 'No fue posible cargar los reportes')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchReportData()

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  const reportData = useMemo(() => {
    const byCentroMap = new Map()
    const byModalidadMap = new Map([
      [MODALIDAD_ACADEMICA, 0],
      [MODALIDAD_TECNICO, 0],
    ])

    for (const student of students) {
      const centro = normalizeLabel(student?.centroEducativo, 'Sin centro educativo')
      const modalidad = normalizeModalidad(student?.modalidadAcademica)

      byCentroMap.set(centro, (byCentroMap.get(centro) || 0) + 1)
      byModalidadMap.set(modalidad, (byModalidadMap.get(modalidad) || 0) + 1)
    }

    const byCentroEducativo = Array.from(byCentroMap.entries())
      .map(([centroEducativo, total]) => ({ centroEducativo, total }))
      .sort((a, b) => b.total - a.total)

    const byModalidadAcademica = Array.from(byModalidadMap.entries())
      .map(([modalidad, total]) => ({ modalidad, total }))

    return {
      byModalidadAcademica,
      byCentroEducativo,
    }
  }, [students])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-semibold text-slate-800">Dashboard de Reportes</h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          Total: {students.length}
        </span>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Cargando reportes...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar reportes: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              Cantidad de estudiantes por modalidad
            </h3>
            {reportData.byModalidadAcademica.length === 0 ? (
              <p className="text-sm text-slate-500">No hay datos para mostrar.</p>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reportData.byModalidadAcademica}
                    margin={{ top: 8, right: 10, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="modalidad"
                      interval={0}
                      height={40}
                      tick={{ fontSize: 12, fill: '#334155' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#334155' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Estudiantes" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              Distribución por centro educativo
            </h3>
            {reportData.byCentroEducativo.length === 0 ? (
              <p className="text-sm text-slate-500">No hay datos para mostrar.</p>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reportData.byCentroEducativo}
                    margin={{ top: 8, right: 10, left: 0, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="centroEducativo"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={70}
                      tick={{ fontSize: 12, fill: '#334155' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#334155' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Estudiantes" fill="#0891b2" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  )
}

export default DashboardReportes
