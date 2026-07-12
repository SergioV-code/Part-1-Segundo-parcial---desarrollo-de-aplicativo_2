import { MOD_ACADEMICA, MOD_TECNICO, card } from '../constants'
import { normalizeModalidad } from '../utils'

const FIELD_CLS = 'rounded-lg border px-3 py-2 text-sm w-full focus:outline-none'
const FIELD_OK  = 'border-slate-300 focus:border-teal-500'
const FIELD_ERR = 'border-rose-400 bg-rose-50 focus:border-rose-500'

export default function RegistroForm({ form, formError, editingId, submitting, roleColor, onChange, onSubmit, onCancel }) {
  const missing = field => !form[field]?.trim() && formError

  return (
    <div className={`${card} p-5`}>
      <h2 className="mb-4 text-base font-semibold text-slate-800">
        {editingId ? 'Actualizar expediente seleccionado' : 'Agregar nuevo expediente'}
      </h2>

      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Nombre */}
        <label className="grid gap-1">
          <span className="text-sm text-slate-600">
            Nombre completo <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            name="nombre"
            value={form.nombre}
            onChange={onChange}
            required
            placeholder="Maria Perez"
            className={`${FIELD_CLS} ${missing('nombre') ? FIELD_ERR : FIELD_OK}`}
          />
          {missing('nombre') && (
            <span className="text-xs text-rose-600">El nombre es obligatorio.</span>
          )}
        </label>

        {/* Cedula */}
        <label className="grid gap-1">
          <span className="text-sm text-slate-600">
            Cedula <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            name="cedula"
            value={form.cedula}
            onChange={onChange}
            required
            placeholder="000-0000000-0"
            className={`${FIELD_CLS} ${missing('cedula') ? FIELD_ERR : FIELD_OK}`}
          />
          {missing('cedula') && (
            <span className="text-xs text-rose-600">La cedula es obligatoria.</span>
          )}
        </label>

        {/* Centro educativo */}
        <label className="grid gap-1">
          <span className="text-sm text-slate-600">
            Centro educativo <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            name="centroEducativo"
            value={form.centroEducativo}
            onChange={onChange}
            required
            placeholder="Liceo Union Panamericana"
            className={`${FIELD_CLS} ${missing('centroEducativo') ? FIELD_ERR : FIELD_OK}`}
          />
          {missing('centroEducativo') && (
            <span className="text-xs text-rose-600">El centro educativo es obligatorio.</span>
          )}
        </label>

        {/* Modalidad */}
        <label className="grid gap-1">
          <span className="text-sm text-slate-600">Modalidad</span>
          <select
            name="modalidadAcademica"
            value={form.modalidadAcademica}
            onChange={onChange}
            className={`${FIELD_CLS} bg-white ${FIELD_OK}`}
          >
            <option value={MOD_ACADEMICA}>{MOD_ACADEMICA}</option>
            <option value={MOD_TECNICO}>{MOD_TECNICO}</option>
          </select>
        </label>

        {/* Error general */}
        {formError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 sm:col-span-2 lg:col-span-4">
            <span className="mt-0.5 text-rose-500">⚠</span>
            <p className="text-sm text-rose-700">{formError}</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          {editingId && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{ background: submitting ? '#94a3b8' : roleColor?.bg }}
            className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity"
          >
            {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar expediente'}
          </button>
        </div>
      </form>
    </div>
  )
}
