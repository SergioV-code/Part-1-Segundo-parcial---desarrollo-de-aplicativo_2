// ─── API ───────────────────────────────────────────────────────────────────────
const PRODUCTION_API_BASE = 'https://part-1-segundo-parcial-desarrollo-de-aplicativ-production.up.railway.app/api'
const cleanBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/[\[\]'\"]/g, '').replace(/\/$/, '')
const rawApiUrl = cleanBaseUrl.trim()
const normalizedApiUrl = rawApiUrl
export const API_BASE = normalizedApiUrl
  ? normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`
  : PRODUCTION_API_BASE

// ─── MODALIDADES ──────────────────────────────────────────────────────────────
export const MOD_ACADEMICA = 'Modalidad Academica'
export const MOD_TECNICO   = 'Modalidad Tecnico Profesional'

// ─── TABS GUBERNAMENTALES ────────────────────────────────────────────────────
export const TAB_INICIO     = 'Inicio'
export const TAB_GESTION    = 'Gestion de Expedientes'
export const TAB_FORMULARIO = 'Formulario de Registro'
export const TAB_REPORTES   = 'Reportes Empresariales'
export const TAB_AUDITORIA  = 'Registro de Auditoria'
export const GOV_TABS = [TAB_INICIO, TAB_GESTION, TAB_FORMULARIO, TAB_REPORTES, TAB_AUDITORIA]

// ─── TABS ESTUDIANTILES ──────────────────────────────────────────────────────
export const TAB_PERFIL = 'Mi Perfil'
export const TAB_PENSUM = 'Mi Pensum'
export const TAB_BECAS  = 'Oportunidades y Becas'
export const STU_TABS = [TAB_PERFIL, TAB_PENSUM, TAB_BECAS]

// ─── ROLES ───────────────────────────────────────────────────────────────────
export const ROLES = ['Analista MINERD', 'Analista MESCYT', 'Estudiante']
export const ROL_COLORS = {
  'Analista MINERD': { bg: '#1d4ed8', badge: 'bg-blue-100 text-blue-800' },
  'Analista MESCYT': { bg: '#0f766e', badge: 'bg-teal-100 text-teal-800' },
  'Estudiante':      { bg: '#7c3aed', badge: 'bg-violet-100 text-violet-800' },
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
export const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(145deg,#f0f4ff 0%,#e8f4ff 50%,#f0fff8 100%)',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  color: '#0f172a',
}

export const card = 'bg-white border border-slate-200 rounded-2xl shadow-sm'
