import { MOD_ACADEMICA, MOD_TECNICO } from '../constants'

export default function StatsCards({ kpis }) {
  return (
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
  )
}
