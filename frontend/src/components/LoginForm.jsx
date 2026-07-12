import { ROLES, pageStyle, card } from '../constants'

export default function LoginForm({ loginForm, loginError, onChange, onSubmit }) {
  const isEstudiante = loginForm.rol === 'Estudiante'

  return (
    <div style={pageStyle} className="flex min-h-screen items-center justify-center p-4">
      <div className={`${card} w-full max-w-md p-8`}>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white text-2xl font-bold">E</div>
          <h1 className="text-2xl font-bold text-slate-800">EDUMETRICS-DR</h1>
          <p className="mt-1 text-sm text-slate-500">Sistema Educativo Dominicano MINERD / MESCYT</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Rol siempre primero */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Rol de acceso</label>
            <select
              name="rol"
              value={loginForm.rol}
              onChange={onChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Campo cedula solo para Estudiante */}
          {isEstudiante ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cedula de identidad <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="usuario"
                value={loginForm.usuario}
                onChange={onChange}
                placeholder="000-0000000-0"
                required
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                  loginError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-violet-500'
                }`}
              />
              <p className="mt-1 text-xs text-slate-400">Ingresa tu cedula para acceder al portal estudiantil.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Usuario institucional <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="usuario"
                  value={loginForm.usuario}
                  onChange={onChange}
                  placeholder="usuario@minerd.gob.do"
                  required
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                    loginError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Contrasena <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="contrasena"
                  value={loginForm.contrasena}
                  onChange={onChange}
                  placeholder="••••••••"
                  required
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                    loginError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
              </div>
            </>
          )}

          {/* Error de validacion visual */}
          {loginError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2">
              <span className="mt-0.5 text-rose-500">⚠</span>
              <p className="text-sm text-rose-700">{loginError}</p>
            </div>
          )}

          <button
            type="submit"
            className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors ${
              isEstudiante ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-700 hover:bg-blue-800'
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
