import { useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as XLSX from 'xlsx'

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

const API_REQUEST_TIMEOUT_MS = 12000

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
    let timeoutId
    try {
      const controller = new AbortController()

      const requestPromise = (async () => {
        const res = await fetch(url, {
          method,
          headers,
          signal: controller.signal,
          ...(body ? { body: JSON.stringify(body) } : {}),
        })
        const text = await res.text()
        return { res, text }
      })()

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(new Error(`Timeout al conectar con ${base}`))
        }, API_REQUEST_TIMEOUT_MS)
      })

      const { res, text } = await Promise.race([requestPromise, timeoutPromise])
      let payload = null
      try { payload = text ? JSON.parse(text) : null } catch { payload = null }

      if (!res.ok) {
        const validationErrors = payload?.errors && typeof payload.errors === 'object'
          ? Object.values(payload.errors).flat().filter(Boolean)
          : []

        const detail = validationErrors[0]
          || payload?.error
          || payload?.message
          || payload?.detail
          || payload?.title
          || res.statusText
          || 'Error inesperado'

        if (res.status === 404 || res.status === 405) {
          lastError = new Error(`HTTP ${res.status} - ${detail}`)
          continue
        }

        if (res.status >= 500) {
          throw new Error(`HTTP ${res.status} - ${detail}`)
        }

        if (res.status === 400) {
          throw new Error(
            path.startsWith('/Auth/login')
              ? 'Datos inválidos. Verifica correo institucional y contraseña (mínimo 8 caracteres).'
              : detail,
          )
        }

        throw new Error(`HTTP ${res.status} - ${detail}`)
      }

      return payload
    } catch (error) {
      const message = error?.message || ''

      if (error?.name === 'AbortError') {
        lastError = new Error(`Timeout al conectar con ${base}`)
        continue
      }

      if (/HTTP [45]\d\d/i.test(message)) {
        throw error
      }
      lastError = error
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }

  const message = lastError?.message || ''
  if (/Failed to fetch|NetworkError|Load failed|Timeout|AbortError|HTTP 404|HTTP 405/i.test(message)) {
    throw new Error('No fue posible conectar con la API. Verifica que el backend de Railway esté activo y respondiendo (health endpoint).')
  }

  throw new Error(`Error de red: ${message || 'conexión no disponible'}`)
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const MOD_ACADEMICA = 'Modalidad Academica'
const MOD_TECNICO   = 'Modalidad Tecnico Profesional'
const MOD_PRIMARIA  = 'Modalidad Primaria'

const TAB_INICIO     = 'Inicio'
const TAB_GESTION    = 'Gestion de Expedientes'
const TAB_FORMULARIO = 'Formulario de Registro'
const TAB_REPORTES   = 'Reportes Empresariales'
const TAB_AUDITORIA  = 'Registro de Auditoria'
const TAB_USUARIOS   = 'Administracion de Usuarios'
const GOV_TABS = [TAB_INICIO, TAB_GESTION, TAB_FORMULARIO, TAB_REPORTES, TAB_AUDITORIA]
const ADMIN_TABS = [...GOV_TABS, TAB_USUARIOS]

const TAB_PERFIL = 'Mi Perfil'
const TAB_PENSUM = 'Mi Pensum'
const TAB_BECAS  = 'Oportunidades y Becas'
const STU_TABS   = [TAB_PERFIL, TAB_PENSUM, TAB_BECAS]

const ROLES = ['Analista MINERD', 'Analista MESCYT', 'Estudiante', 'Administrador']
const ROL_COLORS = {
  'Analista MINERD': { bg: '#0f3a7a', badge: 'bg-blue-100 text-blue-900' },
  'Analista MESCYT': { bg: '#075985', badge: 'bg-cyan-100 text-cyan-900' },
  'Estudiante':      { bg: '#166534', badge: 'bg-emerald-100 text-emerald-900' },
  'Administrador':   { bg: '#4c1d95', badge: 'bg-violet-100 text-violet-900' },
}

const isGov = rol => rol === 'Analista MINERD' || rol === 'Analista MESCYT'
const isAdmin = rol => rol === 'Administrador'
const canBackoffice = rol => isGov(rol) || isAdmin(rol)

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

const FALLBACK_EXPEDIENTES = Array.from({ length: 50 }, (_, idx) => {
  const i = idx + 1
  const firstNames = [
    'Adrian', 'Bianca', 'Camila', 'Dario', 'Elisa', 'Fabian', 'Grecia', 'Hector', 'Ines', 'Julian',
    'Karla', 'Leandro', 'Mia', 'Nadia', 'Orlando', 'Paula', 'Quincy', 'Rita', 'Samuel', 'Tamara',
    'Ulises', 'Valeria', 'Wendy', 'Xavier', 'Yadira', 'Zoe',
  ]
  const lastNames = [
    'Arias', 'Beltre', 'Caceres', 'Delgado', 'Escobar', 'Franco', 'Guzman', 'Herrera', 'Ibarra', 'Jimenez',
    'Lora', 'Montero', 'Navarro', 'Ortega', 'Pena', 'Quinones', 'Rojas', 'Suero', 'Tejada', 'Urena',
    'Valdez', 'Wong', 'Ximenez', 'Yepez', 'Zamora',
  ]
  const centers = [
    'Liceo Union Panamericana',
    'Politecnico Loyola',
    'Liceo Ramon Emilio Jimenez',
    'Politecnico Nuestra Senora del Carmen',
    'Liceo Miguel Canela Lazaro',
    'Instituto Tecnico Salesiano',
    'Liceo Juan Pablo Duarte',
    'Politecnico Femenino Nuestra Senora de las Mercedes',
    'Centro Educativo Maria Montez',
    'Escuela Basica Juan Bosch',
  ]
  const modalities = [MOD_ACADEMICA, MOD_TECNICO, MOD_PRIMARIA]

  return {
    id: i,
    nombre: `${firstNames[(i - 1) % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`,
    cedula: `001-${String(i).padStart(7, '0')}-${i % 10}`,
    rne: `RNE-FE-${String(i).padStart(3, '0')}`,
    centroEducativo: centers[(i - 1) % centers.length],
    modalidadAcademica: modalities[(i - 1) % modalities.length],
    distritoEducativo: `${String((i % 18) + 1).padStart(2, '0')}-01`,
    estado: 'Regular',
    tasaAsistencia: 80 + (i % 15),
    promedioGeneral: 72 + (i % 20),
  }
})

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function normalizeModalidad(value) {
  const text = (value ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (!text) return MOD_ACADEMICA
  if (text.includes('tecnico')) return MOD_TECNICO
  if (text.includes('primaria')) return MOD_PRIMARIA
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

function fileTimestamp() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`
}

function exportDateLabel() {
  return new Date().toLocaleString('es-DO')
}

function hasValidDomainByRole(rol, usuario) {
  const value = sanitizeInstitutionalUser(usuario)
  if (rol === 'Analista MINERD') return value.endsWith('@minerd.gob.do')
  if (rol === 'Analista MESCYT') return value.endsWith('@mescyt.gob.do')
  return true
}

function sanitizeInstitutionalUser(value) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:]+$/g, '')
}

function normalizeCedula(value) {
  return (value || '').toString().replace(/\D/g, '')
}

function formatCedula(value) {
  const digits = normalizeCedula(value)
  if (digits.length !== 11) return (value || '').toString().trim()
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`
}

function isValidCedula(value) {
  return normalizeCedula(value).length === 11
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

function getModalidadBadgeClasses(modalidad) {
  if (modalidad === MOD_TECNICO) return 'bg-emerald-100 text-emerald-800'
  if (modalidad === MOD_PRIMARIA) return 'bg-amber-100 text-amber-800'
  return 'bg-blue-100 text-blue-800'
}

function getUserRoleBadgeClasses(role) {
  if (role === 'Administrador') return 'bg-violet-100 text-violet-800'
  if (role === 'Analista MINERD') return 'bg-blue-100 text-blue-800'
  if (role === 'Analista MESCYT') return 'bg-cyan-100 text-cyan-800'
  return 'bg-emerald-100 text-emerald-800'
}

function resolveAuditUserFromToken(token, role, fallbackUserInput) {
  const payload = decodeJwtPayload(token)
  const emailClaim = payload?.email || payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
  if (emailClaim) {
    return sanitizeInstitutionalUser(String(emailClaim))
  }

  if (role === 'Estudiante') {
    const cedulaClaim = payload?.cedula || payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid']
    if (cedulaClaim) {
      return formatCedula(String(cedulaClaim))
    }
  }

  return (fallbackUserInput || '').trim()
}

function validateExpedienteForm(form, students, editingId) {
  const nombre = (form.nombre || '').trim()
  const centro = (form.centroEducativo || '').trim()
  const cedulaDigits = normalizeCedula(form.cedula)

  if (!nombre || !cedulaDigits || !centro) {
    return 'Nombre, Cédula y Centro Educativo son obligatorios.'
  }

  if (nombre.length < 3) {
    return 'El nombre debe tener al menos 3 caracteres.'
  }

  if (centro.length < 3) {
    return 'El centro educativo debe tener al menos 3 caracteres.'
  }

  if (cedulaDigits.length !== 11) {
    return 'La cédula debe contener 11 dígitos.'
  }

  const duplicated = (students || []).some(s =>
    String(s.id) !== String(editingId)
    && normalizeCedula(s.cedula) === cedulaDigits,
  )

  if (duplicated) {
    return 'Ya existe un expediente con esa cédula.'
  }

  return ''
}

function validateAccessUserForm(form, isEditing) {
  const role = (form.rol || '').trim()
  const nombre = (form.nombreCompleto || '').trim()
  const correo = sanitizeInstitutionalUser(form.correoInstitucional)
  const password = (form.password || '').trim()

  if (nombre.length < 3) {
    return 'El nombre completo debe tener al menos 3 caracteres.'
  }

  if (role === 'Estudiante') {
    if (!isValidCedula(form.cedula)) {
      return 'La cédula del estudiante debe contener 11 dígitos.'
    }
    return ''
  }

  if (!correo) {
    return 'El correo institucional es obligatorio para esta cuenta.'
  }

  if (role === 'Analista MINERD' && !correo.endsWith('@minerd.gob.do')) {
    return 'El correo para Analista MINERD debe terminar en @minerd.gob.do.'
  }

  if (role === 'Analista MESCYT' && !correo.endsWith('@mescyt.gob.do')) {
    return 'El correo para Analista MESCYT debe terminar en @mescyt.gob.do.'
  }

  if (!isEditing && password.length < 8) {
    return 'La contraseña inicial debe tener al menos 8 caracteres.'
  }

  if (password && password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }

  return ''
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

function InlineSpinner({ className = '' }) {
  const base = 'inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700'
  return <span className={`${base} ${className}`.trim()} />
}

function KpiSkeleton() {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="mt-3 h-10 w-20 rounded bg-slate-200" />
    </article>
  )
}

function DistributionSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4 animate-pulse">
      <div className="h-4 w-56 rounded bg-slate-200" />
      {[1, 2, 3].map(item => (
        <div key={item}>
          <div className="mb-2 flex justify-between">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-3 w-16 rounded bg-slate-200" />
          </div>
          <div className="h-3 w-full rounded-full bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 7 }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 animate-pulse">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[1, 2, 3, 4, 5].map(col => (
              <th key={col} className="border-b border-slate-200 px-4 py-3 text-left">
                <div className="h-3 w-24 rounded bg-slate-200" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, idx) => (
            <tr key={idx}>
              {[1, 2, 3, 4, 5].map(col => (
                <td key={col} className="border-b border-slate-100 px-4 py-3">
                  <div className="h-3 w-full max-w-[180px] rounded bg-slate-200" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function App() {
  // Auth / sesión
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken]             = useState('')
  const [activeRole, setActiveRole]           = useState(ROLES[0])
  const [authSubmitting, setAuthSubmitting]   = useState(false)
  const [loginForm, setLoginForm]             = useState({ usuario: '', contrasena: '', rol: ROLES[0] })
  const [loginError, setLoginError]           = useState('')
  const [contingencyMode, setContingencyMode] = useState(false)
  const [sessionAuditUser, setSessionAuditUser] = useState('')

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
  const [exporting,    setExporting]    = useState('')

  // Auditoría
  const [auditLogs, setAuditLogs] = useState([])
  const [studentProfileData, setStudentProfileData] = useState(null)

  // Administración de usuarios
  const emptyUserForm = {
    nombreCompleto: '',
    rol: 'Analista MINERD',
    cedula: '',
    correoInstitucional: '',
    password: '',
    activo: true,
  }
  const [adminUsers, setAdminUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [userForm, setUserForm] = useState(emptyUserForm)
  const [editingUserId, setEditingUserId] = useState(null)
  const [userFormError, setUserFormError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [userSaving, setUserSaving] = useState(false)
  const [revokingUserId, setRevokingUserId] = useState('')

  // ── Auditoría helper ────────────────────────────────────────────────────────
  const pushAudit = useCallback((accion, detalles, rol, usuario) =>
    setAuditLogs(prev => [{
      id:      `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fecha:   new Date().toISOString(),
      usuario: (usuario || '').trim() || 'anonimo',
      rol,
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
      setContingencyMode(false)
    } catch (e) {
      if (/No fue posible conectar con la API/i.test(e.message || '')) {
        setStudents(FALLBACK_EXPEDIENTES)
        setDataError('Backend no disponible. Mostrando 50 expedientes de contingencia.')
        setContingencyMode(true)
      } else {
        setDataError(e.message || 'Error de conexión')
        setStudents([])
      }
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

  const fetchAdminUsers = useCallback(async token => {
    try {
      setUsersLoading(true)
      setUsersError('')
      const raw = await apiRequest('/Users', { method: 'GET', token })
      setAdminUsers(Array.isArray(raw) ? raw : [])
    } catch (error) {
      setUsersError(error?.message || 'No fue posible cargar los usuarios.')
      setAdminUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !authToken) return

    if (authToken === 'contingency-token' && canBackoffice(activeRole)) {
      return
    }

    if (canBackoffice(activeRole)) {
      fetchStudents(authToken)
    } else {
      fetchStudentProfile(authToken)
    }
  }, [isAuthenticated, authToken, activeRole, contingencyMode, fetchStudents, fetchStudentProfile])

  useEffect(() => {
    if (!isAuthenticated || !authToken || !isAdmin(activeRole) || authToken === 'contingency-token') return
    fetchAdminUsers(authToken)
  }, [isAuthenticated, authToken, activeRole, fetchAdminUsers])

  // ── Login ───────────────────────────────────────────────────────────────────
  const handleLoginChange = e => {
    setLoginForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setLoginError('')
  }

  const handleLogin = async e => {
    e.preventDefault()
    const esEstudiante = loginForm.rol === 'Estudiante'
    const esAdministrador = loginForm.rol === 'Administrador'
    const usuario = esEstudiante ? loginForm.usuario.trim() : sanitizeInstitutionalUser(loginForm.usuario)
    const contrasena = (loginForm.contrasena || '').trim()

    if (!loginForm.usuario.trim() || (!contrasena && !esEstudiante)) {
      setLoginError(esEstudiante
        ? 'Ingresa tu cédula para continuar.'
        : 'Ingresa usuario y contraseña para continuar.')
      return
    }

    if (esEstudiante && !isValidCedula(usuario)) {
      setLoginError('La cédula debe contener 11 dígitos.')
      return
    }

    if (!esEstudiante) {
      if (loginForm.rol === 'Analista MINERD' && !usuario.endsWith('@minerd.gob.do')) {
        setLoginError('Para Analista MINERD el correo debe terminar en @minerd.gob.do.')
        return
      }

      if (loginForm.rol === 'Analista MESCYT' && !usuario.endsWith('@mescyt.gob.do')) {
        setLoginError('Para Analista MESCYT el correo debe terminar en @mescyt.gob.do.')
        return
      }

      if (contrasena.length < 8) {
        setLoginError('La contraseña debe tener al menos 8 caracteres.')
        return
      }
    }

    try {
      setAuthSubmitting(true)
      setLoginError('')

      const authRequestWithTimeout = async requestPromise => {
        return await Promise.race([
          requestPromise,
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('No fue posible conectar con la API. Verifica que el backend de Railway esté activo y respondiendo (health endpoint).'))
            }, 15000)
          }),
        ])
      }

      let response
      if (esEstudiante) {
        response = await authRequestWithTimeout(apiRequest('/Auth/login/estudiante', {
          method: 'POST',
          body: { cedula: formatCedula(usuario) },
        }))
      } else if (esAdministrador) {
        response = await authRequestWithTimeout(apiRequest('/Auth/login/administrador', {
          method: 'POST',
          body: {
            correoInstitucional: usuario,
            password: contrasena,
          },
        }))
      } else {
        response = await authRequestWithTimeout(apiRequest('/Auth/login/analista', {
          method: 'POST',
          body: {
            rol: loginForm.rol,
            correoInstitucional: usuario,
            password: contrasena,
          },
        }))
      }

      if (!response?.token) {
        throw new Error('No se recibió token de autenticación.')
      }

      const rol = response.rol || loginForm.rol
      const auditUser = resolveAuditUserFromToken(
        response.token,
        rol,
        esEstudiante ? formatCedula(usuario) : usuario,
      )
      setAuthToken(response.token)
      setIsAuthenticated(true)
      setActiveRole(rol)
      setSessionAuditUser(auditUser)
      setActiveTab(canBackoffice(rol) ? TAB_INICIO : TAB_PERFIL)
      pushAudit(
        'SESION_INICIO',
        `${esEstudiante ? 'Estudiante cédula' : 'Usuario'} ${loginForm.usuario.trim()} inició sesión como ${rol}`,
        rol,
        auditUser,
      )
    } catch (error) {
      const message = error?.message || 'No fue posible iniciar sesión.'

      if (esEstudiante && /No fue posible conectar con la API/i.test(message)) {
        const cedulaFallback = formatCedula(usuario)
        setAuthToken('contingency-token-student')
        setIsAuthenticated(true)
        setActiveRole('Estudiante')
        setSessionAuditUser(cedulaFallback)
        setActiveTab(TAB_PERFIL)
        setContingencyMode(true)
        setStudents(FALLBACK_EXPEDIENTES)
        setStudentProfileData(null)
        pushAudit('SESION_INICIO', `Inicio de sesión estudiantil en contingencia para ${cedulaFallback}`, 'Estudiante', cedulaFallback)
        return
      }

      if (!esEstudiante && !esAdministrador && /No fue posible conectar con la API/i.test(message)) {
        const passwordValid = contrasena.length >= 8
        const domainValid = hasValidDomainByRole(loginForm.rol, usuario)

        if (passwordValid && domainValid) {
          setAuthToken('contingency-token')
          setIsAuthenticated(true)
          setActiveRole(loginForm.rol)
          setSessionAuditUser(usuario)
          setActiveTab(TAB_INICIO)
          setContingencyMode(true)
          setStudents(FALLBACK_EXPEDIENTES)
          setDataError('Backend no disponible. Sesión iniciada en modo contingencia con datos locales.')
          pushAudit('SESION_INICIO', `Inicio de sesión en contingencia para ${usuario} (${loginForm.rol})`, loginForm.rol, usuario)
          return
        }
      }

      setLoginError(message)
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setLoginForm({ usuario: '', contrasena: '', rol: ROLES[0] })
    setLoginError('')
    setAuthToken('')
    setSessionAuditUser('')
    setContingencyMode(false)
    setStudents([])
    setStudentProfileData(null)
    setAuditLogs([])
    setAdminUsers([])
    setUsersError('')
    setUserForm(emptyUserForm)
    setEditingUserId(null)
    setUserFormError('')
    setUserSuccess('')
    setActiveTab(TAB_INICIO)
    cancelEdit()
  }

  const resetUserForm = () => {
    setUserForm(emptyUserForm)
    setEditingUserId(null)
    setUserFormError('')
  }

  const startEditUser = user => {
    setEditingUserId(user.id)
    setUserForm({
      nombreCompleto: user.nombreCompleto || '',
      rol: user.rol || 'Analista MINERD',
      cedula: user.cedula || '',
      correoInstitucional: user.correoInstitucional || '',
      password: '',
      activo: Boolean(user.activo),
    })
    setUserFormError('')
    setUserSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleUserFormChange = e => {
    const { name, value, type, checked } = e.target
    const nextValue = type === 'checkbox'
      ? checked
      : name === 'cedula'
        ? value.replace(/[^\d-]/g, '').slice(0, 13)
        : value
    setUserForm(prev => ({ ...prev, [name]: nextValue }))
    setUserFormError('')
  }

  const handleUserSubmit = async e => {
    e.preventDefault()
    const validationError = validateAccessUserForm(userForm, Boolean(editingUserId))
    if (validationError) {
      setUserFormError(validationError)
      return
    }

    const payload = {
      nombreCompleto: userForm.nombreCompleto.trim(),
      rol: userForm.rol,
      cedula: userForm.rol === 'Estudiante' ? formatCedula(userForm.cedula) : (userForm.cedula || '').trim() || null,
      correoInstitucional: userForm.rol === 'Estudiante'
        ? null
        : sanitizeInstitutionalUser(userForm.correoInstitucional),
      password: (userForm.password || '').trim() || null,
      activo: Boolean(userForm.activo),
    }

    try {
      setUserSaving(true)
      setUserFormError('')
      setUserSuccess('')

      if (editingUserId) {
        await apiRequest(`/Users/${editingUserId}`, { method: 'PUT', token: authToken, body: payload })
        pushAudit('ACTUALIZAR', `Administrador actualizó la cuenta ${payload.nombreCompleto}`, activeRole, sessionAuditUser)
        resetUserForm()
        setUserSuccess('Cuenta actualizada correctamente.')
      } else {
        await apiRequest('/Users', { method: 'POST', token: authToken, body: payload })
        pushAudit('CREAR', `Administrador creó la cuenta ${payload.nombreCompleto}`, activeRole, sessionAuditUser)
        resetUserForm()
        setUserSuccess('Cuenta creada correctamente.')
      }

      await fetchAdminUsers(authToken)
    } catch (error) {
      setUserFormError(error?.message || 'No se pudo guardar la cuenta.')
    } finally {
      setUserSaving(false)
    }
  }

  const handleRevokeUser = async user => {
    if (!user?.id || revokingUserId) return
    if (!window.confirm(`¿Deseas revocar la cuenta de ${user.nombreCompleto}?`)) return

    try {
      setRevokingUserId(user.id)
      await apiRequest(`/Users/${user.id}`, { method: 'DELETE', token: authToken })
      pushAudit('ELIMINAR', `Administrador revocó la cuenta ${user.nombreCompleto}`, activeRole, sessionAuditUser)
      await fetchAdminUsers(authToken)
    } catch (error) {
      setUsersError(error?.message || 'No se pudo revocar la cuenta.')
    } finally {
      setRevokingUserId('')
    }
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

  const handleFormChange = e => {
    const { name, value } = e.target
    const nextValue = name === 'cedula'
      ? value.replace(/[^\d-]/g, '').slice(0, 13)
      : value
    setForm(prev => ({ ...prev, [name]: nextValue }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const validationError = validateExpedienteForm(form, students, editingId)
    if (validationError) {
      setFormError(validationError)
      return
    }

    const cleanNombre = form.nombre.trim()
    const cleanCedula = formatCedula(form.cedula)
    const cleanCentro = form.centroEducativo.trim()

    if (contingencyMode) {
      const nextModalidad = normalizeModalidad(form.modalidadAcademica)
      if (editingId) {
        setStudents(prev => prev.map(s =>
          s.id === editingId
            ? {
                ...s,
                nombre: cleanNombre,
                cedula: cleanCedula,
                centroEducativo: cleanCentro,
                modalidadAcademica: nextModalidad,
                fechaActualizacion: new Date().toISOString(),
              }
            : s,
        ))
        pushAudit('ACTUALIZAR', `Contingencia: expediente actualizado ${cleanCedula}`, activeRole, sessionAuditUser)
        setFormSuccess('Expediente actualizado en modo contingencia.')
      } else {
        const nextId = students.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1
        setStudents(prev => [{
          id: nextId,
          nombre: cleanNombre,
          cedula: cleanCedula,
          centroEducativo: cleanCentro,
          modalidadAcademica: nextModalidad,
          rne: `RNE-LOCAL-${Date.now()}`,
          distritoEducativo: '00-00',
          estado: 'Regular',
          tasaAsistencia: 80,
          promedioGeneral: 75,
          fechaCreacion: new Date().toISOString(),
          fechaActualizacion: new Date().toISOString(),
        }, ...prev])
        pushAudit('CREAR', `Contingencia: expediente creado ${cleanCedula}`, activeRole, sessionAuditUser)
        setFormSuccess('Expediente agregado en modo contingencia.')
      }

      cancelEdit()
      return
    }

    try {
      setSubmitting(true)
      setFormError('')
      setFormSuccess('')

      if (editingId) {
        const payload = {
          ...editingRecord,
          nombre:             cleanNombre,
          cedula:             cleanCedula,
          centroEducativo:    cleanCentro,
          modalidadAcademica: normalizeModalidad(form.modalidadAcademica),
          fechaActualizacion: new Date().toISOString(),
        }
        await apiRequest(`/ChangeExampleData/${editingId}`, { method: 'PUT', token: authToken, body: payload })
        pushAudit('ACTUALIZAR', `Usuario [${activeRole}] modificó expediente cédula ${cleanCedula}`, activeRole, sessionAuditUser)
        setFormSuccess('Expediente actualizado correctamente.')
      } else {
        const payload = {
          nombre:             cleanNombre,
          cedula:             cleanCedula,
          centroEducativo:    cleanCentro,
          modalidadAcademica: normalizeModalidad(form.modalidadAcademica),
          rne:                `RNE-${Date.now()}`,
        }
        await apiRequest('/CreateExample', { method: 'POST', token: authToken, body: payload })
        pushAudit('CREAR', `Usuario [${activeRole}] creó registro para cédula ${cleanCedula}`, activeRole, sessionAuditUser)
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

    if (contingencyMode) {
      setStudents(prev => prev.filter(s => s.id !== id))
      pushAudit('ELIMINAR', `Contingencia: expediente eliminado id ${id}`, activeRole, sessionAuditUser)
      return
    }

    try {
      setDeletingId(id)
      await apiRequest(`/DeleteExample/${id}`, { method: 'DELETE', token: authToken })
      pushAudit('ELIMINAR', `Usuario [${activeRole}] eliminó expediente id ${id}`, activeRole, sessionAuditUser)
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
    const primaria  = students.filter(s => normalizeModalidad(s.modalidadAcademica) === MOD_PRIMARIA).length
    return {
      total, academica, tecnico, primaria,
      pctAcademica: total > 0 ? Math.round((academica / total) * 100) : 0,
      pctTecnico:   total > 0 ? Math.round((tecnico   / total) * 100) : 0,
      pctPrimaria:  total > 0 ? Math.round((primaria  / total) * 100) : 0,
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
    if (canBackoffice(activeRole)) return null
    if (studentProfileData) {
      return { ...studentProfileData, modalidadAcademica: normalizeModalidad(studentProfileData.modalidadAcademica) }
    }
    const cedula = loginForm.usuario.trim()
    return students.find(s => normalizeCedula(s.cedula) === normalizeCedula(cedula))
      || { nombre: `Estudiante ${cedula}`, cedula, centroEducativo: '—', modalidadAcademica: MOD_ACADEMICA }
  }, [students, studentProfileData, loginForm.usuario, activeRole])

  // ── Exportaciones ───────────────────────────────────────────────────────────
  const exportGestionExcel = async () => {
    if (gestionRows.length === 0) throw new Error('No hay expedientes para exportar con los filtros actuales.')

    const rows = gestionRows.map(item => ({
      Nombre: item.nombre || '—',
      Cedula: item.cedula || '—',
      CentroEducativo: item.centroEducativo || '—',
      Modalidad: normalizeModalidad(item.modalidadAcademica),
      RNE: item.rne || '—',
      Distrito: item.distritoEducativo || '—',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expedientes')
    XLSX.writeFile(workbook, `edumetrics-expedientes-${fileTimestamp()}.xlsx`)
  }

  const exportGestionPdf = async () => {
    if (gestionRows.length === 0) throw new Error('No hay expedientes para exportar con los filtros actuales.')

    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('EDUMETRICS-DR - Gestion de Expedientes', 14, 14)
    doc.setFontSize(9)
    doc.text(`Fecha de exportacion: ${exportDateLabel()}`, 14, 20)
    doc.text(`Rol: ${activeRole}`, 14, 25)

    autoTable(doc, {
      startY: 30,
      head: [['Nombre', 'Cedula', 'Centro', 'Modalidad', 'RNE', 'Distrito']],
      body: gestionRows.map(item => [
        item.nombre || '—',
        item.cedula || '—',
        item.centroEducativo || '—',
        normalizeModalidad(item.modalidadAcademica),
        item.rne || '—',
        item.distritoEducativo || '—',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 58, 122] },
    })

    doc.save(`edumetrics-expedientes-${fileTimestamp()}.pdf`)
  }

  const exportReportesExcel = async () => {
    if (students.length === 0) throw new Error('No hay datos disponibles para exportar reportes.')

    const workbook = XLSX.utils.book_new()
    const resumenSheet = XLSX.utils.json_to_sheet([
      { Indicador: 'Total expedientes', Valor: kpis.total },
      { Indicador: MOD_ACADEMICA, Valor: kpis.academica },
      { Indicador: MOD_TECNICO, Valor: kpis.tecnico },
      { Indicador: MOD_PRIMARIA, Valor: kpis.primaria },
      { Indicador: '% Modalidad Academica', Valor: `${kpis.pctAcademica}%` },
      { Indicador: '% Modalidad Tecnico Profesional', Valor: `${kpis.pctTecnico}%` },
      { Indicador: '% Modalidad Primaria', Valor: `${kpis.pctPrimaria}%` },
      { Indicador: 'Fecha exportacion', Valor: exportDateLabel() },
    ])

    const centrosSheet = XLSX.utils.json_to_sheet(
      byCentro.map(item => ({ CentroEducativo: item.label, Cantidad: item.count, Porcentaje: `${item.pct}%` })),
    )

    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen')
    XLSX.utils.book_append_sheet(workbook, centrosSheet, 'Centros')
    XLSX.writeFile(workbook, `edumetrics-reportes-${fileTimestamp()}.xlsx`)
  }

  const exportReportesPdf = async () => {
    if (students.length === 0) throw new Error('No hay datos disponibles para exportar reportes.')

    const doc = new jsPDF({ orientation: 'portrait' })
    doc.setFontSize(14)
    doc.text('EDUMETRICS-DR - Reportes Empresariales', 14, 14)
    doc.setFontSize(9)
    doc.text(`Fecha de exportacion: ${exportDateLabel()}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total expedientes', String(kpis.total)],
        [MOD_ACADEMICA, `${kpis.academica} (${kpis.pctAcademica}%)`],
        [MOD_TECNICO, `${kpis.tecnico} (${kpis.pctTecnico}%)`],
        [MOD_PRIMARIA, `${kpis.primaria} (${kpis.pctPrimaria}%)`],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [7, 89, 133] },
    })

    const nextY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : 60
    autoTable(doc, {
      startY: nextY,
      head: [['Centro educativo', 'Cantidad', 'Porcentaje']],
      body: byCentro.map(item => [item.label, String(item.count), `${item.pct}%`]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 145, 178] },
    })

    doc.save(`edumetrics-reportes-${fileTimestamp()}.pdf`)
  }

  const exportAuditoriaExcel = async () => {
    if (auditLogs.length === 0) throw new Error('No hay eventos de auditoria para exportar en esta sesion.')

    const rows = auditLogs.map(item => ({
      FechaHora: fmt(item.fecha),
      Usuario: item.usuario || '—',
      Rol: item.rol || activeRole,
      Accion: item.accion || '—',
      Detalles: item.detalles || '—',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria')
    XLSX.writeFile(workbook, `edumetrics-auditoria-${fileTimestamp()}.xlsx`)
  }

  const exportAuditoriaPdf = async () => {
    if (auditLogs.length === 0) throw new Error('No hay eventos de auditoria para exportar en esta sesion.')

    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('EDUMETRICS-DR - Registro de Auditoria', 14, 14)
    doc.setFontSize(9)
    doc.text(`Fecha de exportacion: ${exportDateLabel()}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Fecha y Hora', 'Usuario', 'Rol', 'Accion', 'Detalles']],
      body: auditLogs.map(item => [
        fmt(item.fecha),
        item.usuario || '—',
        item.rol || activeRole,
        item.accion || '—',
        item.detalles || '—',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 101, 52] },
    })

    doc.save(`edumetrics-auditoria-${fileTimestamp()}.pdf`)
  }

  const runExport = async (key, exporter) => {
    try {
      setExporting(key)
      await exporter()
    } catch (error) {
      window.alert(error?.message || 'No se pudo completar la exportacion.')
    } finally {
      setExporting('')
    }
  }

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

  const byEstado = useMemo(() => {
    const map = {}
    for (const student of students) {
      const key = (student.estado || 'Sin estado').toString().trim() || 'Sin estado'
      map[key] = (map[key] || 0) + 1
    }
    return Object.entries(map)
      .map(([name, value], idx) => ({
        name,
        value,
        fill: ['#0f766e', '#2563eb', '#d97706', '#be123c', '#7c3aed'][idx % 5],
      }))
      .sort((a, b) => b.value - a.value)
  }, [students])

  const modalidadChartData = useMemo(() => ([
    { name: MOD_ACADEMICA, value: kpis.academica, fill: '#2563eb' },
    { name: MOD_TECNICO, value: kpis.tecnico, fill: '#059669' },
    { name: MOD_PRIMARIA, value: kpis.primaria, fill: '#d97706' },
  ].filter(item => item.value > 0)), [kpis])

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
                    placeholder={loginForm.rol === 'Analista MINERD'
                      ? 'usuario@minerd.gob.do'
                      : loginForm.rol === 'Analista MESCYT'
                        ? 'usuario@mescyt.gob.do'
                        : 'admin@edumetrics.gob.do'}
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
              disabled={authSubmitting}
              className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors ${
                esEstudiante ? 'bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400' : 'bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400'
              }`}
            >
              {authSubmitting
                ? <span className="inline-flex items-center gap-2"><InlineSpinner className="border-white/50 border-t-white" /> Validando credenciales…</span>
                : 'Iniciar sesión'}
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
            {(isAdmin(activeRole) ? ADMIN_TABS : canBackoffice(activeRole) ? GOV_TABS : STU_TABS).map(tab => (
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

        {contingencyMode && (
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Modo contingencia activo: backend no disponible, operando con datos locales.
          </div>
        )}

        {/* ── FORMULARIO (gubernamental, siempre en DOM para preservar estado) ── */}
        <div
          className={`${card} p-5`}
          style={{ display: activeTab === TAB_FORMULARIO && canBackoffice(activeRole) ? 'block' : 'none' }}
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
                <option value={MOD_PRIMARIA}>{MOD_PRIMARIA}</option>
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
                {submitting
                  ? <span className="inline-flex items-center gap-2"><InlineSpinner className="border-white/50 border-t-white" /> Guardando…</span>
                  : editingId ? 'Guardar cambios' : 'Agregar expediente'}
              </button>
            </div>
          </form>
          {formError && (
            <p role="alert" className="mt-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
          )}
        </div>

        {/* ═══ GUBERNAMENTAL: INICIO ═══ */}
        {activeTab === TAB_INICIO && canBackoffice(activeRole) && (
          <section className={`${card} p-6 space-y-5`}>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bienvenido, {activeRole}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeRole === 'Administrador'
                  ? 'Panel administrativo para supervisar expedientes, accesos institucionales y reportes ejecutivos del sistema.'
                  : activeRole === 'Analista MINERD'
                  ? 'Panel de gestión de expedientes para centros educativos del nivel pre-universitario (Escuelas y Politécnicos) bajo MINERD.'
                  : 'Panel de gestión de egresados y matriculados en instituciones de educación superior reguladas por MESCYT.'}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              {loading ? (
                <>
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                </>
              ) : (
                <>
                  <KpiCard label="Total expedientes" value={kpis.total}
                    colorBorder="border-blue-200" colorBg="bg-blue-50" colorText="text-blue-700" colorValue="text-blue-900" />
                  <KpiCard label={MOD_ACADEMICA} value={kpis.academica}
                    colorBorder="border-cyan-200" colorBg="bg-cyan-50" colorText="text-cyan-700" colorValue="text-cyan-900" />
                  <KpiCard label={MOD_TECNICO} value={kpis.tecnico}
                    colorBorder="border-emerald-200" colorBg="bg-emerald-50" colorText="text-emerald-700" colorValue="text-emerald-900" />
                  <KpiCard label={MOD_PRIMARIA} value={kpis.primaria}
                    colorBorder="border-amber-200" colorBg="bg-amber-50" colorText="text-amber-700" colorValue="text-amber-900" />
                </>
              )}
            </div>
            {dataError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <strong>Error al cargar datos:</strong> {dataError}
                <button type="button" disabled={loading} onClick={() => fetchStudents(authToken)} className="ml-3 inline-flex items-center gap-2 underline font-medium disabled:opacity-50">
                  {loading && <InlineSpinner />}
                  {loading ? 'Reintentando…' : 'Reintentar'}
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
        {activeTab === TAB_GESTION && canBackoffice(activeRole) && (
          <section className={`${card} p-5 space-y-4`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-slate-800">Gestión de Expedientes</h2>
              <div className="flex gap-2 text-xs flex-wrap">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                  {gestionRows.length} resultado{gestionRows.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  disabled={exporting !== '' || loading}
                  onClick={() => runExport('gestion-excel', exportGestionExcel)}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 disabled:opacity-50"
                >
                  {exporting === 'gestion-excel' && <InlineSpinner />}
                  Excel
                </button>
                <button
                  type="button"
                  disabled={exporting !== '' || loading}
                  onClick={() => runExport('gestion-pdf', exportGestionPdf)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 font-semibold text-rose-700 disabled:opacity-50"
                >
                  {exporting === 'gestion-pdf' && <InlineSpinner />}
                  PDF
                </button>
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
                  <option value={MOD_PRIMARIA}>{MOD_PRIMARIA}</option>
                </select>
              </label>
            </div>

            {loading && <TableSkeleton rows={7} />}
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
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getModalidadBadgeClasses(normalizeModalidad(student.modalidadAcademica))}`}>
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
                            {deletingId === student.id
                              ? <span className="inline-flex items-center gap-1"><InlineSpinner /> Eliminando…</span>
                              : 'Eliminar'}
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
        {activeTab === TAB_REPORTES && canBackoffice(activeRole) && (
          <section className={`${card} p-5 space-y-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-800">Reportes Empresariales</h2>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  disabled={exporting !== '' || loading}
                  onClick={() => runExport('reportes-excel', exportReportesExcel)}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 disabled:opacity-50"
                >
                  {exporting === 'reportes-excel' && <InlineSpinner />}
                  Excel
                </button>
                <button
                  type="button"
                  disabled={exporting !== '' || loading}
                  onClick={() => runExport('reportes-pdf', exportReportesPdf)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 font-semibold text-rose-700 disabled:opacity-50"
                >
                  {exporting === 'reportes-pdf' && <InlineSpinner />}
                  PDF
                </button>
              </div>
            </div>
            {loading ? (
              <>
                <div className="grid gap-4 sm:grid-cols-4">
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                </div>
                <DistributionSkeleton />
                <DistributionSkeleton />
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-4">
                  <KpiCard label="Total expedientes" value={kpis.total}
                    colorBorder="border-blue-200" colorBg="bg-blue-50" colorText="text-blue-600" colorValue="text-blue-900" />
                  <KpiCard label={MOD_ACADEMICA} value={kpis.academica}
                    colorBorder="border-cyan-200" colorBg="bg-cyan-50" colorText="text-cyan-600" colorValue="text-cyan-900" />
                  <KpiCard label={MOD_TECNICO} value={kpis.tecnico}
                    colorBorder="border-emerald-200" colorBg="bg-emerald-50" colorText="text-emerald-600" colorValue="text-emerald-900" />
                  <KpiCard label={MOD_PRIMARIA} value={kpis.primaria}
                    colorBorder="border-amber-200" colorBg="bg-amber-50" colorText="text-amber-600" colorValue="text-amber-900" />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Distribución por modalidad educativa</p>
                  <ProgressBar label={MOD_ACADEMICA} value={kpis.academica} pct={kpis.pctAcademica} colorBar="bg-blue-600" />
                  <ProgressBar label={MOD_TECNICO}   value={kpis.tecnico}   pct={kpis.pctTecnico}   colorBar="bg-emerald-600" />
                  <ProgressBar label={MOD_PRIMARIA}  value={kpis.primaria}  pct={kpis.pctPrimaria}  colorBar="bg-amber-600" />
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
                <div className="grid gap-4 xl:grid-cols-2">
                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-slate-800">Gráfico de Modalidades</h3>
                      <p className="text-xs text-slate-500">Vista doughnut de la distribución real de expedientes por modalidad.</p>
                    </div>
                    {modalidadChartData.length === 0 ? (
                      <div className="flex h-72 items-center justify-center text-sm text-slate-500">Sin datos para graficar.</div>
                    ) : (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={modalidadChartData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={4}>
                              {modalidadChartData.map(item => <Cell key={item.name} fill={item.fill} />)}
                            </Pie>
                            <Tooltip formatter={value => [`${value} expedientes`, 'Cantidad']} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </article>
                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-slate-800">Gráfico por Estado</h3>
                      <p className="text-xs text-slate-500">Barras dinámicas basadas en el estado actual reportado por el backend.</p>
                    </div>
                    {byEstado.length === 0 ? (
                      <div className="flex h-72 items-center justify-center text-sm text-slate-500">Sin estados disponibles.</div>
                    ) : (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={byEstado} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip formatter={value => [`${value} expedientes`, 'Cantidad']} />
                            <Legend />
                            <Bar dataKey="value" name="Expedientes" radius={[8, 8, 0, 0]}>
                              {byEstado.map(item => <Cell key={item.name} fill={item.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </article>
                </div>
              </>
            )}
          </section>
        )}

        {/* ═══ GUBERNAMENTAL: AUDITORÍA ═══ */}
        {activeTab === TAB_AUDITORIA && canBackoffice(activeRole) && (
          <section className={`${card} p-5 space-y-4`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-slate-800">Registro de Auditoría</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {auditLogs.length} evento{auditLogs.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  disabled={exporting !== '' || auditLogs.length === 0}
                  onClick={() => runExport('auditoria-excel', exportAuditoriaExcel)}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                >
                  {exporting === 'auditoria-excel' && <InlineSpinner />}
                  Excel
                </button>
                <button
                  type="button"
                  disabled={exporting !== '' || auditLogs.length === 0}
                  onClick={() => runExport('auditoria-pdf', exportAuditoriaPdf)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                >
                  {exporting === 'auditoria-pdf' && <InlineSpinner />}
                  PDF
                </button>
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
                    <th className="px-4 py-3 font-semibold text-slate-700">Usuario</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Rol</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Acción</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
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
                          <td className="px-4 py-3 text-slate-700">{log.rol || activeRole}</td>
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

        {activeTab === TAB_USUARIOS && isAdmin(activeRole) && (
          <section className="space-y-5">
            {userSuccess && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                {userSuccess}
              </div>
            )}

            <div className={`${card} p-5`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Administración de Usuarios</h2>
                  <p className="text-sm text-slate-500">Gestiona cuentas administrativas, analistas y accesos estudiantiles protegidos por JWT.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {adminUsers.length} cuenta{adminUsers.length !== 1 ? 's' : ''}
                </span>
              </div>

              <form onSubmit={handleUserSubmit} className="grid gap-3 lg:grid-cols-3" noValidate>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Nombre completo</span>
                  <input
                    type="text"
                    name="nombreCompleto"
                    value={userForm.nombreCompleto}
                    onChange={handleUserFormChange}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                    placeholder="Mariela de los Santos"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Rol</span>
                  <select
                    name="rol"
                    value={userForm.rol}
                    onChange={handleUserFormChange}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  >
                    {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Cédula</span>
                  <input
                    type="text"
                    name="cedula"
                    value={userForm.cedula}
                    onChange={handleUserFormChange}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                    placeholder="000-0000000-0"
                  />
                </label>
                <label className="grid gap-1 lg:col-span-2">
                  <span className="text-sm text-slate-600">Correo institucional</span>
                  <input
                    type="email"
                    name="correoInstitucional"
                    value={userForm.correoInstitucional}
                    onChange={handleUserFormChange}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none disabled:bg-slate-100"
                    placeholder={userForm.rol === 'Analista MINERD' ? 'usuario@minerd.gob.do' : userForm.rol === 'Analista MESCYT' ? 'usuario@mescyt.gob.do' : 'admin@edumetrics.gob.do'}
                    disabled={userForm.rol === 'Estudiante'}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Contraseña {editingUserId ? '(opcional)' : ''}</span>
                  <input
                    type="password"
                    name="password"
                    value={userForm.password}
                    onChange={handleUserFormChange}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none disabled:bg-slate-100"
                    placeholder={userForm.rol === 'Estudiante' ? 'No aplica para estudiantes' : '••••••••'}
                    disabled={userForm.rol === 'Estudiante'}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 lg:col-span-3">
                  <input type="checkbox" name="activo" checked={userForm.activo} onChange={handleUserFormChange} className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500" />
                  Cuenta activa
                </label>
                <div className="flex flex-wrap items-center gap-2 lg:col-span-3">
                  {editingUserId && (
                    <button type="button" onClick={resetUserForm} disabled={userSaving} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Cancelar edición
                    </button>
                  )}
                  <button type="submit" disabled={userSaving} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:bg-violet-400">
                    {userSaving && <InlineSpinner className="border-white/50 border-t-white" />}
                    {editingUserId ? 'Guardar cuenta' : 'Crear cuenta'}
                  </button>
                </div>
              </form>

              {userFormError && (
                <p role="alert" className="mt-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{userFormError}</p>
              )}
            </div>

            <div className={`${card} p-5`}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-800">Cuentas registradas</h3>
                {usersLoading && <span className="inline-flex items-center gap-2 text-sm text-slate-500"><InlineSpinner /> Cargando usuarios…</span>}
              </div>

              {usersError && (
                <p role="alert" className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{usersError}</p>
              )}

              {usersLoading ? (
                <TableSkeleton rows={6} />
              ) : adminUsers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  No hay cuentas disponibles para mostrar.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[920px] text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Nombre', 'Rol', 'Cédula', 'Correo', 'Estado', 'Acciones'].map(header => (
                          <th key={header} className="px-4 py-3 font-semibold text-slate-700">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map(user => (
                        <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{user.nombreCompleto}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getUserRoleBadgeClasses(user.rol)}`}>
                              {user.rol}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{user.cedula || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{user.correoInstitucional || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                              {user.activo ? 'Activa' : 'Revocada'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button type="button" onClick={() => startEditUser(user)} className="mr-2 rounded-md border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100">
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeUser(user)}
                              disabled={!user.activo || revokingUserId === user.id}
                              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                            >
                              {revokingUserId === user.id ? 'Revocando…' : 'Revocar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══ ESTUDIANTIL: MI PERFIL ═══ */}
        {activeTab === TAB_PERFIL && !canBackoffice(activeRole) && (
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
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${getModalidadBadgeClasses(normalizeModalidad(studentProfile?.modalidadAcademica))}`}>
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
        {activeTab === TAB_PENSUM && !canBackoffice(activeRole) && (
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
        {activeTab === TAB_BECAS && !canBackoffice(activeRole) && (
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