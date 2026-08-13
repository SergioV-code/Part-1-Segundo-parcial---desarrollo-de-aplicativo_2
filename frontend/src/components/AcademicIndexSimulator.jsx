import { useMemo, useState } from 'react'
import { calculateProjection } from './academicProjectionUtils'

const defaultSubjects = [
  { id: 1, name: 'Matemática', credits: 4, current: 86, target: 92 },
  { id: 2, name: 'Lengua Española', credits: 3, current: 90, target: 94 },
  { id: 3, name: 'Historia', credits: 3, current: 82, target: 88 },
  { id: 4, name: 'Física', credits: 4, current: 79, target: 85 },
  { id: 5, name: 'Inglés', credits: 2, current: 88, target: 91 },
]

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export default function AcademicIndexSimulator() {
  const [subjects, setSubjects] = useState(defaultSubjects)

  const projection = useMemo(() => calculateProjection(subjects), [subjects])

  const updateSubject = (id, field, value) => {
    setSubjects((current) =>
      current.map((subject) => {
        if (subject.id !== id) return subject

        const nextValue =
          field === 'name'
            ? value
            : clamp(Number(value) || 0, 0, 100)

        return {
          ...subject,
          [field]: nextValue,
        }
      })
    )
  }

  const addSubject = () => {
    setSubjects((current) => [
      ...current,
      {
        id: Date.now(),
        name: `Materia ${current.length + 1}`,
        credits: 3,
        current: 80,
        target: 85,
      },
    ])
  }

  const removeSubject = (id) => {
    setSubjects((current) =>
      current.length > 1 ? current.filter((subject) => subject.id !== id) : current
    )
  }

  const toneClasses = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            Proyección académica
          </p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">
            Simulador de índice académico
          </h3>
        </div>

        <button
          type="button"
          onClick={addSubject}
          className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          + Añadir materia
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Promedio actual
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {projection.currentAverage.toFixed(1)}
          </p>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-sky-700">
            Promedio proyectado
          </p>
          <p className="mt-2 text-3xl font-bold text-sky-800">
            {projection.projectedAverage.toFixed(1)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Cambio estimado
          </p>
          <p
            className={`mt-2 text-3xl font-bold ${
              projection.delta >= 0 ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {projection.delta >= 0 ? '+' : ''}
            {projection.delta.toFixed(1)}
          </p>
        </div>
      </div>

      <div
        className={`mt-5 inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${toneClasses[projection.tone]}`}
      >
        {projection.status}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_0.5fr] gap-2 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span>Materia</span>
          <span>Créditos</span>
          <span>Actual</span>
          <span>Objetivo</span>
          <span className="text-right">Acción</span>
        </div>

        <div className="divide-y divide-slate-200 bg-white">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_0.5fr] items-center gap-2 px-3 py-3"
            >
              <input
                type="text"
                value={subject.name}
                onChange={(e) => updateSubject(subject.id, 'name', e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
              />

              <input
                type="number"
                min="1"
                max="10"
                value={subject.credits}
                onChange={(e) => updateSubject(subject.id, 'credits', e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
              />

              <input
                type="number"
                min="0"
                max="100"
                value={subject.current}
                onChange={(e) => updateSubject(subject.id, 'current', e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
              />

              <input
                type="number"
                min="0"
                max="100"
                value={subject.target}
                onChange={(e) => updateSubject(subject.id, 'target', e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeSubject(subject.id)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">
          Resumen del escenario proyectado
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Con <span className="font-semibold text-slate-800">{subjects.length}</span> materias y{' '}
          <span className="font-semibold text-slate-800">{projection.totalCredits}</span> créditos activos,
          el promedio general puede pasar de{' '}
          <span className="font-semibold text-slate-800">{projection.currentAverage.toFixed(1)}</span> a{' '}
          <span className="font-semibold text-sky-700">{projection.projectedAverage.toFixed(1)}</span>.
          Este análisis es una simulación orientativa para la planificación académica.
        </p>
      </div>
    </section>
  )
}
