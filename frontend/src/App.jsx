import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as XLSX from 'xlsx'

// ─── API BASE ──────────────────────────────────────────────────────────────────
const rawUrl = import.meta.env.VITE_API_URL || 'https://resilient-transformation-production.up.railway.app'
const cleanBaseUrl = rawUrl.replace(/[\[\]'\"]/g, '').replace(/\/$/, '')
const normalizedApiUrl = cleanBaseUrl.trim()

const configuredApiBase = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`

const PRODUCTION_API_BASE = configuredApiBase

const API_BASE_CANDIDATES = Array.from(new Set([
  configuredApiBase,
  PRODUCTION_API_BASE,
].filter(Boolean)))

const API_REQUEST_TIMEOUT_MS = 22000
const AUTH_REQUEST_TIMEOUT_MS = 30000
const SESSION_STORAGE_KEY = 'edumetrics-session-v1'
const SESSION_CLOCK_SKEW_MS = 30000

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
async function apiRequest(path, { method = 'GET', token = '', body = null, role = '' } = {}) {
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(role ? { 'X-User-Role': role } : {}),
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

        if (res.status === 502 || res.status === 503 || res.status === 504) {
          lastError = new Error(`HTTP ${res.status} - ${detail}`)
          continue
        }

        if (res.status >= 500) {
          throw new Error(`HTTP ${res.status} - ${detail}`)
        }

        if (res.status === 400) {
          const apiError = new Error(
            path.startsWith('/Auth/login')
              ? 'Datos inválidos. Verifica correo institucional y contraseña (mínimo 8 caracteres).'
              : detail,
          )
          apiError.isApiResponse = true
          throw apiError
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

      if (error?.isApiResponse || /HTTP [45]\d\d/i.test(message)) {
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
    throw new Error('No fue posible conectar con la API. Verifica que el backend configurado esté activo y respondiendo (health endpoint).')
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
const TAB_EVALUACION_BECAS = 'Bandeja de Becas'
const GOV_TABS = [TAB_INICIO, TAB_GESTION, TAB_FORMULARIO, TAB_REPORTES, TAB_EVALUACION_BECAS, TAB_AUDITORIA]
const ADMIN_TABS = [...GOV_TABS, TAB_USUARIOS]

const TAB_PERFIL = 'Mi Perfil'
const TAB_PENSUM = 'Mi Pensum'
const TAB_BECAS  = 'Oportunidades y Becas'
const STU_TABS   = [TAB_PERFIL, TAB_PENSUM, TAB_BECAS]
const TRACEABILITY_EMAIL = 'sergiovargasdiaz316@gmail.com'
const ANALYST_REVIEW_GENERAL = 'Revision General'
const ANALYST_REVIEW_DOCUMENTS = 'Validacion Documental'
const ANALYST_REVIEW_CRITERIA = 'Criterios Internacionales'
const SCHOLARSHIP_CRITICAL_AUDIT_ACTIONS = new Set([
  'APROBAR_SOLICITUD_BECA',
  'RECHAZAR_SOLICITUD_BECA',
  'COMPLETAR_SOLICITUD_BECA',
])
const DOCUMENT_PREVIEW_TEMPLATE = {
  'Record de notas': { viewType: 'pdf', repositoryCode: 'RDN' },
  'Titulo legalizado': { viewType: 'pdf', repositoryCode: 'TLG' },
  'Certificacion de idioma': { viewType: 'pdf', repositoryCode: 'CDI' },
  'Documento de identidad': { viewType: 'image', repositoryCode: 'DID' },
  'Carta de admision': { viewType: 'pdf', repositoryCode: 'CAD' },
}

const VERIFIED_INTERNATIONAL_AGREEMENTS = [
  {
    id: 'es-ucm',
    country: 'Espana',
    foreignUniversity: 'Universidad Complutense de Madrid',
    institutionName: 'MESCYT/MINERD',
    programs: [
      'Ingenieria en Sistemas',
      'Administracion de Empresas',
      'Derecho',
      'Ciencias de la Salud',
      'Maestria en Inteligencia Artificial',
      'Energias Renovables',
    ],
    minAcademicIndex: 80,
    languageRequirements: 'Dominio de espanol C1',
    admissionRequirement: 'Carta de admision definitiva',
    coverageType: 'Matricula completa, estipendio mensual de manutencion, pasaje aereo y seguro medico integral',
    languageOrAdmissionRequirement: 'Indice minimo de 80, titulacion legalizada, dominio de espanol C1 y carta de admision definitiva',
    coverageMatrix: 'Matricula: 100% | Manutencion: mensual | Pasaje: ida/vuelta | Seguro: internacional integral',
    requiredDocuments: [
      'Record de notas',
      'Titulo legalizado',
      'Certificacion de idioma',
      'Carta de admision',
      'Documento de identidad',
    ],
    closingDate: '2026-11-15',
    sourceLabel: 'Convenio oficial MESCYT/MINERD',
    url: 'https://mescyt.gob.do',
  },
  {
    id: 'es-ugr',
    country: 'Espana',
    foreignUniversity: 'Universidad de Granada',
    institutionName: 'MESCYT/MINERD',
    programs: [
      'Ingenieria en Sistemas',
      'Administracion de Empresas',
      'Derecho',
      'Ciencias de la Salud',
      'Maestria en Inteligencia Artificial',
      'Energias Renovables',
    ],
    minAcademicIndex: 80,
    languageRequirements: 'Dominio de espanol C1',
    admissionRequirement: 'Carta de admision definitiva',
    coverageType: 'Matricula completa, estipendio mensual de manutencion, pasaje aereo y seguro medico integral',
    languageOrAdmissionRequirement: 'Indice minimo de 80, titulacion legalizada, dominio de espanol C1 y carta de admision definitiva',
    coverageMatrix: 'Matricula: 100% | Manutencion: mensual | Pasaje: ida/vuelta | Seguro: internacional integral',
    requiredDocuments: [
      'Record de notas',
      'Titulo legalizado',
      'Certificacion de idioma',
      'Carta de admision',
      'Documento de identidad',
    ],
    closingDate: '2026-11-15',
    sourceLabel: 'Convenio oficial MESCYT/MINERD',
    url: 'https://mescyt.gob.do',
  },
  {
    id: 'ca-utoronto',
    country: 'Canada',
    foreignUniversity: 'University of Toronto',
    institutionName: 'MESCYT/MINERD',
    programs: [
      'Ingenieria de Software Avanzada',
      'Ciencia de Datos',
      'Gestion Ambiental',
      'Finanzas Corporativas',
    ],
    minAcademicIndex: 88,
    languageRequirements: 'IELTS 6.5 minimo o TOEFL equivalente',
    admissionRequirement: 'Carta de aceptacion condicional o definitiva',
    coverageType: 'Matricula parcial o total, estipendio, pasaje y seguro medico',
    languageOrAdmissionRequirement: 'Indice minimo de 88, IELTS 6.5 minimo (o TOEFL) y carta de aceptacion condicional o definitiva',
    coverageMatrix: 'Matricula: parcial/total | Manutencion: mensual | Pasaje: ida/vuelta | Seguro: internacional',
    requiredDocuments: [
      'Record de notas',
      'Certificacion IELTS o TOEFL',
      'Carta de aceptacion',
      'Documento de identidad',
    ],
    closingDate: '2026-12-05',
    sourceLabel: 'Convenio oficial MESCYT/MINERD',
    url: 'https://mescyt.gob.do',
  },
  {
    id: 'ca-ubc',
    country: 'Canada',
    foreignUniversity: 'University of British Columbia',
    institutionName: 'MESCYT/MINERD',
    programs: [
      'Ingenieria de Software Avanzada',
      'Ciencia de Datos',
      'Gestion Ambiental',
      'Finanzas Corporativas',
    ],
    minAcademicIndex: 88,
    languageRequirements: 'IELTS 6.5 minimo o TOEFL equivalente',
    admissionRequirement: 'Carta de aceptacion condicional o definitiva',
    coverageType: 'Matricula parcial o total, estipendio, pasaje y seguro medico',
    languageOrAdmissionRequirement: 'Indice minimo de 88, IELTS 6.5 minimo (o TOEFL) y carta de aceptacion condicional o definitiva',
    coverageMatrix: 'Matricula: parcial/total | Manutencion: mensual | Pasaje: ida/vuelta | Seguro: internacional',
    requiredDocuments: [
      'Record de notas',
      'Certificacion IELTS o TOEFL',
      'Carta de aceptacion',
      'Documento de identidad',
    ],
    closingDate: '2026-12-05',
    sourceLabel: 'Convenio oficial MESCYT/MINERD',
    url: 'https://mescyt.gob.do',
  },
  {
    id: 'fr-paris-saclay-posgrado',
    country: 'Francia',
    foreignUniversity: 'Universite Paris-Saclay',
    institutionName: 'MESCYT/MINERD',
    programs: [
      'Ingenieria Aeroespacial',
      'Biotecnologia',
      'Matematicas Aplicadas',
      'Ciencias Economicas',
    ],
    minAcademicIndex: 82,
    languageRequirements: 'DELF B2/C1 o Ingles segun programa',
    admissionRequirement: 'Carta de admision definitiva',
    coverageType: 'Matricula completa, estipendio mensual de manutencion, pasaje aereo y seguro medico integral',
    languageOrAdmissionRequirement: 'Indice minimo de 82, certificacion de idioma (Francés DELF B2/C1 o Ingles segun el programa) y carta de admision definitiva',
    coverageMatrix: 'Matricula: 100% | Manutencion: mensual | Pasaje: ida/vuelta | Seguro: internacional integral',
    requiredDocuments: [
      'Record de notas',
      'Titulo legalizado',
      'Certificacion DELF o equivalente',
      'Carta de admision',
      'Documento de identidad',
    ],
    closingDate: '2026-11-30',
    sourceLabel: 'Convenio oficial MESCYT/MINERD',
    url: 'https://mescyt.gob.do',
  },
  {
    id: 'uk-edinburgh-maestria',
    country: 'Reino Unido',
    foreignUniversity: 'University of Edinburgh',
    institutionName: 'MESCYT/MINERD',
    programs: [
      'Negocios Internacionales',
      'Salud Publica',
      'Desarrollo Sostenible',
      'Computacion Avanzada',
    ],
    minAcademicIndex: 85,
    languageRequirements: 'IELTS 6.5 minimo',
    admissionRequirement: 'Carta de admision condicional o definitiva',
    coverageType: 'Matricula completa o parcial, manutencion y seguro medico internacional',
    languageOrAdmissionRequirement: 'Indice academico minimo de 85, IELTS con puntuacion minima de 6.5 y carta de admision condicional o definitiva',
    coverageMatrix: 'Matricula: completa/parcial | Manutencion: mensual | Seguro: internacional',
    requiredDocuments: [
      'Record de notas',
      'Certificacion IELTS',
      'Carta de admision',
      'Documento de identidad',
    ],
    closingDate: '2026-12-15',
    sourceLabel: 'Convenio oficial MESCYT/MINERD',
    url: 'https://mescyt.gob.do',
  },
  {
    id: 'mx-itesm-movilidad-posgrado',
    country: 'Mexico',
    foreignUniversity: 'Tecnologico de Monterrey - ITESM',
    institutionName: 'MESCYT/MINERD',
    programs: [
      'Administracion de Negocios (MBA)',
      'Ingenieria Industrial y de Sistemas',
      'Innovacion Educativa',
    ],
    minAcademicIndex: 85,
    languageRequirements: 'Idioma segun programa y proceso ITESM',
    admissionRequirement: 'Titulacion de grado y proceso de admision aprobado',
    coverageType: 'Exoneracion de matricula institucional y apoyo de manutencion complementario',
    languageOrAdmissionRequirement: 'Indice academico minimo de 85, titulacion de grado y proceso de admision aprobado por el ITESM',
    coverageMatrix: 'Matricula: exoneracion institucional | Manutencion: apoyo complementario',
    requiredDocuments: [
      'Record de notas',
      'Titulo de grado',
      'Carta de aceptacion ITESM',
      'Documento de identidad',
    ],
    closingDate: '2026-11-30',
    sourceLabel: 'Convenio oficial MESCYT/MINERD',
    url: 'https://mescyt.gob.do',
  },
]

const ROLES = ['Analista MESCYT/MINERD', 'Estudiante', 'Administrador']
const ROL_COLORS = {
  'Analista MESCYT/MINERD': { bg: '#0f3a7a', badge: 'bg-blue-100 text-blue-900' },
  'Estudiante':      { bg: '#166534', badge: 'bg-emerald-100 text-emerald-900' },
  'Administrador':   { bg: '#4c1d95', badge: 'bg-violet-100 text-violet-900' },
}

const normalizeRoleForUi = rol => {
  if (rol === 'Analista MINERD' || rol === 'Analista MESCYT' || rol === 'Analista MESCYT/MINERD') {
    return 'Analista MESCYT/MINERD'
  }

  return rol || ROLES[0]
}

const isGov = rol => normalizeRoleForUi(rol) === 'Analista MESCYT/MINERD'
const isAdmin = rol => normalizeRoleForUi(rol) === 'Administrador'
const canBackoffice = rol => isGov(rol) || isAdmin(rol)
const isKnownRole = rol => [
  'Analista MESCYT/MINERD',
  'Analista MINERD',
  'Analista MESCYT',
  'Estudiante',
  'Administrador',
].includes((rol || '').trim())

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

function buildScholarshipCards(carrera = '', ies = '') {
  const carreraTexto = (carrera || '').toString().trim().toLowerCase()
  const iesTexto = (ies || '').toString().trim().toLowerCase()

  const basePrograms = [
    {
      nombre: `Beca MESCYT de Excelencia - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'MESCYT/MINERD',
      monto: 'RD$ 25,000 / año o hasta 100% de matrícula según criterio institucional',
      requisito: 'Promedio mínimo 85 o índice equivalente y perfil académico alineado con la carrera',
      cierre: '2026-08-31',
      url: 'https://mescyt.gob.do',
      color: 'border-blue-300 bg-blue-50',
      badge: 'bg-blue-100 text-blue-800',
    },
    {
      nombre: `Beca de Permanencia Académica - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'MESCYT/MINERD',
      monto: 'RD$ 15,000 / semestre o apoyo parcial de matrícula',
      requisito: 'Promedio mínimo 80, continuidad académica y cumplimiento de carga mínima',
      cierre: '2026-09-15',
      url: 'https://minerd.gob.do',
      color: 'border-emerald-300 bg-emerald-50',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    {
      nombre: `Beca Institucional de Movilidad - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: iesTexto || 'IES seleccionada',
      monto: 'Cobertura parcial o total de matrícula según convenio institucional',
      requisito: 'Aceptación en la IES, buen rendimiento académico y cumplimiento de requisitos del convenio',
      cierre: '2026-10-01',
      url: 'https://www.educando.edu.do',
      color: 'border-violet-300 bg-violet-50',
      badge: 'bg-violet-100 text-violet-800',
    },
    {
      nombre: `Beca de Investigación y Talento - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'MESCYT/MINERD',
      monto: 'RD$ 30,000 / año o apoyo especializado para proyectos',
      requisito: 'Promedio mínimo 90, evidencia de desempeño y alineación con programas de investigación',
      cierre: '2026-11-30',
      url: 'https://mescyt.gob.do',
      color: 'border-amber-300 bg-amber-50',
      badge: 'bg-amber-100 text-amber-800',
    },
    ...VERIFIED_INTERNATIONAL_AGREEMENTS.flatMap((agreement, agreementIndex) =>
      agreement.programs.map((program, programIndex) => ({
      nombre: `Beca Internacional ${agreement.country} - ${agreement.foreignUniversity} - ${program}`,
      modalidad: 'Internacional',
      entidad: agreement.institutionName,
      monto: agreement.coverageType,
      requisito: agreement.languageOrAdmissionRequirement,
      cierre: agreement.closingDate || '2026-12-05',
      url: agreement.url,
      color: (agreementIndex + programIndex) % 2 === 0 ? 'border-fuchsia-300 bg-fuchsia-50' : 'border-sky-300 bg-sky-50',
      badge: (agreementIndex + programIndex) % 2 === 0 ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-sky-100 text-sky-800',
      destinoPais: agreement.country,
      universidadExtranjera: agreement.foreignUniversity,
      tipoCobertura: agreement.coverageType,
      requisitosIdiomaOAdmision: agreement.languageOrAdmissionRequirement,
      carreraPrograma: program,
      convenioOficial: agreement.sourceLabel,
      minAcademicIndex: agreement.minAcademicIndex,
      languageRequirements: agreement.languageRequirements,
      admissionRequirement: agreement.admissionRequirement,
      coverageMatrix: agreement.coverageMatrix,
      requiredDocuments: agreement.requiredDocuments,
    }))),
  ]

  const institutionalMatches = []
  if (iesTexto.includes('itla')) {
    institutionalMatches.push({
      nombre: `Beca ITLA de Carrera - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'ITLA',
      monto: 'Cobertura parcial de matrícula',
      requisito: 'Promedio mínimo 80 y matrícula activa en programas técnicos o tecnológicos',
      cierre: '2026-09-20',
      url: 'https://www.itla.edu.do',
      color: 'border-slate-300 bg-slate-100',
      badge: 'bg-slate-100 text-slate-800',
    })
  }

  if (iesTexto.includes('uasd')) {
    institutionalMatches.push({
      nombre: `Beca UASD de Excelencia - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'UASD',
      monto: 'Apoyo parcial de matrícula',
      requisito: 'Promedio mínimo 85 y permanencia institucional',
      cierre: '2026-09-25',
      url: 'https://www.uasd.edu.do',
      color: 'border-rose-300 bg-rose-50',
      badge: 'bg-rose-100 text-rose-800',
    })
  }

  if (iesTexto.includes('pucmm')) {
    institutionalMatches.push({
      nombre: `Beca PUCMM de Excelencia - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'PUCMM',
      monto: 'Cobertura parcial o total según beca institucional',
      requisito: 'Promedio mínimo 88 y perfil de liderazgo académico',
      cierre: '2026-10-10',
      url: 'https://www.pucmm.edu.do',
      color: 'border-indigo-300 bg-indigo-50',
      badge: 'bg-indigo-100 text-indigo-800',
    })
  }

  if (iesTexto.includes('unapec')) {
    institutionalMatches.push({
      nombre: `Beca UNAPEC de Carrera - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'UNAPEC',
      monto: 'Apoyo de matrícula y costos administrativos',
      requisito: 'Promedio mínimo 82 y cumplimiento de requisitos de admisión',
      cierre: '2026-10-15',
      url: 'https://www.unapec.edu.do',
      color: 'border-cyan-300 bg-cyan-50',
      badge: 'bg-cyan-100 text-cyan-800',
    })
  }

  if (iesTexto.includes('unphu')) {
    institutionalMatches.push({
      nombre: `Beca UNPHU de Permanencia - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'UNPHU',
      monto: 'Cobertura parcial de matrícula',
      requisito: 'Promedio mínimo 84 y continuidad en el programa',
      cierre: '2026-10-20',
      url: 'https://www.unphu.edu.do',
      color: 'border-lime-300 bg-lime-50',
      badge: 'bg-lime-100 text-lime-800',
    })
  }

  if (iesTexto.includes('utesa')) {
    institutionalMatches.push({
      nombre: `Beca UTESA de Talento - ${carreraTexto || 'Carrera'}`,
      modalidad: 'Nacional',
      entidad: 'UTESA',
      monto: 'Apoyo parcial de matrícula',
      requisito: 'Promedio mínimo 86 y perfil de liderazgo académico',
      cierre: '2026-10-25',
      url: 'https://www.utesa.edu',
      color: 'border-orange-300 bg-orange-50',
      badge: 'bg-orange-100 text-orange-800',
    })
  }

  return [...basePrograms, ...institutionalMatches]
}

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
  if (isGov(rol)) return value.endsWith('@minerd.gob.do') || value.endsWith('@mescyt.gob.do')
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
  if (role === 'Analista MESCYT/MINERD') return 'bg-blue-100 text-blue-800'
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

function getJwtExpirationMs(token) {
  const payload = decodeJwtPayload(token)
  const exp = Number(payload?.exp)
  if (!Number.isFinite(exp) || exp <= 0) return null
  return exp * 1000
}

function isJwtExpired(token) {
  const expirationMs = getJwtExpirationMs(token)
  if (!expirationMs) return true
  return Date.now() >= (expirationMs - SESSION_CLOCK_SKEW_MS)
}

function getDefaultTabByRole(role) {
  return canBackoffice(role) ? TAB_INICIO : TAB_PERFIL
}

function getAllowedTabsByRole(role) {
  if (isAdmin(role)) return ADMIN_TABS
  if (canBackoffice(role)) return GOV_TABS
  return STU_TABS
}

function resolveTabForRole(candidateTab, role) {
  const allowedTabs = getAllowedTabsByRole(role)
  return allowedTabs.includes(candidateTab) ? candidateTab : getDefaultTabByRole(role)
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

  if (role === 'Analista MESCYT/MINERD' && !correo.endsWith('@minerd.gob.do') && !correo.endsWith('@mescyt.gob.do')) {
    return 'El correo para Analista MESCYT/MINERD debe terminar en @minerd.gob.do o @mescyt.gob.do.'
  }

  if (!isEditing && password.length < 8) {
    return 'La contraseña inicial debe tener al menos 8 caracteres.'
  }

  if (password && password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }

  return ''
}

function validateScholarshipRequestForm(form) {
  const requiredErrors = {}
  const scholarshipType = (form.scholarshipType || 'Nacional').trim()
  const institutionName = (form.institutionName || '').trim()
  const careerName = (form.careerName || '').trim()
  const studentComment = (form.studentComment || '').trim()

  if (!scholarshipType) {
    requiredErrors.scholarshipType = 'La modalidad de beca es obligatoria.'
  }

  if (institutionName.length < 3) {
    requiredErrors.institutionName = 'La institución de la beca es obligatoria.'
  }

  if (careerName.length < 3) {
    requiredErrors.careerName = 'La carrera o programa es obligatoria.'
  }

  if (studentComment.length < 5) {
    requiredErrors.studentComment = 'El comentario del estudiante es obligatorio.'
  }

  const destinationCountry = (form.destinationCountry || '').trim()
  const foreignUniversity = (form.foreignUniversity || '').trim()
  const internationalCoverageType = (form.internationalCoverageType || '').trim()
  const languageOrAdmissionRequirement = (form.languageOrAdmissionRequirement || '').trim()

  if (scholarshipType === 'Internacional') {
    if (destinationCountry.length < 2) {
      requiredErrors.destinationCountry = 'Para beca internacional debe indicar el país de destino.'
    }

    if (foreignUniversity.length < 3) {
      requiredErrors.foreignUniversity = 'Para beca internacional debe indicar la universidad extranjera.'
    }

    if (internationalCoverageType.length < 5) {
      requiredErrors.internationalCoverageType = 'Para beca internacional debe indicar el tipo de cobertura.'
    }

    if (languageOrAdmissionRequirement.length < 5) {
      requiredErrors.languageOrAdmissionRequirement = 'Para beca internacional debe indicar los requisitos de idioma o admisión.'
    }

    const hasOfficialAgreement = VERIFIED_INTERNATIONAL_AGREEMENTS.some(agreement =>
      agreement.country === destinationCountry
      && agreement.foreignUniversity === foreignUniversity
      && agreement.programs.includes(careerName),
    )

    if (!hasOfficialAgreement) {
      requiredErrors.foreignUniversity = 'Debes seleccionar una combinación oficial MESCYT/MINERD verificada para beca internacional.'
    }
  }

  const keys = Object.keys(requiredErrors)
  return {
    isValid: keys.length === 0,
    errors: requiredErrors,
    firstError: keys.length > 0 ? requiredErrors[keys[0]] : '',
  }
}

function isScholarshipFieldInvalid(validation, form, attempted, fieldName) {
  const hasError = Boolean(validation?.errors?.[fieldName])
  if (!hasError) return false
  const value = form?.[fieldName]
  return attempted || (typeof value === 'string' ? value.trim().length > 0 : Boolean(value))
}

function getAutoScholarshipName(form) {
  const scholarshipType = (form?.scholarshipType || 'Nacional').trim()
  const institutionName = (form?.institutionName || '').trim()
  const careerName = (form?.careerName || '').trim()
  return `Beca ${scholarshipType} ${institutionName || 'MESCYT/MINERD'} - ${careerName || 'Programa universitario'}`
}

function parseBlockMetadata(content, startTag, endTag) {
  const text = (content || '').toString()
  const start = text.indexOf(startTag)
  const end = text.indexOf(endTag)
  if (start < 0 || end < 0 || end <= start) return {}

  const chunk = text.slice(start + startTag.length, end)
  const lines = chunk.split('\n').map(line => line.trim()).filter(Boolean)
  const result = {}
  for (const line of lines) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex < 0) continue
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (key) result[key] = value
  }
  return result
}

function getInternationalAgreementByValues(country, university, careerName) {
  return VERIFIED_INTERNATIONAL_AGREEMENTS.find(agreement =>
    agreement.country === (country || '').trim()
    && agreement.foreignUniversity === (university || '').trim()
    && agreement.programs.includes((careerName || '').trim()),
  ) || null
}

function getInternationalDetailsFromApplication(application) {
  const comment = (application?.studentComment || '').trim()
  const metadata = parseBlockMetadata(comment, '[DETALLE_BECA_INTERNACIONAL]', '[/DETALLE_BECA_INTERNACIONAL]')
  const country = metadata['Pais de destino'] || ''
  const university = metadata['Universidad extranjera'] || ''
  const coverage = metadata.Cobertura || ''
  const languageOrAdmission = metadata['Requisitos idioma/admision'] || ''
  const careerName = (application?.careerName || '').trim()
  const agreement = getInternationalAgreementByValues(country, university, careerName)

  return {
    isInternational: Boolean(country || university) || ((application?.scholarshipName || '').includes('[Internacional]')),
    country,
    university,
    coverage,
    languageOrAdmission,
    agreement,
  }
}

function getDocumentReviewRows(application) {
  const comment = (application?.studentComment || '').trim()
  const metadata = parseBlockMetadata(comment, '[DOCUMENTOS_DIGITALIZADOS]', '[/DOCUMENTOS_DIGITALIZADOS]')
  const studentIdentity = (application?.studentCedula || '').trim() || 'Cedula no informada'

  const fallbackMetadata = {
    'Record de notas': `Precargado automaticamente desde repositorio ministerial (Expediente ${studentIdentity})`,
    'Titulo legalizado': `Precargado automaticamente desde repositorio ministerial (Expediente ${studentIdentity})`,
    'Certificacion de idioma': `Precargado automaticamente desde repositorio ministerial (Expediente ${studentIdentity})`,
    'Documento de identidad': `Precargado automaticamente desde repositorio ministerial (Expediente ${studentIdentity})`,
    'Carta de admision': `Precargado automaticamente desde repositorio ministerial (Expediente ${studentIdentity})`,
  }

  const resolved = Object.keys(metadata).length > 0 ? metadata : fallbackMetadata

  return [
    {
      label: 'Record de notas',
      value: resolved['Record de notas'] || '',
      ...DOCUMENT_PREVIEW_TEMPLATE['Record de notas'],
    },
    {
      label: 'Titulo legalizado',
      value: resolved['Titulo legalizado'] || '',
      ...DOCUMENT_PREVIEW_TEMPLATE['Titulo legalizado'],
    },
    {
      label: 'Certificacion de idioma',
      value: resolved['Certificacion de idioma'] || '',
      ...DOCUMENT_PREVIEW_TEMPLATE['Certificacion de idioma'],
    },
    {
      label: 'Documento de identidad',
      value: resolved['Documento de identidad'] || '',
      ...DOCUMENT_PREVIEW_TEMPLATE['Documento de identidad'],
    },
    {
      label: 'Carta de admision',
      value: resolved['Carta de admision'] || '',
      ...DOCUMENT_PREVIEW_TEMPLATE['Carta de admision'],
    },
  ]
}

function normalizeAuditRow(log, source = 'session') {
  if (!log) return null
  const fecha = (log.fecha || log.fechaHora || '').toString().trim()
  if (!fecha) return null

  return {
    id: (log.id || `${source}-${fecha}-${Math.random().toString(36).slice(2, 8)}`).toString(),
    fecha,
    usuario: (log.usuario || '').toString().trim() || 'anonimo',
    rol: (log.rol || '').toString().trim() || 'sin-rol',
    accion: (log.accion || '').toString().trim() || 'SIN_ACCION',
    detalles: (log.detalles || '').toString().trim() || 'Sin detalles',
    source,
  }
}

function normalizeAuditCollection(rows, source) {
  return (Array.isArray(rows) ? rows : [])
    .map(item => normalizeAuditRow(item, source))
    .filter(Boolean)
}

function mergeAuditCollections(sessionLogs, backendLogs) {
  const merged = [...normalizeAuditCollection(sessionLogs, 'session'), ...normalizeAuditCollection(backendLogs, 'backend')]
  const unique = new Map()

  for (const item of merged) {
    const key = `${item.fecha}|${item.usuario}|${item.accion}|${item.detalles}`
    if (!unique.has(key)) {
      unique.set(key, item)
    }
  }

  return Array.from(unique.values()).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
}

function buildDocumentPdfPreviewBlob(docLabel, application, docValue) {
  const document = new jsPDF({ orientation: 'portrait' })
  document.setFontSize(14)
  document.text('EDUMETRICS-DR - Visor Institucional de Documentos', 14, 16)
  document.setFontSize(10)
  document.text(`Documento: ${docLabel}`, 14, 26)
  document.text(`Expediente: ${(application?.studentCedula || '').trim() || 'No informado'}`, 14, 34)
  document.text(`Estudiante: ${(application?.studentName || '').trim() || 'No informado'}`, 14, 42)
  document.text(`Solicitud: #${application?.id || 'N/A'}`, 14, 50)
  document.text(`Fuente: Repositorio institucional MESCYT/MINERD`, 14, 58)
  document.text(`Detalle: ${docValue || 'Precargado automaticamente para validacion'}`, 14, 66, { maxWidth: 180 })
  document.setFontSize(9)
  document.text(`Generado: ${new Date().toLocaleString('es-DO')}`, 14, 78)
  return document.output('blob')
}

function buildDocumentImagePreviewBlob(docLabel, application, docValue) {
  const escapedLabel = (docLabel || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapedCedula = ((application?.studentCedula || '').trim() || 'No informado')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapedStudent = ((application?.studentName || '').trim() || 'No informado')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapedValue = (docValue || 'Precargado automaticamente para validacion')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ecfeff" />
          <stop offset="100%" stop-color="#dbeafe" />
        </linearGradient>
      </defs>
      <rect width="1200" height="1600" fill="url(#bg)" />
      <rect x="70" y="70" width="1060" height="1460" rx="28" fill="#ffffff" stroke="#0f172a" stroke-width="4" />
      <text x="130" y="170" font-size="44" font-family="Segoe UI, sans-serif" fill="#0f172a">EDUMETRICS-DR · Visor Institucional</text>
      <text x="130" y="250" font-size="34" font-family="Segoe UI, sans-serif" fill="#0f172a">Documento: ${escapedLabel}</text>
      <text x="130" y="320" font-size="30" font-family="Segoe UI, sans-serif" fill="#1e293b">Estudiante: ${escapedStudent}</text>
      <text x="130" y="380" font-size="30" font-family="Segoe UI, sans-serif" fill="#1e293b">Cedula: ${escapedCedula}</text>
      <text x="130" y="440" font-size="26" font-family="Segoe UI, sans-serif" fill="#334155">Solicitud: #${application?.id || 'N/A'}</text>
      <text x="130" y="500" font-size="26" font-family="Segoe UI, sans-serif" fill="#334155">Fuente: Repositorio institucional MESCYT/MINERD</text>
      <foreignObject x="130" y="560" width="940" height="800">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Segoe UI,sans-serif;font-size:28px;color:#0f172a;line-height:1.45;">
          ${escapedValue}
        </div>
      </foreignObject>
      <text x="130" y="1480" font-size="24" font-family="Segoe UI, sans-serif" fill="#475569">Generado: ${new Date().toLocaleString('es-DO')}</text>
    </svg>
  `.trim()

  return new Blob([svg], { type: 'image/svg+xml' })
}

function buildDocumentPreviewArtifact(documentRow, application) {
  if (!documentRow || !application) return null

  if (documentRow.viewType === 'image') {
    const imageBlob = buildDocumentImagePreviewBlob(documentRow.label, application, documentRow.value)
    return {
      url: URL.createObjectURL(imageBlob),
      viewerType: 'image',
      repositoryCode: documentRow.repositoryCode || 'DOC',
      title: documentRow.label,
      source: 'Repositorio institucional MESCYT/MINERD',
      details: documentRow.value || 'Precargado automaticamente',
    }
  }

  const pdfBlob = buildDocumentPdfPreviewBlob(documentRow.label, application, documentRow.value)
  return {
    url: URL.createObjectURL(pdfBlob),
    viewerType: 'pdf',
    repositoryCode: documentRow.repositoryCode || 'DOC',
    title: documentRow.label,
    source: 'Repositorio institucional MESCYT/MINERD',
    details: documentRow.value || 'Precargado automaticamente',
  }
}

function buildScholarshipCommentPayload(form, studentIdentity = '') {
  const baseComment = (form?.studentComment || '').trim()
  const scholarshipType = (form?.scholarshipType || 'Nacional').trim()

  if (scholarshipType !== 'Internacional') {
    return baseComment
  }

  const metadata = [
    '[DETALLE_BECA_INTERNACIONAL]',
    `Pais de destino: ${(form?.destinationCountry || '').trim()}`,
    `Universidad extranjera: ${(form?.foreignUniversity || '').trim()}`,
    `Cobertura: ${(form?.internationalCoverageType || '').trim()}`,
    `Requisitos idioma/admision: ${(form?.languageOrAdmissionRequirement || '').trim()}`,
    '[/DETALLE_BECA_INTERNACIONAL]',
  ].join('\n')

  const documentsMetadata = [
    '[DOCUMENTOS_DIGITALIZADOS]',
    `Record de notas: Precargado automaticamente desde repositorio ministerial (Expediente ${(studentIdentity || 'Cedula no informada').trim()})`,
    `Titulo legalizado: Precargado automaticamente desde repositorio ministerial (Expediente ${(studentIdentity || 'Cedula no informada').trim()})`,
    `Certificacion de idioma: Precargado automaticamente desde repositorio ministerial (Expediente ${(studentIdentity || 'Cedula no informada').trim()})`,
    `Documento de identidad: Precargado automaticamente desde repositorio ministerial (Expediente ${(studentIdentity || 'Cedula no informada').trim()})`,
    `Carta de admision: Precargado automaticamente desde repositorio ministerial (Expediente ${(studentIdentity || 'Cedula no informada').trim()})`,
    '[/DOCUMENTOS_DIGITALIZADOS]',
  ].join('\n')

  return [baseComment, metadata, documentsMetadata].filter(Boolean).join('\n\n')
}

function getScholarshipStatusClasses(status) {
  if (status === 'Pendiente') return 'bg-amber-100 text-amber-800'
  if (status === 'En Análisis Económico') return 'bg-blue-100 text-blue-800'
  if (status === 'Completada') return 'bg-emerald-100 text-emerald-800'
  if (status === 'Rechazada') return 'bg-rose-100 text-rose-800'
  return 'bg-slate-100 text-slate-700'
}

function getScholarshipHistoryActionLabel(action) {
  const labels = {
    SOLICITUD_CREADA: 'Solicitud creada',
    SOLICITUD_APROBADA: 'Aprobada',
    SOLICITUD_RECHAZADA: 'Rechazada',
    ANALISIS_ECONOMICO_COMPLETADO: 'Flujo completado',
  }

  return labels[action] || action || 'Actualización'
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
  const [backendAuditLogs, setBackendAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [studentProfileData, setStudentProfileData] = useState(null)

  // Administración de usuarios
  const emptyUserForm = {
    nombreCompleto: '',
    rol: 'Analista MESCYT/MINERD',
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

  // Módulo de becas
  const emptyScholarshipForm = {
    scholarshipName: '',
    scholarshipType: 'Nacional',
    institutionName: '',
    careerName: '',
    destinationCountry: '',
    foreignUniversity: '',
    internationalCoverageType: '',
    languageOrAdmissionRequirement: '',
    studentComment: '',
  }
  const [scholarshipForm, setScholarshipForm] = useState(emptyScholarshipForm)
  const [scholarshipFormError, setScholarshipFormError] = useState('')
  const [scholarshipSuccess, setScholarshipSuccess] = useState('')
  const [studentScholarshipApplications, setStudentScholarshipApplications] = useState([])
  const [pendingScholarshipApplications, setPendingScholarshipApplications] = useState([])
  const [economicScholarshipApplications, setEconomicScholarshipApplications] = useState([])
  const [scholarshipLoading, setScholarshipLoading] = useState(false)
  const [scholarshipError, setScholarshipError] = useState('')
  const [scholarshipActionId, setScholarshipActionId] = useState('')
  const [analystScholarshipTab, setAnalystScholarshipTab] = useState(ANALYST_REVIEW_GENERAL)
  const [scholarshipValidationAttempted, setScholarshipValidationAttempted] = useState(false)
  const [analysisDrafts, setAnalysisDrafts] = useState({})
  const [rejectionModal, setRejectionModal] = useState({ open: false, application: null, reason: '', error: '' })
  const [scholarshipFilters, setScholarshipFilters] = useState({
    cedula: '',
    destinationCountry: 'Todos',
    foreignUniversity: 'Todas',
  })
  const [selectedDocumentPreview, setSelectedDocumentPreview] = useState(null)
  const selectedDocumentPreviewUrlRef = useRef('')
  const scholarshipValidation = useMemo(() => validateScholarshipRequestForm(scholarshipForm), [scholarshipForm])
  const internationalCountryOptions = useMemo(
    () => Array.from(new Set(VERIFIED_INTERNATIONAL_AGREEMENTS.map(item => item.country))),
    [],
  )
  const internationalUniversityOptions = useMemo(
    () => Array.from(new Set(
      VERIFIED_INTERNATIONAL_AGREEMENTS
        .filter(item => item.country === (scholarshipForm.destinationCountry || '').trim())
        .map(item => item.foreignUniversity),
    )),
    [scholarshipForm.destinationCountry],
  )
  const internationalCareerOptions = useMemo(
    () => Array.from(new Set(
      VERIFIED_INTERNATIONAL_AGREEMENTS
        .filter(item => {
          const country = (scholarshipForm.destinationCountry || '').trim()
          const university = (scholarshipForm.foreignUniversity || '').trim()
          if (!country && !university) return true
          if (country && !university) return item.country === country
          if (!country && university) return item.foreignUniversity === university
          return item.country === country && item.foreignUniversity === university
        })
        .flatMap(item => item.programs),
    )),
    [scholarshipForm.destinationCountry, scholarshipForm.foreignUniversity],
  )
  const analystScholarshipApplications = useMemo(() => {
    const merged = [...pendingScholarshipApplications, ...economicScholarshipApplications]
    const unique = new Map()
    for (const app of merged) {
      if (!app?.id) continue
      if (!unique.has(app.id)) unique.set(app.id, app)
    }

    return Array.from(unique.values()).sort((a, b) => new Date(b.submittedAtUtc || 0) - new Date(a.submittedAtUtc || 0))
  }, [pendingScholarshipApplications, economicScholarshipApplications])
  const analystRowsWithDetails = useMemo(
    () => analystScholarshipApplications.map(application => ({
      application,
      details: getInternationalDetailsFromApplication(application),
    })),
    [analystScholarshipApplications],
  )
  const analystFilterCountryOptions = useMemo(
    () => Array.from(new Set(
      analystRowsWithDetails
        .map(row => (row.details.country || '').trim())
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'es')),
    [analystRowsWithDetails],
  )
  const analystFilterUniversityOptions = useMemo(
    () => Array.from(new Set(
      analystRowsWithDetails
        .filter(row => {
          const filterCountry = (scholarshipFilters.destinationCountry || 'Todos').trim()
          if (filterCountry === 'Todos') return true
          return (row.details.country || '').trim() === filterCountry
        })
        .map(row => (row.details.university || '').trim())
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'es')),
    [analystRowsWithDetails, scholarshipFilters.destinationCountry],
  )
  const filteredAnalystRows = useMemo(() => {
    const cedulaFilter = normalizeCedula(scholarshipFilters.cedula)
    const countryFilter = (scholarshipFilters.destinationCountry || 'Todos').trim()
    const universityFilter = (scholarshipFilters.foreignUniversity || 'Todas').trim()

    return analystRowsWithDetails.filter(row => {
      const cedulaCandidate = normalizeCedula(row.application?.studentCedula || '')
      const countryCandidate = (row.details.country || '').trim()
      const universityCandidate = (row.details.university || '').trim()

      const cedulaMatch = !cedulaFilter || cedulaCandidate.includes(cedulaFilter)
      const countryMatch = countryFilter === 'Todos' || countryCandidate === countryFilter
      const universityMatch = universityFilter === 'Todas' || universityCandidate === universityFilter
      return cedulaMatch && countryMatch && universityMatch
    })
  }, [analystRowsWithDetails, scholarshipFilters])
  const filteredAnalystApplications = useMemo(
    () => filteredAnalystRows.map(row => row.application),
    [filteredAnalystRows],
  )
  const filteredAnalystInternationalApplications = useMemo(
    () => filteredAnalystRows.filter(row => row.details.isInternational),
    [filteredAnalystRows],
  )
  const filteredPendingScholarshipApplications = useMemo(
    () => filteredAnalystApplications.filter(application => application.status === 'Pendiente'),
    [filteredAnalystApplications],
  )
  const filteredEconomicScholarshipApplications = useMemo(
    () => filteredAnalystApplications.filter(application => application.status === 'En Análisis Económico'),
    [filteredAnalystApplications],
  )
  const mergedAuditLogs = useMemo(
    () => mergeAuditCollections(auditLogs, backendAuditLogs),
    [auditLogs, backendAuditLogs],
  )

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

  const handleScholarshipFilterChange = e => {
    const { name, value } = e.target
    setScholarshipFilters(prev => {
      if (name === 'destinationCountry') {
        return {
          ...prev,
          destinationCountry: value,
          foreignUniversity: value === 'Todos' ? 'Todas' : prev.foreignUniversity,
        }
      }

      return { ...prev, [name]: value }
    })
  }

  const resetScholarshipFilters = () => {
    setScholarshipFilters({ cedula: '', destinationCountry: 'Todos', foreignUniversity: 'Todas' })
  }

  const openDocumentPreview = useCallback((application, documentRow) => {
    const artifact = buildDocumentPreviewArtifact(documentRow, application)
    if (!artifact?.url) return

    if (selectedDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(selectedDocumentPreviewUrlRef.current)
      selectedDocumentPreviewUrlRef.current = ''
    }

    selectedDocumentPreviewUrlRef.current = artifact.url
    setSelectedDocumentPreview({
      applicationId: application.id,
      studentName: application.studentName,
      studentCedula: application.studentCedula,
      ...artifact,
    })
  }, [])

  const closeDocumentPreview = useCallback(() => {
    if (selectedDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(selectedDocumentPreviewUrlRef.current)
      selectedDocumentPreviewUrlRef.current = ''
    }
    setSelectedDocumentPreview(null)
  }, [])

  // ── Fetch de estudiantes ────────────────────────────────────────────────────
  const fetchStudents = useCallback(async token => {
    if ((token || '').startsWith('contingency-token')) {
      setStudents(FALLBACK_EXPEDIENTES)
      setDataError('Backend no disponible. Sesión iniciada en modo contingencia con datos locales.')
      setContingencyMode(true)
      return
    }

    try {
      setLoading(true)
      setDataError('')
      const raw = await apiRequest('/AllExampleData', { method: 'GET', token })
      setStudents(Array.isArray(raw)
        ? raw.map(s => ({ ...s, modalidadAcademica: normalizeModalidad(s?.modalidadAcademica) }))
        : [])
      setContingencyMode(false)
    } catch (e) {
      if (/No fue posible conectar con la API|HTTP 401|HTTP 502|HTTP 503|HTTP 504|Timeout/i.test(e.message || '')) {
        setStudents(FALLBACK_EXPEDIENTES)
        setDataError('')
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

  const fetchAuditLogs = useCallback(async token => {
    if (!token || (token || '').startsWith('contingency-token')) {
      setBackendAuditLogs([])
      return
    }

    try {
      setAuditLoading(true)
      setAuditError('')
      const raw = await apiRequest('/Audit', { method: 'GET', token })
      const normalized = normalizeAuditCollection(raw, 'backend')
      setBackendAuditLogs(normalized)
    } catch (error) {
      setAuditError(error?.message || 'No fue posible sincronizar la auditoria del backend.')
      setBackendAuditLogs([])
    } finally {
      setAuditLoading(false)
    }
  }, [])

  const seedAnalysisDrafts = useCallback(applications => {
    setAnalysisDrafts(prev => {
      const next = {}
      for (const application of applications || []) {
        next[application.id] = prev[application.id] || {
          financialAnalysisCompleted: Boolean(application.financialAnalysisCompleted),
          secondaryStudiesVerificationCompleted: Boolean(application.secondaryStudiesVerificationCompleted),
        }
      }
      return next
    })
  }, [])

  const fetchStudentScholarshipApplications = useCallback(async token => {
    if ((token || '').startsWith('contingency-token')) {
      setStudentScholarshipApplications([])
      setScholarshipError(`El módulo de becas requiere backend disponible para registrar la trazabilidad y la notificación a ${TRACEABILITY_EMAIL}.`)
      return
    }

    try {
      setScholarshipLoading(true)
      setScholarshipError('')
      const raw = await apiRequest('/ScholarshipApplications/mine', { method: 'GET', token })
      setStudentScholarshipApplications(Array.isArray(raw) ? raw : [])
    } catch (error) {
      setStudentScholarshipApplications([])
      setScholarshipError(error?.message || 'No fue posible cargar tus solicitudes de beca.')
    } finally {
      setScholarshipLoading(false)
    }
  }, [])

  const fetchScholarshipQueues = useCallback(async token => {
    if ((token || '').startsWith('contingency-token')) {
      setPendingScholarshipApplications([])
      setEconomicScholarshipApplications([])
      setScholarshipError(`La bandeja de becas requiere backend disponible para conservar la trazabilidad nominal hacia ${TRACEABILITY_EMAIL}.`)
      return
    }

    try {
      setScholarshipLoading(true)
      setScholarshipError('')
      const [pending, economicAnalysis] = await Promise.all([
        apiRequest('/ScholarshipApplications/pending', { method: 'GET', token }),
        apiRequest('/ScholarshipApplications/economic-analysis', { method: 'GET', token }),
      ])
      const pendingRows = Array.isArray(pending) ? pending : []
      const economicRows = Array.isArray(economicAnalysis) ? economicAnalysis : []
      setPendingScholarshipApplications(pendingRows)
      setEconomicScholarshipApplications(economicRows)
      seedAnalysisDrafts(economicRows)
    } catch (error) {
      setPendingScholarshipApplications([])
      setEconomicScholarshipApplications([])
      setScholarshipError(error?.message || 'No fue posible cargar la bandeja de becas.')
    } finally {
      setScholarshipLoading(false)
    }
  }, [seedAnalysisDrafts])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const serializedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (!serializedSession) return

      const parsedSession = JSON.parse(serializedSession)
      const persistedToken = (parsedSession?.token || '').trim()
      const persistedRole = normalizeRoleForUi(parsedSession?.role || '')
      const persistedTab = (parsedSession?.activeTab || '').trim()
      const persistedAuditUser = (parsedSession?.sessionAuditUser || '').trim()

      if (!persistedToken || persistedToken.startsWith('contingency-token') || isJwtExpired(persistedToken)) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
        return
      }

      if (!isKnownRole(persistedRole)) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
        return
      }

      setAuthToken(persistedToken)
      setIsAuthenticated(true)
      setActiveRole(persistedRole)
      setActiveTab(resolveTabForRole(persistedTab, persistedRole))
      setSessionAuditUser(resolveAuditUserFromToken(persistedToken, persistedRole, persistedAuditUser))
      setContingencyMode(false)
    } catch {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!isAuthenticated || !authToken || contingencyMode || authToken.startsWith('contingency-token')) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }

    if (isJwtExpired(authToken)) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
      setIsAuthenticated(false)
      setAuthToken('')
      setActiveRole(ROLES[0])
      setActiveTab(TAB_INICIO)
      setSessionAuditUser('')
      setLoginError('La sesión expiró. Inicia sesión nuevamente.')
      return
    }

    const normalizedRole = normalizeRoleForUi(activeRole)
    if (!isKnownRole(normalizedRole)) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }

    const safeTab = resolveTabForRole(activeTab, normalizedRole)
    const payload = {
      token: authToken,
      role: normalizedRole,
      activeTab: safeTab,
      sessionAuditUser,
      savedAtUtc: new Date().toISOString(),
    }

    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }, [isAuthenticated, authToken, activeRole, activeTab, sessionAuditUser, contingencyMode])

  useEffect(() => {
    if (!isAuthenticated || !authToken) return

    if (authToken.startsWith('contingency-token') && canBackoffice(activeRole)) {
      if (students.length === 0) {
        setStudents(FALLBACK_EXPEDIENTES)
      }
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

  useEffect(() => {
    if (!isAuthenticated || !authToken || !canBackoffice(activeRole)) return
    fetchAuditLogs(authToken)
  }, [isAuthenticated, authToken, activeRole, fetchAuditLogs])

  useEffect(() => {
    if (activeTab !== TAB_AUDITORIA || !isAuthenticated || !authToken || !canBackoffice(activeRole)) return
    fetchAuditLogs(authToken)
  }, [activeTab, isAuthenticated, authToken, activeRole, fetchAuditLogs])

  useEffect(() => () => {
    if (selectedDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(selectedDocumentPreviewUrlRef.current)
      selectedDocumentPreviewUrlRef.current = ''
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !authToken) return

    if (activeRole === 'Estudiante') {
      fetchStudentScholarshipApplications(authToken)
      return
    }

    if (canBackoffice(activeRole)) {
      fetchScholarshipQueues(authToken)
    }
  }, [isAuthenticated, authToken, activeRole, fetchStudentScholarshipApplications, fetchScholarshipQueues])

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
      if (loginForm.rol === 'Analista MESCYT/MINERD' && !usuario.endsWith('@minerd.gob.do') && !usuario.endsWith('@mescyt.gob.do')) {
        setLoginError('Para Analista MESCYT/MINERD el correo debe terminar en @minerd.gob.do o @mescyt.gob.do.')
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
        let timeoutId
        try {
          return await Promise.race([
            requestPromise,
            new Promise((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(new Error('No fue posible conectar con la API. Verifica que el backend configurado esté activo y respondiendo (health endpoint).'))
              }, AUTH_REQUEST_TIMEOUT_MS)
            }),
          ])
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
        }
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
        const analystRole = loginForm.rol === 'Analista MESCYT/MINERD'
          ? (usuario.endsWith('@minerd.gob.do') ? 'Analista MINERD' : 'Analista MESCYT')
          : loginForm.rol

        response = await authRequestWithTimeout(apiRequest('/Auth/login/analista', {
          method: 'POST',
          body: {
            rol: analystRole,
            correoInstitucional: usuario,
            password: contrasena,
          },
        }))
      }

      if (!response?.token) {
        throw new Error('No se recibió token de autenticación.')
      }

      const rol = normalizeRoleForUi(response.rol || loginForm.rol)
      if (!isKnownRole(rol)) {
        throw new Error('El servidor devolvió un rol no reconocido. Vuelve a iniciar sesión.')
      }
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
          setActiveRole(normalizeRoleForUi(loginForm.rol))
          setSessionAuditUser(usuario)
          setActiveTab(TAB_INICIO)
          setContingencyMode(true)
          setStudents(FALLBACK_EXPEDIENTES)
          setDataError('Backend no disponible. Sesión iniciada en modo contingencia con datos locales.')
          pushAudit('SESION_INICIO', `Inicio de sesión en contingencia para ${usuario} (${loginForm.rol})`, loginForm.rol, usuario)
          return
        }
      }

      setAuthToken('')
      setIsAuthenticated(false)
      setActiveRole(ROLES[0])
      setActiveTab(TAB_INICIO)
      setContingencyMode(false)

      setLoginError(message)
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }

    setIsAuthenticated(false)
    setLoginForm({ usuario: '', contrasena: '', rol: ROLES[0] })
    setLoginError('')
    setAuthToken('')
    setSessionAuditUser('')
    setContingencyMode(false)
    setStudents([])
    setStudentProfileData(null)
    setAuditLogs([])
    setBackendAuditLogs([])
    setAuditLoading(false)
    setAuditError('')
    setAdminUsers([])
    setScholarshipForm(emptyScholarshipForm)
    setScholarshipFormError('')
    setScholarshipSuccess('')
    setStudentScholarshipApplications([])
    setPendingScholarshipApplications([])
    setEconomicScholarshipApplications([])
    setScholarshipLoading(false)
    setScholarshipError('')
    setScholarshipActionId('')
    setAnalystScholarshipTab(ANALYST_REVIEW_GENERAL)
    setScholarshipValidationAttempted(false)
    setAnalysisDrafts({})
    setRejectionModal({ open: false, application: null, reason: '', error: '' })
    setScholarshipFilters({ cedula: '', destinationCountry: 'Todos', foreignUniversity: 'Todas' })
    closeDocumentPreview()
    setUsersError('')
    setUserForm(emptyUserForm)
    setEditingUserId(null)
    setUserFormError('')
    setUserSuccess('')
    setActiveTab(TAB_INICIO)
    cancelEdit()
  }

  const handleScholarshipFormChange = e => {
    const { name, value } = e.target
    setScholarshipForm(prev => {
      if (name === 'scholarshipType' && value !== 'Internacional') {
        return {
          ...prev,
          [name]: value,
          destinationCountry: '',
          foreignUniversity: '',
          internationalCoverageType: '',
          languageOrAdmissionRequirement: '',
        }
      }

      if (name === 'destinationCountry') {
        return {
          ...prev,
          destinationCountry: value,
          foreignUniversity: '',
          careerName: prev.scholarshipType === 'Internacional' ? '' : prev.careerName,
          internationalCoverageType: '',
          languageOrAdmissionRequirement: '',
        }
      }

      const next = { ...prev, [name]: value }

      if (next.scholarshipType === 'Internacional') {
        const match = VERIFIED_INTERNATIONAL_AGREEMENTS.find(agreement =>
          agreement.country === (next.destinationCountry || '').trim()
          && agreement.foreignUniversity === (next.foreignUniversity || '').trim()
          && agreement.programs.includes((next.careerName || '').trim()),
        )

        if (match) {
          next.institutionName = match.institutionName
          next.internationalCoverageType = match.coverageType
          next.languageOrAdmissionRequirement = match.languageOrAdmissionRequirement
        }
      }

      return next
    })
    setScholarshipFormError('')
  }

  const prefillScholarshipForm = beca => {
    const isInternational = (beca?.modalidad || '').toLowerCase() === 'internacional'
    setScholarshipForm({
      scholarshipName: beca?.nombre || '',
      scholarshipType: isInternational ? 'Internacional' : 'Nacional',
      institutionName: beca?.entidad || '',
      careerName: beca?.carreraPrograma || scholarshipForm.careerName || '',
      destinationCountry: isInternational ? (beca?.destinoPais || '') : '',
      foreignUniversity: isInternational ? (beca?.universidadExtranjera || '') : '',
      internationalCoverageType: isInternational ? (beca?.tipoCobertura || '') : '',
      languageOrAdmissionRequirement: isInternational ? (beca?.requisitosIdiomaOAdmision || '') : '',
      studentComment: '',
    })
    setScholarshipValidationAttempted(false)
    setScholarshipFormError('')
    setScholarshipSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const refreshScholarshipData = useCallback(async () => {
    if (!authToken) return
    if (activeRole === 'Estudiante') {
      await fetchStudentScholarshipApplications(authToken)
      return
    }
    if (canBackoffice(activeRole)) {
      await fetchScholarshipQueues(authToken)
    }
  }, [authToken, activeRole, fetchStudentScholarshipApplications, fetchScholarshipQueues])

  const handleScholarshipSubmit = async e => {
    e.preventDefault()
    setScholarshipValidationAttempted(true)
    if (!scholarshipValidation.isValid) {
      setScholarshipFormError(scholarshipValidation.firstError || 'Completa todos los campos obligatorios para continuar.')
      return
    }

    try {
      setScholarshipActionId('create-scholarship-request')
      setScholarshipFormError('')
      setScholarshipSuccess('')
      const resolvedScholarshipName = (scholarshipForm.scholarshipName || '').trim() || getAutoScholarshipName(scholarshipForm)
      const payload = {
        scholarshipName: scholarshipForm.scholarshipType === 'Internacional'
          ? `[Internacional] ${resolvedScholarshipName}`
          : resolvedScholarshipName,
        scholarshipType: scholarshipForm.scholarshipType,
        institutionName: scholarshipForm.institutionName.trim(),
        careerName: scholarshipForm.careerName.trim(),
        destinationCountry: scholarshipForm.destinationCountry.trim(),
        foreignUniversity: scholarshipForm.foreignUniversity.trim(),
        internationalCoverageType: scholarshipForm.internationalCoverageType.trim(),
        languageOrAdmissionRequirement: scholarshipForm.languageOrAdmissionRequirement.trim(),
        studentComment: buildScholarshipCommentPayload(scholarshipForm, sessionAuditUser),
      }
      const created = await apiRequest('/ScholarshipApplications', { method: 'POST', token: authToken, body: payload })
      setScholarshipForm(emptyScholarshipForm)
      setScholarshipValidationAttempted(false)
      setScholarshipSuccess(`Solicitud enviada con estado ${created?.status || 'Pendiente'} y notificación visual dirigida a ${TRACEABILITY_EMAIL}.`)
      pushAudit(
        'CREAR_SOLICITUD_BECA',
        `Estudiante solicitó la beca "${payload.scholarshipName}". Notificación y trazabilidad nominal: ${TRACEABILITY_EMAIL}.`,
        activeRole,
        sessionAuditUser,
      )
      await refreshScholarshipData()
    } catch (error) {
      setScholarshipFormError(error?.message || 'No se pudo registrar la solicitud de beca.')
    } finally {
      setScholarshipActionId('')
    }
  }

  const handleApproveScholarship = async application => {
    if (!application?.id || scholarshipActionId) return

    try {
      const details = getInternationalDetailsFromApplication(application)
      const criteriaSuffix = details.isInternational
        ? ` Criterios validados [Internacional]: Pais=${details.country || 'No informado'}; Universidad=${details.university || 'No informada'}; Cobertura=${details.coverage || 'No informada'}; Idioma/Admision=${details.languageOrAdmission || 'No informado'}.`
        : ' Criterios validados: modalidad nacional.'
      setScholarshipActionId(`approve-${application.id}`)
      setScholarshipSuccess('')
      setScholarshipError('')
      await apiRequest(`/ScholarshipApplications/${application.id}/approve`, { method: 'POST', token: authToken })
      pushAudit(
        'APROBAR_SOLICITUD_BECA',
        `Solicitud #${application.id} aprobada y enviada a análisis económico.${criteriaSuffix}`,
        activeRole,
        sessionAuditUser,
      )
      await refreshScholarshipData()
      await fetchAuditLogs(authToken)
      setScholarshipSuccess(`Solicitud #${application.id} aprobada. Nueva fase: En Análisis Económico.`)
    } catch (error) {
      setScholarshipError(error?.message || 'No se pudo aprobar la solicitud.')
    } finally {
      setScholarshipActionId('')
    }
  }

  const openRejectScholarshipModal = application => {
    setRejectionModal({ open: true, application, reason: '', error: '' })
  }

  const closeRejectScholarshipModal = () => {
    setRejectionModal({ open: false, application: null, reason: '', error: '' })
  }

  const handleRejectScholarship = async e => {
    e.preventDefault()
    const reason = (rejectionModal.reason || '').trim()
    if (reason.length < 5) {
      setRejectionModal(prev => ({ ...prev, error: 'Debes registrar un motivo de rechazo válido.' }))
      return
    }

    try {
      const applicationId = rejectionModal.application?.id
      const details = getInternationalDetailsFromApplication(rejectionModal.application)
      const criteriaSuffix = details.isInternational
        ? ` Criterios validados [Internacional]: Pais=${details.country || 'No informado'}; Universidad=${details.university || 'No informada'}; Cobertura=${details.coverage || 'No informada'}; Idioma/Admision=${details.languageOrAdmission || 'No informado'}.`
        : ' Criterios validados: modalidad nacional.'
      if (!applicationId) return
      setScholarshipActionId(`reject-${applicationId}`)
      setScholarshipError('')
      await apiRequest(`/ScholarshipApplications/${applicationId}/reject`, {
        method: 'POST',
        token: authToken,
        body: { rejectionReason: reason },
      })
      pushAudit(
        'RECHAZAR_SOLICITUD_BECA',
        `Solicitud #${applicationId} rechazada. Motivo: ${reason}.${criteriaSuffix}`,
        activeRole,
        sessionAuditUser,
      )
      closeRejectScholarshipModal()
      await refreshScholarshipData()
      await fetchAuditLogs(authToken)
      setScholarshipSuccess(`Solicitud #${applicationId} rechazada y motivo almacenado en el historial.`)
    } catch (error) {
      setRejectionModal(prev => ({ ...prev, error: error?.message || 'No se pudo rechazar la solicitud.' }))
    } finally {
      setScholarshipActionId('')
    }
  }

  const handleAnalysisDraftChange = (applicationId, field, checked) => {
    setAnalysisDrafts(prev => ({
      ...prev,
      [applicationId]: {
        financialAnalysisCompleted: prev[applicationId]?.financialAnalysisCompleted || false,
        secondaryStudiesVerificationCompleted: prev[applicationId]?.secondaryStudiesVerificationCompleted || false,
        [field]: checked,
      },
    }))
  }

  const handleCompleteEconomicAnalysis = async application => {
    if (!application?.id || scholarshipActionId) return

    const draft = analysisDrafts[application.id] || {
      financialAnalysisCompleted: false,
      secondaryStudiesVerificationCompleted: false,
    }

    if (!draft.financialAnalysisCompleted || !draft.secondaryStudiesVerificationCompleted) {
      setScholarshipError('Debes marcar ambas verificaciones antes de finalizar la solicitud.')
      return
    }

    try {
      const details = getInternationalDetailsFromApplication(application)
      const criteriaSuffix = details.isInternational
        ? ` Criterios validados [Internacional]: Pais=${details.country || 'No informado'}; Universidad=${details.university || 'No informada'}; Cobertura=${details.coverage || 'No informada'}; Idioma/Admision=${details.languageOrAdmission || 'No informado'}.`
        : ' Criterios validados: modalidad nacional.'
      setScholarshipActionId(`complete-${application.id}`)
      setScholarshipError('')
      await apiRequest(`/ScholarshipApplications/${application.id}/complete-economic-analysis`, {
        method: 'POST',
        token: authToken,
        body: draft,
      })
      pushAudit(
        'COMPLETAR_SOLICITUD_BECA',
        `Solicitud #${application.id} completada con análisis financiero y verificación escolar.${criteriaSuffix}`,
        activeRole,
        sessionAuditUser,
      )
      await refreshScholarshipData()
      await fetchAuditLogs(authToken)
      setScholarshipSuccess(`Solicitud #${application.id} completada correctamente.`)
    } catch (error) {
      setScholarshipError(error?.message || 'No se pudo finalizar la solicitud.')
    } finally {
      setScholarshipActionId('')
    }
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
    if (mergedAuditLogs.length === 0) throw new Error('No hay eventos de auditoria para exportar.')

    const rows = mergedAuditLogs.map(item => ({
      FechaHora: fmt(item.fecha),
      Usuario: item.usuario || '—',
      Rol: item.rol || activeRole,
      Accion: item.accion || '—',
      Detalles: item.detalles || '—',
      Fuente: item.source === 'backend' ? 'Backend' : 'Sesion',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria')
    XLSX.writeFile(workbook, `edumetrics-auditoria-${fileTimestamp()}.xlsx`)
  }

  const exportAuditoriaPdf = async () => {
    if (mergedAuditLogs.length === 0) throw new Error('No hay eventos de auditoria para exportar.')

    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('EDUMETRICS-DR - Registro de Auditoria', 14, 14)
    doc.setFontSize(9)
    doc.text(`Fecha de exportacion: ${exportDateLabel()}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Fecha y Hora', 'Usuario', 'Rol', 'Accion', 'Detalles', 'Fuente']],
      body: mergedAuditLogs.map(item => [
        fmt(item.fecha),
        item.usuario || '—',
        item.rol || activeRole,
        item.accion || '—',
        item.detalles || '—',
        item.source === 'backend' ? 'Backend' : 'Sesion',
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
      <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-2">
        <section className="relative overflow-hidden bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-900 p-8 text-white sm:p-10 lg:flex lg:flex-col lg:justify-between lg:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-cyan-300 blur-3xl" />
            <div className="absolute right-4 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-blue-400 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur-sm">E</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">EDUMETRICS-DR</h1>
            <p className="mt-3 max-w-md text-sm text-blue-100 sm:text-base">
              Plataforma oficial de gestión educativa y trazabilidad de becas del ecosistema institucional MINERD/MESCYT.
            </p>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 text-sm text-blue-100 sm:max-w-md">
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">Postulación simplificada a becas nacionales e internacionales del MESCYT y MINERD.</div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">Exploración directa por universidad, carreras y pensums oficiales.</div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">Trazabilidad en tiempo real del estado de tus solicitudes.</div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-50 p-4 sm:p-8 lg:p-12">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-8">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-slate-800">Acceso a la plataforma</h2>
              <p className="mt-1 text-sm text-slate-500">Inicia sesión con tus credenciales autorizadas.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Rol de acceso</label>
                <select
                  name="rol"
                  value={loginForm.rol}
                  onChange={handleLoginChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-all duration-200 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-100"
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
                      placeholder={loginForm.rol === 'Analista MESCYT/MINERD'
                        ? 'usuario@minerd.gob.do o usuario@mescyt.gob.do'
                        : 'admin@edumetrics.gob.do'}
                      autoComplete="username"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
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
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
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
                className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 ${
                  esEstudiante
                    ? 'bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400'
                    : 'bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400'
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
        </section>
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

        {scholarshipSuccess && (
          <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 flex items-center justify-between">
            <span>✓ {scholarshipSuccess}</span>
            <button type="button" onClick={() => setScholarshipSuccess('')} className="ml-4 font-bold text-emerald-600 hover:text-emerald-800">✕</button>
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
                  : activeRole === 'Analista MESCYT/MINERD'
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
              <code className="rounded bg-slate-200 px-2 py-0.5 text-xs break-all">{API_BASE_CANDIDATES[0] || 'http://localhost:5123/api'}/AllExampleData</code>
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
                  {mergedAuditLogs.length} evento{mergedAuditLogs.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  disabled={exporting !== '' || mergedAuditLogs.length === 0}
                  onClick={() => runExport('auditoria-excel', exportAuditoriaExcel)}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                >
                  {exporting === 'auditoria-excel' && <InlineSpinner />}
                  Excel
                </button>
                <button
                  type="button"
                  disabled={exporting !== '' || mergedAuditLogs.length === 0}
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
                <button
                  type="button"
                  disabled={auditLoading}
                  onClick={() => fetchAuditLogs(authToken)}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 disabled:opacity-50"
                >
                  {auditLoading && <InlineSpinner />}
                  Sincronizar backend
                </button>
              </div>
            </div>
            {auditError && (
              <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{auditError}</p>
            )}
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
                  {mergedAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No hay eventos de auditoría disponibles.
                      </td>
                    </tr>
                  ) : (
                    mergedAuditLogs.map(log => {
                      const accionColor = {
                        SESION_INICIO: 'bg-blue-100 text-blue-800',
                        CREAR:         'bg-emerald-100 text-emerald-800',
                        ACTUALIZAR:    'bg-amber-100 text-amber-800',
                        ELIMINAR:      'bg-rose-100 text-rose-800',
                      }[log.accion] ?? 'bg-slate-200 text-slate-800'
                      const rowHighlight = SCHOLARSHIP_CRITICAL_AUDIT_ACTIONS.has(log.accion)
                        ? 'bg-amber-50/40'
                        : ''
                      return (
                        <tr key={log.id} className={`hover:bg-slate-50 border-b border-slate-100 transition-colors ${rowHighlight}`}>
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
                    placeholder={userForm.rol === 'Analista MESCYT/MINERD' ? 'usuario@minerd.gob.do o usuario@mescyt.gob.do' : 'admin@edumetrics.gob.do'}
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

        {activeTab === TAB_EVALUACION_BECAS && canBackoffice(activeRole) && (
          <section className="space-y-5">
            <div className={`${card} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Bandeja de Evaluación de Becas</h2>
                  <p className="text-sm text-slate-500">
                    Revisión de solicitudes pendientes, fase de análisis económico y trazabilidad nominal vinculada a {TRACEABILITY_EMAIL}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                    Pendientes: {filteredPendingScholarshipApplications.length}
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-800">
                    En Análisis: {filteredEconomicScholarshipApplications.length}
                  </span>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 font-semibold text-cyan-800">
                    Filtrados: {filteredAnalystApplications.length} de {analystScholarshipApplications.length}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[ANALYST_REVIEW_GENERAL, ANALYST_REVIEW_DOCUMENTS, ANALYST_REVIEW_CRITERIA].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setAnalystScholarshipTab(tab)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${analystScholarshipTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                  Buscar por cédula
                  <input
                    name="cedula"
                    value={scholarshipFilters.cedula}
                    onChange={handleScholarshipFilterChange}
                    placeholder="00100000011"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 focus:border-cyan-500 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                  País de destino
                  <select
                    name="destinationCountry"
                    value={scholarshipFilters.destinationCountry}
                    onChange={handleScholarshipFilterChange}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Todos">Todos</option>
                    {analystFilterCountryOptions.map(country => (
                      <option key={`country-filter-${country}`} value={country}>{country}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                  Universidad extranjera
                  <select
                    name="foreignUniversity"
                    value={scholarshipFilters.foreignUniversity}
                    onChange={handleScholarshipFilterChange}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Todas">Todas</option>
                    {analystFilterUniversityOptions.map(university => (
                      <option key={`university-filter-${university}`} value={university}>{university}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={resetScholarshipFilters}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>
            </div>

            {scholarshipError && (
              <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{scholarshipError}</p>
            )}

            {analystScholarshipTab === ANALYST_REVIEW_DOCUMENTS && (
              <div className={`${card} p-5 space-y-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-800">Validación Documental</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Expedientes: {filteredAnalystApplications.length}</span>
                </div>

                {filteredAnalystApplications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                    No hay expedientes de becas para revisión documental.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                    {filteredAnalystApplications.map(application => {
                      const documents = getDocumentReviewRows(application)
                      return (
                        <article key={`doc-${application.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-semibold text-slate-800">{application.scholarshipName}</h4>
                              <p className="text-sm text-slate-500">{application.studentName} · {application.studentCedula}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getScholarshipStatusClasses(application.status)}`}>
                              {application.status}
                            </span>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="mb-2 text-sm font-semibold text-slate-700">Documentos digitalizados</p>
                            <div className="space-y-2 text-sm">
                              {documents.map(doc => {
                                const hasValue = Boolean((doc.value || '').trim())
                                return (
                                  <div key={`${application.id}-${doc.label}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                    <div>
                                      <span className="text-slate-700">{doc.label}</span>
                                      <p className="text-xs text-slate-500">Fuente institucional {doc.repositoryCode || 'DOC'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${hasValue ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                        {hasValue ? 'Disponible' : 'Pendiente'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => openDocumentPreview(application, doc)}
                                        disabled={!hasValue}
                                        className="rounded-full border border-cyan-300 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Ver
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                    </div>
                    <aside className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-800">Visor integrado de documentos</h4>
                        {selectedDocumentPreview && (
                          <button
                            type="button"
                            onClick={closeDocumentPreview}
                            className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
                          >
                            Cerrar visor
                          </button>
                        )}
                      </div>

                      {!selectedDocumentPreview ? (
                        <div className="flex min-h-[460px] items-center justify-center rounded-xl border border-dashed border-cyan-300 bg-white p-4 text-center text-sm text-slate-500">
                          Selecciona un documento disponible para previsualizarlo de forma nativa como PDF o imagen sin salir de la plataforma.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            <p><span className="font-semibold text-slate-700">Documento:</span> {selectedDocumentPreview.title}</p>
                            <p><span className="font-semibold text-slate-700">Expediente:</span> {selectedDocumentPreview.studentCedula}</p>
                            <p><span className="font-semibold text-slate-700">Analizado para:</span> {selectedDocumentPreview.studentName}</p>
                            <p><span className="font-semibold text-slate-700">Origen:</span> {selectedDocumentPreview.source}</p>
                          </div>

                          <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                            {selectedDocumentPreview.viewerType === 'image' ? (
                              <img src={selectedDocumentPreview.url} alt={selectedDocumentPreview.title} className="h-[620px] w-full object-contain bg-slate-100" />
                            ) : (
                              <iframe title={selectedDocumentPreview.title} src={selectedDocumentPreview.url} className="h-[620px] w-full" />
                            )}
                          </div>

                          <p className="text-xs text-slate-500">{selectedDocumentPreview.details}</p>
                        </div>
                      )}
                    </aside>
                  </div>
                )}
              </div>
            )}

            {analystScholarshipTab === ANALYST_REVIEW_CRITERIA && (
              <div className={`${card} p-5 space-y-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-800">Criterios Internacionales Detallados</h3>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">Casos internacionales: {filteredAnalystInternationalApplications.length}</span>
                </div>

                {filteredAnalystInternationalApplications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                    No hay solicitudes internacionales en la bandeja actual.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAnalystInternationalApplications.map(row => {
                      const { application, details } = row
                      const agreement = details.agreement
                      return (
                        <article key={`criteria-${application.id}`} className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h4 className="text-base font-semibold text-slate-800">{application.scholarshipName}</h4>
                              <p className="text-sm text-slate-600">{details.country || 'Pais no informado'} · {details.university || 'Universidad no informada'}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getScholarshipStatusClasses(application.status)}`}>{application.status}</span>
                          </div>
                          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                            <p><span className="font-semibold text-slate-800">Carrera:</span> {application.careerName || 'No especificada'}</p>
                            <p><span className="font-semibold text-slate-800">Indice minimo:</span> {agreement?.minAcademicIndex ?? 'No definido'}</p>
                            <p><span className="font-semibold text-slate-800">Idioma:</span> {agreement?.languageRequirements || details.languageOrAdmission || 'No definido'}</p>
                            <p><span className="font-semibold text-slate-800">Admision:</span> {agreement?.admissionRequirement || details.languageOrAdmission || 'No definida'}</p>
                            <p className="md:col-span-2"><span className="font-semibold text-slate-800">Matriz de cobertura:</span> {agreement?.coverageMatrix || details.coverage || 'No definida'}</p>
                            <p className="md:col-span-2"><span className="font-semibold text-slate-800">Documentacion normativa:</span> {(agreement?.requiredDocuments || []).join(', ') || 'No definida'}</p>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {analystScholarshipTab === ANALYST_REVIEW_GENERAL && (
              <>
            <div className={`${card} p-5 space-y-4`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-800">Solicitudes Pendientes</h3>
                {scholarshipLoading && <span className="inline-flex items-center gap-2 text-sm text-slate-500"><InlineSpinner /> Cargando bandeja…</span>}
              </div>

              {filteredPendingScholarshipApplications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  No hay solicitudes pendientes en este momento.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredPendingScholarshipApplications.map(application => (
                    <article key={application.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold text-slate-800">{application.scholarshipName}</h4>
                          <p className="text-sm text-slate-500">{application.institutionName}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getScholarshipStatusClasses(application.status)}`}>
                          {application.status}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p><span className="font-medium text-slate-700">Estudiante:</span> {application.studentName}</p>
                        <p><span className="font-medium text-slate-700">Cédula:</span> {application.studentCedula}</p>
                        <p><span className="font-medium text-slate-700">Carrera:</span> {application.careerName || 'No especificada'}</p>
                        <p><span className="font-medium text-slate-700">Solicitada:</span> {fmt(application.submittedAtUtc)}</p>
                        <p><span className="font-medium text-slate-700">Correo trazable:</span> {application.notificationEmail}</p>
                      </div>

                      {application.studentComment && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                          <p className="font-semibold text-slate-700">Comentario del estudiante</p>
                          <p className="mt-1">{application.studentComment}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={Boolean(scholarshipActionId)}
                          onClick={() => handleApproveScholarship(application)}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-emerald-400"
                        >
                          {scholarshipActionId === `approve-${application.id}` && <InlineSpinner className="border-white/50 border-t-white" />}
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(scholarshipActionId)}
                          onClick={() => openRejectScholarshipModal(application)}
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>

                      {application.history?.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-sm font-semibold text-slate-700">Historial</p>
                          <div className="space-y-2">
                            {application.history.map(historyItem => (
                              <div key={historyItem.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <strong className="text-slate-800">{getScholarshipHistoryActionLabel(historyItem.action)}</strong>
                                  <span className="text-xs text-slate-500">{fmt(historyItem.createdAtUtc)}</span>
                                </div>
                                <p className="mt-1">{historyItem.notes}</p>
                                <p className="mt-1 text-xs text-slate-500">Actor: {historyItem.actorRole} · Correo: {historyItem.actorEmail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className={`${card} p-5 space-y-4`}>
              <h3 className="text-base font-semibold text-slate-800">Fase de Análisis Económico</h3>

              {filteredEconomicScholarshipApplications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  No hay solicitudes en análisis económico.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredEconomicScholarshipApplications.map(application => {
                    const draft = analysisDrafts[application.id] || {
                      financialAnalysisCompleted: Boolean(application.financialAnalysisCompleted),
                      secondaryStudiesVerificationCompleted: Boolean(application.secondaryStudiesVerificationCompleted),
                    }

                    return (
                      <article key={application.id} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-semibold text-slate-800">{application.scholarshipName}</h4>
                            <p className="text-sm text-slate-500">{application.studentName} · {application.studentCedula}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getScholarshipStatusClasses(application.status)}`}>
                            {application.status}
                          </span>
                        </div>

                        <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-3">
                          <label className="flex items-start gap-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={draft.financialAnalysisCompleted}
                              onChange={e => handleAnalysisDraftChange(application.id, 'financialAnalysisCompleted', e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                            />
                            <span>Análisis financiero completado.</span>
                          </label>
                          <label className="flex items-start gap-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={draft.secondaryStudiesVerificationCompleted}
                              onChange={e => handleAnalysisDraftChange(application.id, 'secondaryStudiesVerificationCompleted', e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                            />
                            <span>Verificación de conclusión de estudios secundarios completada.</span>
                          </label>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                          <p><span className="font-medium text-slate-700">Carrera:</span> {application.careerName || 'No especificada'}</p>
                          <p><span className="font-medium text-slate-700">Correo trazable:</span> {application.notificationEmail}</p>
                          <p><span className="font-medium text-slate-700">Aprobada el:</span> {application.reviewedAtUtc ? fmt(application.reviewedAtUtc) : '—'}</p>
                        </div>

                        <button
                          type="button"
                          disabled={Boolean(scholarshipActionId) || !draft.financialAnalysisCompleted || !draft.secondaryStudiesVerificationCompleted}
                          onClick={() => handleCompleteEconomicAnalysis(application)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
                        >
                          {scholarshipActionId === `complete-${application.id}` && <InlineSpinner className="border-white/50 border-t-white" />}
                          Finalizar flujo
                        </button>

                        {application.history?.length > 0 && (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-sm font-semibold text-slate-700">Historial</p>
                            <div className="space-y-2">
                              {application.history.map(historyItem => (
                                <div key={historyItem.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <strong className="text-slate-800">{getScholarshipHistoryActionLabel(historyItem.action)}</strong>
                                    <span className="text-xs text-slate-500">{fmt(historyItem.createdAtUtc)}</span>
                                  </div>
                                  <p className="mt-1">{historyItem.notes}</p>
                                  <p className="mt-1 text-xs text-slate-500">Actor: {historyItem.actorRole} · Correo: {historyItem.actorEmail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
              </>
            )}
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
            <div className={`${card} p-5 space-y-4`}>
              <div>
                <h2 className="text-base font-semibold text-slate-800 mb-1">Oportunidades y Becas</h2>
                <p className="text-sm text-slate-500">
                  Análisis institucional consolidado para el perfil activo: estudiante universitario de pregrado. La priorización se orienta a becas nacionales e internacionales de educación superior, con una visión unificada de MESCYT/MINERD.
                </p>
              </div>

              <div className="space-y-3 text-sm text-slate-600">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Perfil activo del usuario</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Estudiante universitario de pregrado.</li>
                    <li>Prioridad de visualización: becas universitarias nacionales e internacionales.</li>
                    <li>Se omiten, en la vista principal, las oportunidades dirigidas a primaria y secundaria.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Unificación institucional</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Los programas de apoyo, excelencia y movilidad se presentan bajo la denominación institucional unificada: MESCYT/MINERD.</li>
                    <li>La lógica de atención prioriza la articulación entre políticas educativas nacionales, gestión académica y sostenibilidad del ingreso a la educación superior.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Clasificación por niveles educativos</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li><span className="font-medium text-slate-700">Primaria:</span> apoyo escolar, continuidad y acceso a servicios complementarios.</li>
                    <li><span className="font-medium text-slate-700">Secundaria:</span> permanencia, excelencia académica y apoyo a la transición a la educación superior.</li>
                    <li><span className="font-medium text-slate-700">Universitaria:</span> pregrado, técnico superior y postgrado, con énfasis en matrícula, permanencia, movilidad e investigación.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Oportunidades priorizadas para este perfil</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li><span className="font-medium text-slate-700">Nacionales:</span> becas de apoyo a la matrícula, excelencia académica, permanencia y movilidad institucional en universidades reguladas por MESCYT/MINERD.</li>
                    <li><span className="font-medium text-slate-700">Internacionales:</span> programas de movilidad estudiantil, becas de cooperación y apoyo académico para formación superior en contextos regionales e internacionales.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-800">TRAE</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>El servicio de transporte escolar del Sistema Nacional de Transporte Escolar (TRAE) corresponde exclusivamente a estudiantes de primaria y secundaria.</li>
                    <li>Para este perfil universitario, el transporte escolar oficial de la red TRAE no aplica y no debe considerarse como una alternativa de acceso.</li>
                  </ul>
                </div>
              </div>
            </div>
            {scholarshipError && (
              <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{scholarshipError}</p>
            )}
            <div className={`${card} p-5 space-y-4`}>
              <div>
                <h3 className="text-base font-semibold text-slate-800">Solicitar Beca</h3>
                <p className="text-sm text-slate-500">
                  Toda solicitud se registra con estado Pendiente y muestra una notificación visual al correo {TRACEABILITY_EMAIL}.
                </p>
              </div>

              <form onSubmit={handleScholarshipSubmit} className="grid gap-3 lg:grid-cols-2" noValidate>
                <label className="grid gap-1 lg:col-span-2">
                  <span className="text-sm text-slate-600">Modalidad de beca *</span>
                  <select
                    name="scholarshipType"
                    value={scholarshipForm.scholarshipType}
                    onChange={handleScholarshipFormChange}
                    aria-invalid={isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'scholarshipType')}
                    className={`rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none ${isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'scholarshipType') ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`}
                  >
                    <option value="Nacional">Nacional</option>
                    <option value="Internacional">Internacional</option>
                  </select>
                  {isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'scholarshipType') && (
                    <p className="text-xs text-rose-700">{scholarshipValidation.errors.scholarshipType}</p>
                  )}
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Institución de Educación Superior o entidad gestora *</span>
                  <select
                    name="institutionName"
                    value={scholarshipForm.institutionName}
                    onChange={handleScholarshipFormChange}
                    aria-invalid={isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'institutionName')}
                    className={`rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none ${isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'institutionName') ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`}
                  >
                    <option value="">Seleccione una IES</option>
                    {scholarshipForm.scholarshipType === 'Internacional' && <option value="MESCYT/MINERD">MESCYT/MINERD</option>}
                    <option value="UASD">UASD</option>
                    <option value="PUCMM">PUCMM</option>
                    <option value="ITLA">ITLA</option>
                    <option value="UNAPEC">UNAPEC</option>
                    <option value="UNPHU">UNPHU</option>
                    <option value="UTESA">UTESA</option>
                    <option value="ITSC">ITSC</option>
                    <option value="MESCYT/MINERD">MESCYT/MINERD</option>
                  </select>
                  {isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'institutionName') && (
                    <p className="text-xs text-rose-700">{scholarshipValidation.errors.institutionName}</p>
                  )}
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Carrera o programa *</span>
                  <select
                    name="careerName"
                    value={scholarshipForm.careerName}
                    onChange={handleScholarshipFormChange}
                    aria-invalid={isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'careerName')}
                    className={`rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none ${isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'careerName') ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`}
                  >
                    <option value="">Seleccione una carrera</option>
                    {scholarshipForm.scholarshipType === 'Internacional' ? (
                      internationalCareerOptions.map(career => (
                        <option key={career} value={career}>{career}</option>
                      ))
                    ) : (
                      <>
                        <option value="Ingeniería en Sistemas">Ingeniería en Sistemas</option>
                        <option value="Administración de Empresas">Administración de Empresas</option>
                        <option value="Contabilidad y Finanzas">Contabilidad y Finanzas</option>
                        <option value="Ingeniería Industrial">Ingeniería Industrial</option>
                        <option value="Derecho">Derecho</option>
                        <option value="Medicina">Medicina</option>
                        <option value="Psicología">Psicología</option>
                        <option value="Educación">Educación</option>
                      </>
                    )}
                  </select>
                  {isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'careerName') && (
                    <p className="text-xs text-rose-700">{scholarshipValidation.errors.careerName}</p>
                  )}
                </label>
                {scholarshipForm.scholarshipType === 'Internacional' && (
                  <>
                    <label className="grid gap-1">
                      <span className="text-sm text-slate-600">País de destino *</span>
                      <select
                        name="destinationCountry"
                        value={scholarshipForm.destinationCountry}
                        onChange={handleScholarshipFormChange}
                        aria-invalid={isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'destinationCountry')}
                        className={`rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none ${isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'destinationCountry') ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`}
                      >
                        <option value="">Seleccione país</option>
                        {internationalCountryOptions.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                      {isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'destinationCountry') && (
                        <p className="text-xs text-rose-700">{scholarshipValidation.errors.destinationCountry}</p>
                      )}
                    </label>
                    <label className="grid gap-1">
                      <span className="text-sm text-slate-600">Universidad extranjera *</span>
                      <select
                        name="foreignUniversity"
                        value={scholarshipForm.foreignUniversity}
                        onChange={handleScholarshipFormChange}
                        aria-invalid={isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'foreignUniversity')}
                        className={`rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none ${isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'foreignUniversity') ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`}
                      >
                        <option value="">Seleccione universidad extranjera</option>
                        {internationalUniversityOptions.map(university => (
                          <option key={university} value={university}>{university}</option>
                        ))}
                      </select>
                      {isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'foreignUniversity') && (
                        <p className="text-xs text-rose-700">{scholarshipValidation.errors.foreignUniversity}</p>
                      )}
                    </label>
                    <label className="grid gap-1 lg:col-span-2">
                      <span className="text-sm text-slate-600">Tipo de cobertura *</span>
                      <input
                        type="text"
                        name="internationalCoverageType"
                        value={scholarshipForm.internationalCoverageType}
                        onChange={handleScholarshipFormChange}
                        readOnly
                        aria-invalid={isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'internationalCoverageType')}
                        className={`rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none ${isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'internationalCoverageType') ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-slate-50'}`}
                        placeholder="Matrícula, estipendio de manutención, pasaje aéreo y seguro médico"
                      />
                      {isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'internationalCoverageType') && (
                        <p className="text-xs text-rose-700">{scholarshipValidation.errors.internationalCoverageType}</p>
                      )}
                    </label>
                    <label className="grid gap-1 lg:col-span-2">
                      <span className="text-sm text-slate-600">Requisitos de idioma/admisión *</span>
                      <input
                        type="text"
                        name="languageOrAdmissionRequirement"
                        value={scholarshipForm.languageOrAdmissionRequirement}
                        onChange={handleScholarshipFormChange}
                        readOnly
                        aria-invalid={isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'languageOrAdmissionRequirement')}
                        className={`rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none ${isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'languageOrAdmissionRequirement') ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-slate-50'}`}
                        placeholder="Ej: IELTS 6.5+ o carta de admisión"
                      />
                      {isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'languageOrAdmissionRequirement') && (
                        <p className="text-xs text-rose-700">{scholarshipValidation.errors.languageOrAdmissionRequirement}</p>
                      )}
                    </label>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 lg:col-span-2">
                      La validación documental se consulta automáticamente desde el repositorio institucional MESCYT/MINERD.
                    </div>
                  </>
                )}
                <label className="grid gap-1 lg:col-span-2">
                  <span className="text-sm text-slate-600">Comentario del estudiante *</span>
                  <textarea
                    name="studentComment"
                    rows="3"
                    value={scholarshipForm.studentComment}
                    onChange={handleScholarshipFormChange}
                    aria-invalid={isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'studentComment')}
                    className={`rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none ${isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'studentComment') ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`}
                    placeholder="Describe brevemente por qué solicitas la beca."
                  />
                  {isScholarshipFieldInvalid(scholarshipValidation, scholarshipForm, scholarshipValidationAttempted, 'studentComment') && (
                    <p className="text-xs text-rose-700">{scholarshipValidation.errors.studentComment}</p>
                  )}
                </label>
                <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
                  <button
                    type="submit"
                    disabled={scholarshipActionId === 'create-scholarship-request' || contingencyMode || !scholarshipValidation.isValid}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:bg-violet-400"
                  >
                    {scholarshipActionId === 'create-scholarship-request' && <InlineSpinner className="border-white/50 border-t-white" />}
                    Solicitar Beca
                  </button>
                  <span className="text-xs text-slate-500">Notificación visible: {TRACEABILITY_EMAIL}</span>
                  {!scholarshipValidation.isValid && (
                    <span className="text-xs text-rose-700">Completa todos los campos obligatorios para habilitar el envío.</span>
                  )}
                </div>
              </form>

              {scholarshipFormError && (
                <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{scholarshipFormError}</p>
              )}
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-800">Explorador institucional de becas</h3>
                <p className="mt-1 text-sm text-slate-500">Seleccione una institución para ver sus carreras, los programas de becas aplicables y el detalle curricular asociado.</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  { nombre: 'UASD', descripcion: 'Universidad Autónoma de Santo Domingo', color: 'border-rose-300 bg-rose-50', badge: 'bg-rose-100 text-rose-800' },
                  { nombre: 'PUCMM', descripcion: 'Pontificia Universidad Católica Madre y Maestra', color: 'border-indigo-300 bg-indigo-50', badge: 'bg-indigo-100 text-indigo-800' },
                  { nombre: 'ITLA', descripcion: 'Instituto Tecnológico de Las Américas', color: 'border-slate-300 bg-slate-100', badge: 'bg-slate-100 text-slate-800' },
                  { nombre: 'UNAPEC', descripcion: 'Universidad APEC', color: 'border-cyan-300 bg-cyan-50', badge: 'bg-cyan-100 text-cyan-800' },
                  { nombre: 'UNPHU', descripcion: 'Universidad Nacional Pedro Henríquez Ureña', color: 'border-lime-300 bg-lime-50', badge: 'bg-lime-100 text-lime-800' },
                  { nombre: 'UTESA', descripcion: 'Universidad Tecnológica de Santiago', color: 'border-orange-300 bg-orange-50', badge: 'bg-orange-100 text-orange-800' },
                  { nombre: 'ITSC', descripcion: 'Instituto Tecnológico Superior Comunitario', color: 'border-emerald-300 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800' },
                ].map(ies => {
                  const isOpen = scholarshipForm.institutionName?.toLowerCase().includes(ies.nombre.toLowerCase())
                  const institutionalScholarships = buildScholarshipCards(scholarshipForm.careerName, ies.nombre)
                    .filter(beca => beca.entidad === 'MESCYT/MINERD' || beca.entidad.toLowerCase().includes(ies.nombre.toLowerCase()))
                    .slice(0, 3)
                  return (
                    <div key={ies.nombre} className={`rounded-2xl border p-4 space-y-3 ${ies.color}`}>
                      <button
                        type="button"
                        onClick={() => setScholarshipForm(prev => ({ ...prev, institutionName: ies.nombre }))}
                        className="flex w-full items-start justify-between gap-2 text-left"
                      >
                        <div>
                          <h4 className="font-semibold text-slate-800">{ies.nombre}</h4>
                          <p className="mt-1 text-sm text-slate-600">{ies.descripcion}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${ies.badge}`}>Ver detalle</span>
                      </button>

                      {isOpen && (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                          <div>
                            <p className="font-semibold text-slate-800">Carreras y programas</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                              <li>Ingeniería en Sistemas</li>
                              <li>Administración de Empresas</li>
                              <li>Contabilidad y Finanzas</li>
                              <li>Ingeniería Industrial</li>
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">Becas MESCYT/MINERD aplicables</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                              <li>Excellence: 100% de matrícula o apoyo parcial según desempeño.</li>
                              <li>Permanencia: estipendio mensual y apoyo a matrícula.</li>
                              <li>Movilidad: apoyo complementario para intercambio académico.</li>
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">Pensum y estructura curricular</p>
                            <p className="mt-2">Disponible por programa con asignaturas, créditos y prerrequisitos según la oferta académica oficial de la IES.</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">Datos oficiales</p>
                            <p className="mt-2">Requisitos de admisión, recintos, modalidades y vigencia del programa gestionados por la institución y validados por MESCYT/MINERD.</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">Programas disponibles</p>
                            <div className="mt-2 space-y-2">
                              {institutionalScholarships.map(beca => (
                                <div key={`${ies.nombre}-${beca.nombre}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  <p className="text-xs font-medium text-slate-700">{beca.nombre}</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => prefillScholarshipForm(beca)}
                                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                                    >
                                      Solicitar esta beca
                                    </button>
                                    <a
                                      href={beca.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                      Más información
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {buildScholarshipCards(scholarshipForm.careerName, scholarshipForm.institutionName).map(beca => (
                  <article key={beca.nombre} className={`rounded-2xl border p-5 space-y-3 ${beca.color}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-800 leading-tight">{beca.nombre}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${beca.badge}`}>{beca.modalidad || 'Nacional'}</span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p><span className="font-medium text-slate-700">Institución:</span> {beca.entidad}</p>
                      <p><span className="font-medium text-slate-700">Monto:</span> {beca.monto}</p>
                      <p><span className="font-medium text-slate-700">Requisito:</span> {beca.requisito}</p>
                      {beca.modalidad === 'Internacional' && (
                        <>
                          <p><span className="font-medium text-slate-700">Fuente:</span> {beca.convenioOficial || 'Convenio oficial MESCYT/MINERD'}</p>
                          <p><span className="font-medium text-slate-700">País de destino:</span> {beca.destinoPais}</p>
                          <p><span className="font-medium text-slate-700">Universidad extranjera:</span> {beca.universidadExtranjera}</p>
                          <p><span className="font-medium text-slate-700">Cobertura:</span> {beca.tipoCobertura}</p>
                          <p><span className="font-medium text-slate-700">Idioma/Admisión:</span> {beca.requisitosIdiomaOAdmision}</p>
                        </>
                      )}
                      <p><span className="font-medium text-slate-700">Cierre:</span> {fmtDate(beca.cierre)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => prefillScholarshipForm(beca)}
                        className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                      >
                        Solicitar esta beca
                      </button>
                      <a href={beca.url} target="_blank" rel="noopener noreferrer"
                        className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                        Más información
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className={`${card} p-5 space-y-4`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-800">Mis Solicitudes</h3>
                {scholarshipLoading && <span className="inline-flex items-center gap-2 text-sm text-slate-500"><InlineSpinner /> Cargando…</span>}
              </div>

              {studentScholarshipApplications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  Aún no has registrado solicitudes de beca.
                </div>
              ) : (
                <div className="space-y-4">
                  {studentScholarshipApplications.map(application => (
                    <article key={application.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold text-slate-800">{application.scholarshipName}</h4>
                          <p className="text-sm text-slate-500">{application.institutionName}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getScholarshipStatusClasses(application.status)}`}>
                          {application.status}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p><span className="font-medium text-slate-700">Fecha de envío:</span> {fmt(application.submittedAtUtc)}</p>
                        <p><span className="font-medium text-slate-700">Carrera:</span> {application.careerName || 'No especificada'}</p>
                        <p><span className="font-medium text-slate-700">Correo notificado:</span> {application.notificationEmail}</p>
                      </div>

                      {application.rejectionReason && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                          <p className="font-semibold">Motivo de rechazo</p>
                          <p className="mt-1">{application.rejectionReason}</p>
                        </div>
                      )}

                      {application.history?.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-sm font-semibold text-slate-700">Historial de la solicitud</p>
                          <div className="space-y-2">
                            {application.history.map(historyItem => (
                              <div key={historyItem.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <strong className="text-slate-800">{getScholarshipHistoryActionLabel(historyItem.action)}</strong>
                                  <span className="text-xs text-slate-500">{fmt(historyItem.createdAtUtc)}</span>
                                </div>
                                <p className="mt-1">{historyItem.notes}</p>
                                <p className="mt-1 text-xs text-slate-500">Actor: {historyItem.actorRole} · Correo: {historyItem.actorEmail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-center text-slate-600 pb-2">
              La información de becas es referencial. Consulta los portales oficiales para datos actualizados.
            </p>
          </section>
        )}

        {rejectionModal.open && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/50 px-4 py-6">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Rechazar solicitud</h3>
                <p className="text-sm text-slate-500">
                  Debes registrar el motivo de rechazo para la solicitud #{rejectionModal.application?.id} y dejarlo visible en el historial.
                </p>
              </div>

              <form onSubmit={handleRejectScholarship} className="space-y-4">
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Motivo de Rechazo</span>
                  <textarea
                    value={rejectionModal.reason}
                    rows="4"
                    onChange={e => setRejectionModal(prev => ({ ...prev, reason: e.target.value, error: '' }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                    placeholder="Explica la razón del rechazo para fines de trazabilidad."
                  />
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  <p><span className="font-medium text-slate-700">Correo trazable:</span> {TRACEABILITY_EMAIL}</p>
                </div>

                {rejectionModal.error && (
                  <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{rejectionModal.error}</p>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={closeRejectScholarshipModal} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={Boolean(scholarshipActionId)} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:bg-rose-400">
                    {Boolean(scholarshipActionId) && <InlineSpinner className="border-white/50 border-t-white" />}
                    Confirmar rechazo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}