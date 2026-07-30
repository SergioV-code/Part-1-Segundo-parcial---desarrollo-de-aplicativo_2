import { useCallback, useEffect, useMemo, useState } from 'react'

// ─── API BASE ──────────────────────────────────────────────────────────────────
const PRODUCTION_API_BASE = 'https://part-1-segundo-parcial-desarrollo-de-aplicativ-production.up.railway.app/api'
const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const normalizedApiUrl = rawApiUrl.replace(/\/$/, '')
const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const API_BASE = normalizedApiUrl
  ? normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`
  : PRODUCTION_API_BASE

const localFallbackApi = fallbackOrigin.includes('localhost') ? `${fallbackOrigin}/api` : ''

const API_BASE_CANDIDATES = Array.from(new Set([
  API_BASE,
  localFallbackApi,
  PRODUCTION_API_BASE,
].filter(Boolean)))

// ─── HELPER CENTRALIZADO DE PETICIONES HTTP ────────────────────────────────────
/**
 * apiRequest – wrapper centralizado para todas las llamadas al backend.
 * Maneja automáticamente: URL base, Content-Type, Bearer token y errores semánticos.
 *
 * @param {string} path    – ruta relativa, ej: '/AllExampleData'
 * @param {object} options
 * @param {string} options.method  – 'GET' | 'POST' | 'PUT' | 'DELETE'
 * @param {string} options.token   – JWT Bearer token
 * @param {object} options.body    – payload para POST / PUT (se serializa a JSON)
 * @returns {Promise<any>} – JSON parseado o null si sin body
 */
async function apiRequest(path, { method = 'GET', token = '', body = null } = {}) {
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  }

  let lastError = null

  for (const base of API_BASE_CANDIDATES) {
    const url = `${base}${path}`
    try {
      const res = await fetch(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })

      const text = await res.text()
      let payload = null
      try { payload = text ? JSON.parse(text) : null } catch { payload = null }

      if (!res.ok) {
        const detail = payload?.error || payload?.message || payload?.detail || payload?.title || res.statusText || 'Error inesperado'
        if (res.status >= 500 || res.status === 404 || res.status === 405) {
          lastError = new Error(`HTTP ${res.status} - ${detail}`)
          continue
        }

        throw new Error(`HTTP ${res.status} - ${detail}`)
      }

      return payload
    } catch (error) {
      const message = error?.message || ''
      if (/HTTP 4\d\d/i.test(message)) {
        throw error
      }
      lastError = error
    }
  }

  const message = lastError?.message || ''
  if (/Failed to fetch|NetworkError|Load failed|HTTP 5\d\d|HTTP 404|HTTP 405/i.test(message)) {
    throw new Error('No fue posible conectar con la API. Verifica que el backend de Railway esté activo y respondiendo (health endpoint).')
  }

  throw new Error(`Error de red: ${message || 'conexión no disponible'}`)
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const MOD_ACADEMICA = 'Modalidad Academica'
const MOD_TECNICO   = 'Modalidad Tecnico Profesional'

const TAB_INICIO     = 'Inicio'
const TAB_GESTION    = 'Gestion de Expedientes'
const TAB_FORMULARIO = 'Formulario de Registro'
const TAB_REPORTES   = 'Reportes Empresariales'
const TAB_AUDITORIA  = 'Registro de Auditoria'
const GOV_TABS = [TAB_INICIO, TAB_GESTION, TAB_FORMULARIO, TAB_REPORTES, TAB_AUDITORIA]

const TAB_PERFIL = 'Mi Perfil'
const TAB_PENSUM = 'Mi Pensum'
const TAB_BECAS  = 'Oportunidades y Becas'
const STU_TABS   = [TAB_PERFIL, TAB_PENSUM, TAB_BECAS]

const ROLES = ['Analista MINERD', 'Analista MESCYT', 'Estudiante']
const ROL_COLORS = {
  'Analista MINERD': { bg: '#0f3a7a', badge: 'bg-blue-100 text-blue-900' },
  'Analista MESCYT': { bg: '#075985', badge: 'bg-cyan-100 text-cyan-900' },
  'Estudiante':      { bg: '#166534', badge: 'bg-emerald-100 text-emerald-900' },
}

const isGov = rol => rol === 'Analista MINERD' || rol === 'Analista MESCYT'

// Datos de demo para la vista estudiantil
const DEMO_PENSUM = [
  { codigo: 'MAT-101', nombre: 'Matemáticas I',       creditos: 4, estado: 'Aprobada',  nota: 92   },
  { codigo: 'ESP-101', nombre: 'Español y Redacción',  creditos: 3, estado: 'Aprobada',  nota: 88   },
  { codigo: 'FIS-101', nombre: 'Física General',       creditos: 4, estado: 'Cursando',  nota: null },
  { codigo: 'INF-201', nombre: 'Programación I',       creditos: 3, estado: 'Cursando',  nota: null },
  { codigo: 'MAT-201', nombre: 'Matemáticas II',       creditos: 4, estado: 'Pendiente', nota: null },
  { codigo: 'QUI-101', nombre: 'Química General',      creditos: 3, estado: 'Pendiente', nota: null },
  { codigo: 'SOC-101', nombre: 'Formación Social',     creditos: 2, estado: 'Aprobada',  nota: 95   },
  { codigo: 'ING-101', nombre: 'Inglés Técnico I',     creditos: 3, estado: 'Aprobada',  nota: 85   },
]

const DEMO_BECAS = [
  {
    nombre: 'Beca MESCYT Excelencia',
    entidad: 'MESCYT',
    monto: 'RD$ 25,000 / año',
    requisito: 'Promedio ≥ 85 | Modalidad Académica',
    cierre: '2026-08-31',
    url: 'https://mescyt.gob.do',
    color: 'border-blue-300 bg-blue-50',
    badge: 'bg-blue-100 text-blue-800',
  },
  {
    nombre: 'Beca Técnico Profesional INFOTEP',
    entidad: 'INFOTEP',
    monto: 'Costo de curso cubierto',
    requisito: 'Modalidad Técnico Profesional',
    cierre: '2026-09-15',
    url: 'https://infotep.gob.do',
    color: 'border-emerald-300 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  {
    nombre: 'Programa Jóvenes con Futuro',
    entidad: 'MINERD',
    monto: 'RD$ 15,000 / semestre',
    requisito: 'Nivel secundario | Zona rural prioritaria',
    cierre: '2026-10-01',
    url: 'https://minerd.gob.do',
    color: 'border-violet-300 bg-violet-50',
    badge: 'bg-violet-100 text-violet-800',
  },
  {
    nombre: 'Beca BID Innovación STEM',
    entidad: 'Banco Interamericano de Desarrollo',
    monto: 'US$ 5,000',
    requisito: 'Proyecto STEM aprobado | Promedio ≥ 90',
    cierre: '2026-11-30',
    url: 'https://iadb.org',
    color: 'border-amber-300 bg-amber-50',
    badge: 'bg-amber-100 text-amber-800',
  },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function normalizeModalidad(value) {
  const text = (value ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (!text) return MOD_ACADEMICA
  if (text.includes('tecnico')) return MOD_TECNICO
  return MOD_ACADEMICA
}

function fmt(isoString) {
  try { return new Date(isoString).toLocaleString('es-DO') } catch { return isoString }
}

function fmtDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return isoString }
}

// ─── ESTILOS BASE ─────────────────────────────────────────────────────────────
const pageStyle = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top left,#eff6ff 0%,#f8fafc 45%,#ecfeff 100%)',
  fontFamily: 'Manrope, Segoe UI, system-ui, sans-serif',
  color: '#0b1220',
}
const card = 'bg-white border border-slate-200 rounded-2xl shadow-sm'

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────
function KpiCard({ label, value, colorBorder, colorBg, colorText, colorValue }) {
  return (
    <article className={`rounded-xl border ${colorBorder} ${colorBg} p-5`}>
      <p className={`text-sm font-semibold ${colorText}`}>{label}</p>
      <strong className={`mt-1 block text-4xl font-bold ${colorValue}`}>{value}</strong>
    </article>
  )
}

function ProgressBar({ label, value, pct, colorBar }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-slate-700">
        <span>{label}</span>
        <strong>{value} estudiantes ({pct}%)</strong>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${colorBar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EstadoBadge({ estado }) {
  const map = {
    Aprobada:  'bg-emerald-100 text-emerald-800',
    Cursando:  'bg-blue-100 text-blue-800',
    Pendiente: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[estado] ?? 'bg-slate-100 text-slate-600'}`}>
      {estado}
    </span>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function App() {
  // Auth / sesión
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken]             = useState('')
  const [activeRole, setActiveRole]           = useState(ROLES[0])
  const [loginForm, setLoginForm]             = useState({ usuario: '', contrasena: '', rol: ROLES[0] })
  const [loginError, setLoginError]           = useState('')

  // Navegación
  const [activeTab, setActiveTab] = useState(TAB_INICIO)

  // Datos de estudiantes
  const [students,  setStudents]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [dataError, setDataError] = useState('')

  // Formulario de alta / edición
  const emptyForm = { nombre: '', cedula: '', centroEducativo: '', modalidadAcademica: MOD_ACADEMICA }
  const [form,          setForm]          = useState(emptyForm)
  const [editingId,     setEditingId]     = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [formError,     setFormError]     = useState('')
  const [formSuccess,   setFormSuccess]   = useState('')

  // Tabla gestión
  const [cedulaSearch, setCedulaSearch] = useState('')
  const [modFilter,    setModFilter]    = useState('Todos')
  const [deletingId,   setDeletingId]   = useState('')

  // Auditoría
  const [auditLogs, setAuditLogs] = useState([])
  const [studentProfileData, setStudentProfileData] = useState(null)

  // ── Auditoría helper ────────────────────────────────────────────────────────
  const pushAudit = useCallback((accion, detalles, rol) =>
    setAuditLogs(prev => [{
      id:      `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fecha:   new Date().toISOString(),
      usuario: rol,
      accion,
      detalles,
    }, ...prev]), [])

  // ── Fetch de estudiantes ────────────────────────────────────────────────────
  const fetchStudents = useCallback(async token => {
    try {
      setLoading(true)
      setDataError('')
      const raw = await apiRequest('/AllExampleData', { method: 'GET', token })
      setStudents(Array.isArray(raw)
        ? raw.map(s => ({ ...s, modalidadAcademica: normalizeModalidad(s?.modalidadAcademica) }))
        : [])
    } catch (e) {
      setDataError(e.message || 'Error de conexión')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStudentProfile = useCallback(async token => {
    try {
      const profile = await apiRequest('/student/profile', { method: 'GET', token })
      setStudentProfileData(profile)
    } catch {
      setStudentProfileData(null)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !authToken) return
    if (isGov(activeRole)) {
      fetchStudents(authToken)
    } else {
      fetchStudentProfile(authToken)
    }
  }, [isAuthenticated, authToken, activeRole, fetchStudents, fetchStudentProfile])

  // ── Login ───────────────────────────────────────────────────────────────────
  const handleLoginChange = e => {
    setLoginForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setLoginError('')
  }

  const handleLogin = async e => {
    e.preventDefault()
    const esEstudiante = loginForm.rol === 'Estudiante'
    if (!loginForm.usuario.trim() || (!loginForm.contrasena.trim() && !esEstudiante)) {
      setLoginError(esEstudiante
        ? 'Ingresa tu cédula para continuar.'
        : 'Ingresa usuario y contraseña para continuar.')
      return
    }

    try {
      setLoginError('')
      let response
      if (esEstudiante) {
        response = await apiRequest('/Auth/login/estudiante', {
          method: 'POST',
          body: { cedula: loginForm.usuario.trim() },
        })
      } else {
        response = await apiRequest('/Auth/login/analista', {
          method: 'POST',
          body: {
            rol: loginForm.rol,
            correoInstitucional: loginForm.usuario.trim(),
            password: loginForm.contrasena,
          },
        })
      }

      if (!response?.token) {
        throw new Error('No se recibió token de autenticación.')
      }

      const rol = response.rol || loginForm.rol
      setAuthToken(response.token)
      setIsAuthenticated(true)
      setActiveRole(rol)
      setActiveTab(isGov(rol) ? TAB_INICIO : TAB_PERFIL)
      pushAudit(
        'SESION_INICIO',
        `${esEstudiante ? 'Estudiante cédula' : 'Usuario'} ${loginForm.usuario.trim()} inició sesión como ${rol}`,
        rol,
      )
    } catch (error) {
      setLoginError(error.message || 'No fue posible iniciar sesión.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setLoginForm({ usuario: '', contrasena: '', rol: ROLES[0] })
    setLoginError('')
    setAuthToken('')
    setStudents([])
    setStudentProfileData(null)
    setAuditLogs([])
    setActiveTab(TAB_INICIO)
    cancelEdit()
  }

  // ── Formulario de expedientes ───────────────────────────────────────────────
  const startEdit = student => {
    setEditingId(student.id)
    setEditingRecord(student)
    setForm({
      nombre:             student.nombre || '',
      cedula:             student.cedula || '',
      centroEducativo:    student.centroEducativo || '',
      modalidadAcademica: normalizeModalidad(student.modalidadAcademica),
    })
    setFormError('')
    setFormSuccess('')
    setActiveTab(TAB_FORMULARIO)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingRecord(null)
    setForm(emptyForm)
    setFormError('')
    setFormSuccess('')
  }

  const handleFormChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.cedula.trim() || !form.centroEducativo.trim()) {
      setFormError('Nombre, Cédula y Centro Educativo son obligatorios.')
      return
    }
    try {
      setSubmitting(true)
      setFormError('')
      setFormSuccess('')

      if (editingId) {
        const payload = {
          ...editingRecord,
          nombre:             form.nombre.trim(),
          cedula:             form.cedula.trim(),
          centroEducativo:    form.centroEducativo.trim(),
          modalidadAcademica: normalizeModalidad(form.modalidadAcademica),
          fechaActualizacion: new Date().toISOString(),
        }
        await apiRequest(`/ChangeExampleData/${editingId}`, { method: 'PUT', token: authToken, body: payload })
        pushAudit('ACTUALIZAR', `Usuario [${activeRole}] modificó expediente cédula ${form.cedula.trim()}`, activeRole)
        setFormSuccess('Expediente actualizado correctamente.')
      } else {
        const payload = {
          nombre:             form.nombre.trim(),
          cedula:             form.cedula.trim(),
          centroEducativo:    form.centroEducativo.trim(),
          modalidadAcademica: normalizeModalidad(form.modalidadAcademica),
          rne:                `RNE-${Date.now()}`,
        }
        await apiRequest('/CreateExample', { method: 'POST', token: authToken, body: payload })
        pushAudit('CREAR', `Usuario [${activeRole}] creó registro para cédula ${form.cedula.trim()}`, activeRole)
        setFormSuccess('Expediente registrado correctamente.')
      }

      cancelEdit()
      await fetchStudents(authToken)
    } catch (e) {
      setFormError(e.message || 'No se pudo completar la operación.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async id => {
    if (!id || deletingId) return
    if (!window.confirm('¿Seguro que deseas eliminar este expediente? Esta acción no se puede deshacer.')) return
    try {
      setDeletingId(id)
      await apiRequest(`/DeleteExample/${id}`, { method: 'DELETE', token: authToken })
      pushAudit('ELIMINAR', `Usuario [${activeRole}] eliminó expediente id ${id}`, activeRole)
      await fetchStudents(authToken)
    } catch (e) {
      setFormError(`No se pudo eliminar: ${e.message || 'Error desconocido'}`)
      setActiveTab(TAB_FORMULARIO)
    } finally {
      setDeletingId('')
    }
  }

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total     = students.length
    const academica = students.filter(s => normalizeModalidad(s.modalidadAcademica) === MOD_ACADEMICA).length
    const tecnico   = students.filter(s => normalizeModalidad(s.modalidadAcademica) === MOD_TECNICO).length
    return {
      total, academica, tecnico,
      pctAcademica: total > 0 ? Math.round((academica / total) * 100) : 0,
      pctTecnico:   total > 0 ? Math.round((tecnico   / total) * 100) : 0,
    }
  }, [students])

  const gestionRows = useMemo(() =>
    students.filter(s => {
      const okCedula = (s.cedula || '').toLowerCase().includes(cedulaSearch.toLowerCase().trim())
      const okMod    = modFilter === 'Todos' || normalizeModalidad(s.modalidadAcademica) === modFilter
      return okCedula && okMod
    }), [students, cedulaSearch, modFilter])

  const byCentro = useMemo(() => {
    const total = students.length || 1
    const map = {}
    for (const s of students) {
      const k = (s.centroEducativo || 'Sin centro').toString().trim() || 'Sin centro'
      map[k] = (map[k] || 0) + 1
    }
    return Object.entries(map)
      .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
  }, [students])

  const studentProfile = useMemo(() => {
    if (isGov(activeRole)) return null
    if (studentProfileData) {
      return { ...studentProfileData, modalidadAcademica: normalizeModalidad(studentProfileData.modalidadAcademica) }
    }
    const cedula = loginForm.usuario.trim()
    return students.find(s => (s.cedula || '').replace(/-/g, '') === cedula.replace(/-/g, ''))
      || { nombre: `Estudiante ${cedula}`, cedula, centroEducativo: '—', modalidadAcademica: MOD_ACADEMICA }
  }, [students, studentProfileData, loginForm.usuario, activeRole])

  const pensumStats = useMemo(() => {
    const aprobadas = DEMO_PENSUM.filter(m => m.estado === 'Aprobada').length
    const cursando  = DEMO_PENSUM.filter(m => m.estado === 'Cursando').length
    const total     = DEMO_PENSUM.length
    const conNota   = DEMO_PENSUM.filter(m => m.nota !== null)
    const promedio  = conNota.length > 0
      ? conNota.reduce((acc, m) => acc + m.nota, 0) / conNota.length
      : 0
    return { aprobadas, cursando, total, promedio: Math.round(promedio) }
  }, [])

  // ────────────────────────────────────────────────────────────────────────────
  // PANTALLA DE LOGIN
  // ────────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    const esEstudiante = loginForm.rol === 'Estudiante'
    return (
      <div style={pageStyle} className="flex min-h-screen items-center justify-center p-4">
        <div className={`${card} w-full max-w-md p-8`}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white text-2xl font-bold select-none">E</div>
            <h1 className="text-2xl font-bold text-slate-800">EDUMETRICS-DR</h1>
            <p className="mt-1 text-sm text-slate-500">Sistema Educativo Dominicano MINERD / MESCYT</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Rol de acceso</label>
              <select
                name="rol"
                value={loginForm.rol}
                onChange={handleLoginChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {esEstudiante ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cédula de identidad</label>
                <input
                  type="text"
                  name="usuario"
                  value={loginForm.usuario}
                  onChange={handleLoginChange}
                  placeholder="000-0000000-0"
                  autoComplete="username"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-600">Ingresa tu cédula para acceder al portal estudiantil.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Usuario institucional</label>
                  <input
                    type="text"
                    name="usuario"
                    value={loginForm.usuario}
                    onChange={handleLoginChange}
                    placeholder={loginForm.rol === 'Analista MINERD' ? 'usuario@minerd.gob.do' : 'usuario@mescyt.gob.do'}
                    autoComplete="username"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Contraseña</label>
                  <input
                    type="password"
                    name="contrasena"
                    value={loginForm.contrasena}
                    onChange={handleLoginChange}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            {loginError && (
              <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loginError}</p>
            )}

            <button
              type="submit"
              className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors ${
                esEstudiante ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              Iniciar sesión
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-600">
            Acceso restringido — Gobierno y estudiantes autorizados.
          </p>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VISTAS AUTENTICADAS
  // ────────────────────────────────────────────────────────────────────────────
  const roleColor = ROL_COLORS[activeRole] || ROL_COLORS[ROLES[0]]

  return (
    <div style={pageStyle} className="min-h-screen">

      {/* ── NAVBAR ── */}
      <header style={{ background: roleColor.bg }} className="sticky top-0 z-10 shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white font-bold select-none">E</div>
            <span className="text-lg font-bold text-white">EDUMETRICS-DR</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${roleColor.badge}`}>{activeRole}</span>
          </div>

          <nav className="flex flex-wrap gap-1" aria-label="Navegación principal">
            {(isGov(activeRole) ? GOV_TABS : STU_TABS).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                className={
                  activeTab === tab
                    ? 'rounded-md bg-white/25 px-3 py-1.5 text-sm font-semibold text-white'
                    : 'rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/15 hover:text-white transition-colors'
                }
              >
                {tab}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-white hover:bg-white/15 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">

        {/* ── TOAST ÉXITO GLOBAL ── */}
        {formSuccess && (
          <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 flex items-center justify-between">
            <span>✓ {formSuccess}</span>
            <button type="button" onClick={() => setFormSuccess('')} className="ml-4 font-bold text-emerald-600 hover:text-emerald-800">✕</button>
          </div>
        )}

        {/* ── FORMULARIO (gubernamental, siempre en DOM para preservar estado) ── */}
        <div
          className={`${card} p-5`}
          style={{ display: activeTab === TAB_FORMULARIO && isGov(activeRole) ? 'block' : 'none' }}
          aria-hidden={activeTab !== TAB_FORMULARIO}
        >
          <h2 className="mb-4 text-base font-semibold text-slate-800">
            {editingId ? '✏️ Actualizar expediente seleccionado' : '➕ Agregar nuevo expediente'}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" noValidate>
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Nombre completo <span className="text-rose-500">*</span></span>
              <input type="text" name="nombre" value={form.nombre} onChange={handleFormChange}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="María Pérez" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Cédula <span className="text-rose-500">*</span></span>
              <input type="text" name="cedula" value={form.cedula} onChange={handleFormChange}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="000-0000000-0" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Centro educativo <span className="text-rose-500">*</span></span>
              <input type="text" name="centroEducativo" value={form.centroEducativo} onChange={handleFormChange}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Liceo Unión Panamericana" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Modalidad</span>
              <select name="modalidadAcademica" value={form.modalidadAcademica} onChange={handleFormChange}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value={MOD_ACADEMICA}>{MOD_ACADEMICA}</option>
                <option value={MOD_TECNICO}>{MOD_TECNICO}</option>
              </select>
            </label>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              {editingId && (
                <button type="button" onClick={cancelEdit} disabled={submitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancelar edición
                </button>
              )}
              <button type="submit" disabled={submitting}
                style={{ background: submitting ? '#94a3b8' : roleColor.bg }}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors">
                {submitting ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar expediente'}
              </button>
            </div>
          </form>
          {formError && (
            <p role="alert" className="mt-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
          )}
        </div>

        {/* ═══ GUBERNAMENTAL: INICIO ═══ */}
        {activeTab === TAB_INICIO && isGov(activeRole) && (
          <section className={`${card} p-6 space-y-5`}>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bienvenido, {activeRole}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeRole === 'Analista MINERD'
                  ? 'Panel de gestión de expedientes para centros educativos del nivel pre-universitario (Escuelas y Politécnicos) bajo MINERD.'
                  : 'Panel de gestión de egresados y matriculados en instituciones de educación superior reguladas por MESCYT.'}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Total expedientes" value={loading ? '…' : kpis.total}
                colorBorder="border-blue-200" colorBg="bg-blue-50" colorText="text-blue-700" colorValue="text-blue-900" />
              <KpiCard label={MOD_ACADEMICA} value={loading ? '…' : kpis.academica}
                colorBorder="border-cyan-200" colorBg="bg-cyan-50" colorText="text-cyan-700" colorValue="text-cyan-900" />
              <KpiCard label={MOD_TECNICO} value={loading ? '…' : kpis.tecnico}
                colorBorder="border-emerald-200" colorBg="bg-emerald-50" colorText="text-emerald-700" colorValue="text-emerald-900" />
            </div>
            {dataError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <strong>Error al cargar datos:</strong> {dataError}
                <button type="button" onClick={() => fetchStudents(activeRole)} className="ml-3 underline font-medium">
                  Reintentar
                </button>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="mb-1 font-semibold text-slate-700">Endpoint activo:</p>
              <code className="rounded bg-slate-200 px-2 py-0.5 text-xs break-all">{API_BASE}/AllExampleData</code>
              <p className="mt-1 text-xs text-slate-600">
                Seguridad activa con token JWT Bearer y rol: <code className="bg-slate-200 px-1 rounded">{activeRole}</code>
              </p>
            </div>
          </section>
        )}

        {/* ═══ GUBERNAMENTAL: GESTIÓN ═══ */}
        {activeTab === TAB_GESTION && isGov(activeRole) && (
          <section className={`${card} p-5 space-y-4`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-slate-800">Gestión de Expedientes</h2>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                  {gestionRows.length} resultado{gestionRows.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => { setActiveTab(TAB_FORMULARIO); cancelEdit() }}
                  style={{ background: roleColor.bg }}
                  className="rounded-full px-3 py-1 font-semibold text-white"
                >
                  + Nuevo expediente
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Buscar por cédula</span>
                <input type="text" value={cedulaSearch} onChange={e => setCedulaSearch(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="000-0000000-0" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Filtrar por modalidad</span>
                <select value={modFilter} onChange={e => setModFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="Todos">Todas las modalidades</option>
                  <option value={MOD_ACADEMICA}>{MOD_ACADEMICA}</option>
                  <option value={MOD_TECNICO}>{MOD_TECNICO}</option>
                </select>
              </label>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                Cargando expedientes…
              </div>
            )}
            {dataError && (
              <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Error al cargar: {dataError}
              </p>
            )}
            {!loading && !dataError && gestionRows.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">
                <p className="text-sm text-slate-500">No hay expedientes con los filtros aplicados.</p>
                {(cedulaSearch || modFilter !== 'Todos') && (
                  <button type="button" onClick={() => { setCedulaSearch(''); setModFilter('Todos') }}
                    className="mt-2 text-sm text-blue-600 underline">
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
            {!loading && gestionRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Nombre', 'Cédula', 'Centro Educativo', 'Modalidad', 'Acciones'].map(h => (
                        <th key={h} className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gestionRows.map((student, idx) => (
                      <tr key={student.id ?? idx} className="hover:bg-slate-50 transition-colors">
                        <td className="border-b border-slate-100 px-4 py-3 font-medium">{student.nombre ?? '—'}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">{student.cedula ?? '—'}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{student.centroEducativo ?? '—'}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            normalizeModalidad(student.modalidadAcademica) === MOD_TECNICO
                              ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {normalizeModalidad(student.modalidadAcademica)}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 whitespace-nowrap">
                          <button type="button" onClick={() => startEdit(student)}
                            disabled={!student.id || submitting}
                            className="mr-2 rounded-md border border-blue-400 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors">
                            Editar
                          </button>
                          <button type="button" onClick={() => handleDelete(student.id)}
                            disabled={!student.id || deletingId === student.id || submitting}
                            className="rounded-md border border-rose-400 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-40 transition-colors">
                            {deletingId === student.id ? 'Eliminando…' : 'Eliminar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ═══ GUBERNAMENTAL: REPORTES ═══ */}
        {activeTab === TAB_REPORTES && isGov(activeRole) && (
          <section className={`${card} p-5 space-y-5`}>
            <h2 className="text-base font-semibold text-slate-800">Reportes Empresariales</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Total expedientes" value={kpis.total}
                colorBorder="border-blue-200" colorBg="bg-blue-50" colorText="text-blue-600" colorValue="text-blue-900" />
              <KpiCard label={MOD_ACADEMICA} value={kpis.academica}
                colorBorder="border-cyan-200" colorBg="bg-cyan-50" colorText="text-cyan-600" colorValue="text-cyan-900" />
              <KpiCard label={MOD_TECNICO} value={kpis.tecnico}
                colorBorder="border-emerald-200" colorBg="bg-emerald-50" colorText="text-emerald-600" colorValue="text-emerald-900" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Distribución por modalidad educativa</p>
              <ProgressBar label={MOD_ACADEMICA} value={kpis.academica} pct={kpis.pctAcademica} colorBar="bg-blue-600" />
              <ProgressBar label={MOD_TECNICO}   value={kpis.tecnico}   pct={kpis.pctTecnico}   colorBar="bg-emerald-600" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Distribución por centro educativo</p>
              {byCentro.length === 0
                ? <p className="text-sm text-slate-500">Sin datos disponibles.</p>
                : byCentro.map(item => (
                    <div key={item.label}>
                      <div className="mb-1 flex justify-between text-sm text-slate-700">
                        <span className="truncate pr-4" title={item.label}>{item.label}</span>
                        <strong className="shrink-0">{item.count} ({item.pct}%)</strong>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-cyan-600 transition-all duration-500" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))
              }
            </div>
          </section>
        )}

        {/* ═══ GUBERNAMENTAL: AUDITORÍA ═══ */}
        {activeTab === TAB_AUDITORIA && isGov(activeRole) && (
          <section className={`${card} p-5 space-y-4`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-slate-800">Registro de Auditoría</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {auditLogs.length} evento{auditLogs.length !== 1 ? 's' : ''}
                </span>
                {auditLogs.length > 0 && (
                  <button type="button" onClick={() => setAuditLogs([])}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 transition-colors">
                    Limpiar sesión
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">Fecha y Hora</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Usuario (Rol)</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Acción</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        No hay eventos registrados en esta sesión.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => {
                      const accionColor = {
                        SESION_INICIO: 'bg-blue-100 text-blue-800',
                        CREAR:         'bg-emerald-100 text-emerald-800',
                        ACTUALIZAR:    'bg-amber-100 text-amber-800',
                        ELIMINAR:      'bg-rose-100 text-rose-800',
                      }[log.accion] ?? 'bg-slate-200 text-slate-800'
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(log.fecha)}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{log.usuario}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${accionColor}`}>
                              {log.accion}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{log.detalles}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ═══ ESTUDIANTIL: MI PERFIL ═══ */}
        {activeTab === TAB_PERFIL && !isGov(activeRole) && (
          <section className="space-y-4">
            <div className={`${card} p-6`}>
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-3xl font-bold select-none">
                  {(studentProfile?.nombre?.[0] ?? '?').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{studentProfile?.nombre ?? '—'}</h2>
                  <p className="text-sm text-slate-500">
                    Cédula: <span className="font-medium text-slate-700">{studentProfile?.cedula ?? loginForm.usuario}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    Centro: <span className="font-medium text-slate-700">{studentProfile?.centroEducativo ?? '—'}</span>
                  </p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    normalizeModalidad(studentProfile?.modalidadAcademica) === MOD_TECNICO
                      ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {normalizeModalidad(studentProfile?.modalidadAcademica)}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
                <p className="text-sm font-semibold text-violet-700">Materias aprobadas</p>
                <strong className="mt-1 block text-4xl font-bold text-violet-900">{pensumStats.aprobadas}</strong>
                <p className="text-xs text-violet-500 mt-1">de {pensumStats.total} en el pensum</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm font-semibold text-blue-700">Cursando ahora</p>
                <strong className="mt-1 block text-4xl font-bold text-blue-900">{pensumStats.cursando}</strong>
                <p className="text-xs text-blue-500 mt-1">materias este semestre</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-700">Promedio general</p>
                <strong className="mt-1 block text-4xl font-bold text-amber-900">{pensumStats.promedio}</strong>
                <p className="text-xs text-amber-500 mt-1">sobre 100 puntos</p>
              </div>
            </div>
            <div className={`${card} p-5`}>
              <p className="text-sm font-semibold text-slate-700 mb-3">Progreso en el programa</p>
              <div className="mb-1 flex justify-between text-sm text-slate-600">
                <span>Materias completadas</span>
                <strong>
                  {pensumStats.aprobadas} / {pensumStats.total} ({Math.round(pensumStats.aprobadas / pensumStats.total * 100)}%)
                </strong>
              </div>
              <div className="h-5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-700"
                  style={{ width: `${Math.round(pensumStats.aprobadas / pensumStats.total * 100)}%` }}
                />
              </div>
            </div>
          </section>
        )}

        {/* ═══ ESTUDIANTIL: MI PENSUM ═══ */}
        {activeTab === TAB_PENSUM && !isGov(activeRole) && (
          <section className={`${card} p-5 space-y-4`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-slate-800">Mi Pensum</h2>
              <span className="text-xs text-slate-500">Año académico 2025–2026</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Aprobada', 'Cursando', 'Pendiente'].map(e => (
                <span key={e} className="flex items-center gap-1"><EstadoBadge estado={e} /></span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">Código</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Materia</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">Créditos</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Estado</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">Calificación</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_PENSUM.map(mat => (
                    <tr key={mat.codigo} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{mat.codigo}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{mat.nombre}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{mat.creditos}</td>
                      <td className="px-4 py-3"><EstadoBadge estado={mat.estado} /></td>
                      <td className="px-4 py-3 text-center">
                        {mat.nota !== null
                          ? <span className={`font-bold ${mat.nota >= 90 ? 'text-emerald-700' : mat.nota >= 70 ? 'text-blue-700' : 'text-rose-700'}`}>{mat.nota}</span>
                          : <span className="text-slate-500">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 font-semibold text-slate-700">Total</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                      {DEMO_PENSUM.reduce((a, m) => a + m.creditos, 0)} créditos
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-sm text-slate-500">
                      Promedio: <strong className="text-slate-800">{pensumStats.promedio} / 100</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ═══ ESTUDIANTIL: BECAS ═══ */}
        {activeTab === TAB_BECAS && !isGov(activeRole) && (
          <section className="space-y-4">
            <div className={`${card} p-5`}>
              <h2 className="text-base font-semibold text-slate-800 mb-1">Oportunidades y Becas</h2>
              <p className="text-sm text-slate-500">
                Programas disponibles para el ciclo escolar 2025–2026. Verifica los requisitos y aplica antes del cierre.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {DEMO_BECAS.map(beca => (
                <article key={beca.nombre} className={`rounded-2xl border p-5 space-y-3 ${beca.color}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-800 leading-tight">{beca.nombre}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${beca.badge}`}>{beca.entidad}</span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p><span className="font-medium text-slate-700">Monto:</span> {beca.monto}</p>
                    <p><span className="font-medium text-slate-700">Requisito:</span> {beca.requisito}</p>
                    <p><span className="font-medium text-slate-700">Cierre:</span> {fmtDate(beca.cierre)}</p>
                  </div>
                  <a href={beca.url} target="_blank" rel="noopener noreferrer"
                    className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                    Más información →
                  </a>
                </article>
              ))}
            </div>
            <p className="text-xs text-center text-slate-600 pb-2">
              La información de becas es referencial. Consulta los portales oficiales para datos actualizados.
            </p>
          </section>
        )}

      </main>
    </div>
  )
}