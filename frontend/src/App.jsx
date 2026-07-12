import { useEffect, useMemo, useState } from 'react'

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const normalizedApiUrl = rawApiUrl.replace(/\/$/, '')
const fallbackApiOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const API_BASE = normalizedApiUrl
  ? (normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`)
  : (fallbackApiOrigin ? `${fallbackApiOrigin}/api` : '/api')
const USER_ROLE_HEADER = { 'X-User-Role': 'Admin' }

const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(145deg, #f7fbff 0%, #eef4ff 40%, #f6fff8 100%)',
  padding: '28px 16px 48px',
  color: '#0f172a',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
}

const shellStyle = {
  maxWidth: '1120px',
  margin: '0 auto',
  display: 'grid',
  gap: '18px',
}

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #dbe5f2',
  borderRadius: '14px',
  boxShadow: '0 8px 24px rgba(2, 24, 63, 0.06)',
}

function normalizeText(value) {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [students, setStudents] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    cedula: '',
    centroEducativo: '',
    modalidadAcademica: 'Académica',
  })

  const fetchStudents = async () => {
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
      setStudents(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setStudents([])
      setError(err instanceof Error ? err.message : 'No fue posible obtener los estudiantes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const reportes = useMemo(() => {
    let academica = 0
    let tecnico = 0

    for (const student of students) {
      const modalidad = normalizeText(student.modalidadAcademica)
      if (modalidad === 'academica') {
        academica += 1
      }
      if (modalidad === 'tecnico profesional') {
        tecnico += 1
      }
    }

    return {
      total: students.length,
      academica,
      tecnico,
    }
  }, [students])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    if (!form.nombre.trim() || !form.cedula.trim() || !form.centroEducativo.trim()) {
      setError('Completa Nombre, Cédula y Centro Educativo para registrar el estudiante.')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const generatedRne = `RNE-${Date.now()}`
      const payload = {
        nombre: form.nombre.trim(),
        cedula: form.cedula.trim(),
        centroEducativo: form.centroEducativo.trim(),
        modalidadAcademica: form.modalidadAcademica,
        rne: generatedRne,
      }

      const response = await fetch(`${API_BASE}/CreateExample`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...USER_ROLE_HEADER,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`)
      }

      setForm({
        nombre: '',
        cedula: '',
        centroEducativo: '',
        modalidadAcademica: 'Académica',
      })

      await fetchStudents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear el estudiante')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!id || deletingId) return

    try {
      setDeletingId(id)
      setError('')

      const response = await fetch(`${API_BASE}/DeleteExample/${id}`, {
        method: 'DELETE',
        headers: USER_ROLE_HEADER,
      })

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`)
      }

      await fetchStudents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible eliminar el estudiante')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header style={{ ...cardStyle, padding: '18px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.7rem' }}>EDUMETRICS-DR | Gestión de Estudiantes</h1>
          <p style={{ margin: 0, color: '#4b5563' }}>Fuente API: {API_BASE}/AllExampleData</p>
        </header>

        <section style={{ ...cardStyle, padding: '16px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>Reportes Estadísticos</h2>
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <article style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 6px', color: '#1e3a8a', fontWeight: 600 }}>Total de estudiantes</p>
              <strong style={{ fontSize: '1.5rem' }}>{reportes.total}</strong>
            </article>
            <article style={{ background: '#ecfeff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 6px', color: '#155e75', fontWeight: 600 }}>Modalidad Académica</p>
              <strong style={{ fontSize: '1.5rem' }}>{reportes.academica}</strong>
            </article>
            <article style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 6px', color: '#166534', fontWeight: 600 }}>Técnico Profesional</p>
              <strong style={{ fontSize: '1.5rem' }}>{reportes.tecnico}</strong>
            </article>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: '16px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>Formulario de Registro</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span>Nombre</span>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleInputChange}
                placeholder="Ej: Juan Pérez"
                style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span>Cédula</span>
              <input
                type="text"
                name="cedula"
                value={form.cedula}
                onChange={handleInputChange}
                placeholder="000-0000000-0"
                style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span>Centro Educativo</span>
              <input
                type="text"
                name="centroEducativo"
                value={form.centroEducativo}
                onChange={handleInputChange}
                placeholder="Ej: Liceo Unión Panamericana"
                style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span>Modalidad Académica</span>
              <select
                name="modalidadAcademica"
                value={form.modalidadAcademica}
                onChange={handleInputChange}
                style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', background: '#fff' }}
              >
                <option value="Académica">Académica</option>
                <option value="Técnico Profesional">Técnico Profesional</option>
              </select>
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: 'none',
                  background: submitting ? '#94a3b8' : '#0f766e',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Registrando...' : 'Registrar estudiante'}
              </button>
            </div>
          </form>
        </section>

        <section style={{ ...cardStyle, padding: '16px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>Listado de Estudiantes</h2>

          {loading && <p>Cargando datos...</p>}

          {error && (
            <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px' }}>
              Error: {error}
            </div>
          )}

          {!loading && !error && students.length === 0 && <p>No se encontraron estudiantes.</p>}

          {!loading && students.length > 0 && (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #e2e8f0' }}>Nombre</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #e2e8f0' }}>Cédula</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #e2e8f0' }}>Centro Educativo</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #e2e8f0' }}>Modalidad</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #e2e8f0' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.id ?? student.rne ?? index}>
                      <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{student.nombre ?? '-'}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{student.cedula ?? '-'}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{student.centroEducativo ?? '-'}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{student.modalidadAcademica ?? '-'}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(student.id)}
                          disabled={!student.id || deletingId === student.id}
                          style={{
                            border: '1px solid #ef4444',
                            background: deletingId === student.id ? '#fecaca' : '#fff1f2',
                            color: '#b91c1c',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            cursor: !student.id || deletingId === student.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {deletingId === student.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
