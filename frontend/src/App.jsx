import { useEffect, useMemo, useState } from 'react'

// ─── API ───────────────────────────────────────────────────────────────────────
const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const normalizedApiUrl = rawApiUrl.replace(/\/$/, '')
const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const API_BASE = normalizedApiUrl
  ? normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`
  : fallbackOrigin ? `${fallbackOrigin}/api` : '/api'

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const MOD_ACADEMICA = 'Modalidad Academica'
const MOD_TECNICO   = 'Modalidad Tecnico Profesional'

const TAB_INICIO     = 'Inicio'
const TAB_GESTION    = 'Gestion de Expedientes'
const TAB_FORMULARIO = 'Formulario de Registro'
const TAB_REPORTES   = 'Reportes Empresariales'
const TAB_AUDITORIA  = 'Registro de Auditoria'

const ROLES = ['Analista MINERD', 'Analista MESCYT', 'Estudiante']
const ROL_COLORS = {
  'Analista MINERD': { bg: '#1d4ed8', badge: 'bg-blue-100 text-blue-800' },
  'Analista MESCYT': { bg: '#0f766e', badge: 'bg-teal-100 text-teal-800' },
  'Estudiante':      { bg: '#7c3aed', badge: 'bg-violet-100 text-violet-800' },
}

const GOV_TABS = [TAB_INICIO, TAB_GESTION, TAB_FORMULARIO, TAB_REPORTES, TAB_AUDITORIA]

const TAB_PERFIL  = 'Mi Perfil'
const TAB_PENSUM  = 'Mi Pensum'
const TAB_BECAS   = 'Oportunidades y Becas'
const STU_TABS    = [TAB_PERFIL, TAB_PENSUM, TAB_BECAS]

const isGov = rol => rol === 'Analista MINERD' || rol === 'Analista MESCYT'

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

// ─── ESTILOS BASE ─────────────────────────────────────────────────────────────
const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(145deg,#f0f4ff 0%,#e8f4ff 50%,#f0fff8 100%)',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  color: '#0f172a',
}

const card = 'bg-white border border-slate-200 rounded-2xl shadow-sm'

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeRole, setActiveRole]           = useState(ROLES[0])
  const [loginForm, setLoginForm]             = useState({ usuario: '', contrasena: '', rol: ROLES[0] })
  const [loginError, setLoginError]           = useState('')

  const [activeTab, setActiveTab] = useState(TAB_INICIO)

  const [students,   setStudents]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [dataError,  setDataError]  = useState('')

  const emptyForm = { nombre: '', cedula: '', centroEducativo: '', modalidadAcademica: MOD_ACADEMICA }
  const [form,           setForm]           = useState(emptyForm)
  const [editingId,      setEditingId]      = useState(null)
  const [editingRecord,  setEditingRecord]  = useState(null)
  const [submitting,     setSubmitting]     = useState(false)
  const [formError,      setFormError]      = useState('')

  const [cedulaSearch,   setCedulaSearch]   = useState('')
  const [modFilter,      setModFilter]      = useState('Todos')
  const [deletingId,     setDeletingId]     = useState('')

  const [auditLogs, setAuditLogs] = useState([])

  const pushAudit = (accion, detalles) =>
    setAuditLogs(prev => [{
      id:      `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      fecha:   new Date().toISOString(),
      usuario: activeRole,
      accion,
      detalles,
    }, ...prev])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      setDataError('')
      // CORRECCIÓN: Se envía activeRole en lugar de 'Admin' hardcodeado
      const res = await fetch(`${API_BASE}/AllExampleData`, { 
        headers: { 'X-User-Role': activeRole } 
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      setStudents(Array.isArray(raw)
        ? raw.map(s => ({ ...s, modalidadAcademica: normalizeModalidad(s?.modalidadAcademica) }))
        : [])
    } catch (e) {
      setDataError(e.message || 'Error de conexion')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isAuthenticated && isGov(activeRole)) fetchStudents() }, [isAuthenticated, activeRole])

  const handleLoginChange = e => setLoginForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleLogin = e => {
    e.preventDefault()
    if (!loginForm.usuario.trim() || (!loginForm.contrasena.trim() && loginForm.rol !== 'Estudiante')) {
      setLoginError(loginForm.rol === 'Estudiante' ? 'Ingresa tu cedula para continuar.' : 'Ingresa usuario y contrasena para continuar.')
      return
    }
    setIsAuthenticated(true)
    setActiveRole(loginForm.rol)
    setActiveTab(isGov(loginForm.rol) ? TAB_INICIO : TAB_PERFIL)
    pushAudit('SESION_INICIO', `${loginForm.rol === 'Estudiante' ? 'Estudiante cedula' : 'Usuario'} ${loginForm.usuario.trim()} inicio sesion como ${loginForm.rol}`)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setLoginForm({ usuario: '', contrasena: '', rol: ROLES[0] })
    setLoginError('')
    setStudents([])
    setAuditLogs([])
    setActiveTab(TAB_INICIO)
  }

  const startEdit = student => {
    if (!isGov(activeRole)) return
    setEditingId(student.id)
    setEditingRecord(student)
    setForm({
      nombre:          student.nombre || '',
      cedula:          student.cedula || '',
      centroEducativo:   student.centroEducativo || '',
      modalidadAcademica: normalizeModalidad(student.modalidadAcademica),
    })
    setFormError('')
    setActiveTab(TAB_FORMULARIO)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingRecord(null)
    setForm(emptyForm)
    setFormError('')
  }

  const handleFormChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!isGov(activeRole)) return
    if (!form.nombre.trim() || !form.cedula.trim() || !form.centroEducativo.trim()) {
      setFormError('Nombre, Cedula y Centro Educativo son obligatorios.')
      return
    }
    try {
      setSubmitting(true)
      setFormError('')
      let res

      if (editingId) {
        const payload = {
          ...editingRecord,
          nombre:            form.nombre.trim(),
          cedula:            form.cedula.trim(),
          centroEducativo:   form.centroEducativo.trim(),
          modalidadAcademica: normalizeModalidad(form.modalidadAcademica),
          fechaActualizacion: new Date().toISOString(),
        }
        res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/ChangeExampleData/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-Role': activeRole },
          body: JSON.stringify(payload),
        })
        pushAudit('ACTUALIZAR', `Usuario [${activeRole}] modifico expediente cedula ${form.cedula.trim()}`)
      } else {
        const payload = {
          nombre:            form.nombre.trim(),
          cedula:            form.cedula.trim(),
          centroEducativo:   form.centroEducativo.trim(),
          modalidadAcademica: normalizeModalidad(form.modalidadAcademica),
          rne:               `RNE-${Date.now()}`,
        }
        res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/CreateExample`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Role': activeRole },
          body: JSON.stringify(payload),
        })
        pushAudit('CREAR', `Usuario [${activeRole}] creo registro para cedula ${form.cedula.trim()}`)
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      alert(editingId ? 'Expediente actualizado correctamente.' : 'Expediente registrado correctamente.')
      cancelEdit()
      await fetchStudents()
    } catch (e) {
      setFormError(e.message || 'No se pudo completar la operacion.')
      alert('Error: ' + (e.message || 'No se pudo completar la operacion.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async id => {
    if (!isGov(activeRole)) return
    if (!id || deletingId) return
    try {
      setDeletingId(id)
      const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/DeleteExample/${id}`, {
        method: 'DELETE',
        headers: { 'X-User-Role': activeRole },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      pushAudit('ELIMINAR', `Usuario [${activeRole}] elimino expediente id ${id}`)
      await fetchStudents()
    } catch (e) {
      alert('No se pudo eliminar: ' + (e.message || 'Error'))
    } finally {
      setDeletingId('')
    }
  }

  const kpis = useMemo(() => {
    const total = students.length
    const academica = students.filter(s => normalizeModalidad(s.modalidadAcademica) === MOD_ACADEMICA).length
    const tecnico   = students.filter(s => normalizeModalidad(s.modalidadAcademica) === MOD_TECNICO).length
    return { total, academica, tecnico,
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

  if (!isAuthenticated) {
    return (
      <div style={pageStyle} className="flex min-h-screen items-center justify-center p-4">
        <div className={`${card} w-full max-w-md p-8`}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white text-2xl font-bold">E</div>
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

            {loginForm.rol === 'Estudiante' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cedula de identidad</label>
                <input
                  type="text"
                  name="usuario"
                  value={loginForm.usuario}
                  onChange={handleLoginChange}
                  placeholder="000-0000000-0"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">Ingresa tu cedula para acceder al portal estudiantil.</p>
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
                    placeholder="usuario@minerd.gob.do"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Contrasena</label>
                  <input
                    type="password"
                    name="contrasena"
                    value={loginForm.contrasena}
                    onChange={handleLoginChange}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            {loginError && (
              <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loginError}</p>
            )}

            <button
              type="submit"
              className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white ${
                loginForm.rol === 'Estudiante' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              Iniciar sesion
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Acceso restringido. Gobierno y estudiantes autorizados.
          </p>
        </div>
      </div>
    )
  }

  const roleColor = ROL_COLORS[activeRole] || ROL_COLORS[ROLES[0]]

  return (
    <div style={pageStyle} className="min-h-screen">

      {/* ── NAVBAR ── */}
      <header style={{ background: roleColor.bg }} className="sticky top-0 z-10 shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white font-bold">E</div>
            <span className="text-lg font-bold text-white">EDUMETRICS-DR</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${roleColor.badge}`}>{activeRole}</span>
          </div>

          <nav className="flex flex-wrap gap-1">
            {(isGov(activeRole) ? GOV_TABS : STU_TABS).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={
                  activeTab === tab
                    ? 'rounded-md bg-white/25 px-3 py-1.5 text-sm font-semibold text-white'
                    : 'rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/15 hover:text-white'
                }
              >
                {tab}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-white hover:bg-white/15"
          >
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">

        {/* ── FORMULARIO (solo gubernamental) ── */}
        {isGov(activeRole) && (
          <div className={`${card} p-5`} style={{ display: activeTab === TAB_FORMULARIO ? 'block' : 'none' }}>
            <h2 className="mb-4 text-base font-semibold text-slate-800">
              {editingId ? 'Actualizar expediente seleccionado' : 'Agregar nuevo expediente'}
            </h2>
            <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Nombre completo</span>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Maria Perez"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Cedula</span>
                <input
                  type="text"
                  name="cedula"
                  value={form.cedula}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="000-0000000-0"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Centro educativo</span>
                <input
                  type="text"
                  name="centroEducativo"
                  value={form.centroEducativo}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Liceo Union Panamericana"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Modalidad</span>
                <select
                  name="modalidadAcademica"
                  value={form.modalidadAcademica}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value={MOD_ACADEMICA}>{MOD_ACADEMICA}</option>
                  <option value={MOD_TECNICO}>{MOD_TECNICO}</option>
                </select>
              </label>

              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={submitting}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: roleColor.bg }}
                  className="rounded-lg px-5 py-2 text-sm font-semibold text-white"
                >
                  {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar expediente'}
                </button>
              </div>
            </form>
            {formError && (
              <p className="mt-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
            )}
          </div>
        )}

        {/* ── VISTA: INICIO ── */}
        {activeTab === TAB_INICIO && isGov(activeRole) && (
          <section className={`${card} p-6 space-y-4`}>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Bienvenido, {activeRole}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeRole === 'Analista MINERD'
                  ? 'Panel de gestion de expedientes para centros educativos del nivel pre-universitario bajo MINERD.'
                  : 'Panel de gestion de egresados y matriculados regulados por MESCYT.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm font-semibold text-blue-700">Total expedientes</p>
                <strong className="mt-1 block text-4xl font-bold text-blue-900">{kpis.total}</strong>
              </article>
              <article className="rounded-xl border border-cyan-200 bg-cyan-50 p-5">
                <p className="text-sm font-semibold text-cyan-700">{MOD_ACADEMICA}</p>
                <strong className="mt-1 block text-4xl font-bold text-cyan-900">{kpis.academica}</strong>
              </article>
              <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-700">{MOD_TECNICO}</p>
                <strong className="mt-1 block text-4xl font-bold text-emerald-900">{kpis.tecnico}</strong>
              </article>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="mb-1 font-semibold text-slate-700">Fuente de datos segura:</p>
              <code className="rounded bg-slate-200 px-2 py-0.5 text-xs">{API_BASE}/AllExampleData</code>
            </div>
          </section>
        )}

        {/* ── VISTA: GESTION DE EXPEDIENTES ── */}
        {activeTab === TAB_GESTION && isGov(activeRole) && (
          <section className={`${card} p-5 space-y-4`}>
            <h2 className="text-base font-semibold text-slate-800">Gestion de Expedientes</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Buscar por cedula</span>
                <input
                  type="text"
                  value={cedulaSearch}
                  onChange={e => setCedulaSearch(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="000-0000000-0"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Filtrar por modalidad</span>
                <select
                  value={modFilter}
                  onChange={e => setModFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="Todos">Todos</option>
                  <option value={MOD_ACADEMICA}>{MOD_ACADEMICA}</option>
                  <option value={MOD_TECNICO}>{MOD_TECNICO}</option>
                </select>
              </label>
            </div>

            {loading && <p className="text-sm text-slate-500">Cargando expedientes...</p>}
            {dataError && <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">Error: {dataError}</p>}
            {!loading && !dataError && gestionRows.length === 0 && (
              <p className="text-sm text-slate-500">No se encontraron expedientes con los filtros aplicados.</p>
            )}

            {!loading && gestionRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Nombre', 'Cedula', 'Centro Educativo', 'Modalidad', 'Acciones'].map(h => (
                        <th key={h} className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gestionRows.map((student, idx) => (
                      <tr key={student.id ?? idx} className="hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3">{student.nombre ?? '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{student.cedula ?? '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{student.centroEducativo ?? '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            normalizeModalidad(student.modalidadAcademica) === MOD_TECNICO
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {normalizeModalidad(student.modalidadAcademica)}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => startEdit(student)}
                            disabled={!student.id || submitting}
                            className="mr-2 rounded-md border border-blue-400 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(student.id)}
                            disabled={!student.id || deletingId === student.id || submitting}
                            className="rounded-md border border-rose-400 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
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
        )}

        {/* ── VISTA: REPORTES EMPRESARIALES ── */}
        {activeTab === TAB_REPORTES && isGov(activeRole) && (
          <section className={`${card} p-5 space-y-5`}>
            <h2 className="text-base font-semibold text-slate-800">Reportes Empresariales</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase text-blue-600">Total expedientes</p>
                <strong className="mt-1 block text-3xl text-blue-900">{kpis.total}</strong>
              </article>
              <article className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-xs font-semibold uppercase text-cyan-600">{MOD_ACADEMICA}</p>
                <strong className="mt-1 block text-3xl text-cyan-900">{kpis.academica}</strong>
              </article>
              <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase text-emerald-600">{MOD_TECNICO}</p>
                <strong className="mt-1 block text-3xl text-emerald-900">{kpis.tecnico}</strong>
              </article>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Rendimiento de lineas educativas</p>

              <div>
                <div className="mb-1 flex justify-between text-sm text-slate-700">
                  <span>{MOD_ACADEMICA}</span>
                  <strong>{kpis.academica} estudiantes ({kpis.pctAcademica}%)</strong>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${kpis.pctAcademica}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-sm text-slate-700">
                  <span>{MOD_TECNICO}</span>
                  <strong>{kpis.tecnico} estudiantes ({kpis.pctTecnico}%)</strong>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${kpis.pctTecnico}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Distribucion de egresados por centro educativo</p>
              {byCentro.length === 0 && <p className="text-sm text-slate-500">Sin datos disponibles.</p>}
              {byCentro.map(item => (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-sm text-slate-700">
                    <span className="truncate pr-4">{item.label}</span>
                    <strong className="shrink-0">{item.count} ({item.pct}%)</strong>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-cyan-600 transition-all duration-500"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── VISTA: REGISTRO DE AUDITORIA ── */}
        {activeTab === TAB_AUDITORIA && isGov(activeRole) && (
          <section className={`${card} p-5 space-y-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Registro de Auditoria</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {auditLogs.length} eventos
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500">No hay eventos registrados en esta sesion.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Fecha</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Rol</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Accion</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{fmt(log.fecha)}</td>
                        <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-700">{log.usuario}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">{log.accion}</span>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">{log.detalles}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── VISTAS ESTUDIANTILES (Mi Perfil, Mi Pensum, Becas) ── */}
        {activeTab === TAB_PERFIL && !isGov(activeRole) && (
          <section className={`${card} p-6 space-y-4`}>
            <h2 className="text-xl font-bold text-slate-800">Mi Perfil Estudiantil</h2>
            <p className="text-sm text-slate-600">Cedula vinculada: <strong>{loginForm.usuario || 'No especificada'}</strong></p>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
              <p className="font-semibold">Estado de Matricula: Activo</p>
              <p className="mt-1 text-xs text-violet-700">Verificado en el sistema centralizado MESCYT / MINERD.</p>
            </div>
          </section>
        )}

        {activeTab === TAB_PENSUM && !isGov(activeRole) && (
          <section className={`${card} p-6 space-y-4`}>
            <h2 className="text-xl font-bold text-slate-800">Mi Pensum Academico</h2>
            <p className="text-sm text-slate-500">Consulta de asignaturas cursadas y plan de estudio vigente.</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>Plan de estudios cargado correctamente para el período actual.</p>
            </div>
          </section>
        )}

        {activeTab === TAB_BECAS && !isGov(activeRole) && (
          <section className={`${card} p-6 space-y-4`}>
            <h2 className="text-xl font-bold text-slate-800">Oportunidades y Becas</h2>
            <p className="text-sm text-slate-500">Programas de becas nacionales e internacionales disponibles.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="font-semibold text-blue-900">Becas Nacionales MESCYT</h3>
                <p className="mt-1 text-xs text-blue-700">Convocatoria abierta para estudiantes de excelencia.</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="font-semibold text-emerald-900">Programa de Ingles de Inmersion</h3>
                <p className="mt-1 text-xs text-emerald-700">Capacitacion en lenguas extranjeras.</p>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
