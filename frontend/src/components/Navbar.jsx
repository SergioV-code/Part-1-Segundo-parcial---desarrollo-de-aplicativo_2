import { GOV_TABS, STU_TABS, ROL_COLORS } from '../constants'
import { isGov } from '../utils'

export default function Navbar({ activeRole, activeTab, setActiveTab, onLogout }) {
  const roleColor = ROL_COLORS[activeRole] || ROL_COLORS['Analista MINERD']
  const tabs = isGov(activeRole) ? GOV_TABS : STU_TABS

  return (
    <header style={{ background: roleColor.bg }} className="sticky top-0 z-10 shadow">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white font-bold">E</div>
          <span className="text-lg font-bold text-white">EDUMETRICS-DR</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${roleColor.badge}`}>{activeRole}</span>
        </div>

        <nav className="flex flex-wrap gap-1">
          {tabs.map(tab => (
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
          onClick={onLogout}
          className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-white hover:bg-white/15"
        >
          Cerrar sesion
        </button>
      </div>
    </header>
  )
}
