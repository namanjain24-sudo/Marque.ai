// components/AppLayout.jsx — shared layout for app pages with slim left nav
import { BookOpen, ChartBar, House, MagnifyingGlass, SquaresFour, Clipboard } from '@phosphor-icons/react'
import { NavLink, Outlet } from 'react-router-dom'
import { Container } from './Container'
import { Logo } from './Logo'

const NAV_ITEMS = [
  { to: '/workspace', label: 'Workspace', Icon: SquaresFour },
  { to: '/campaigns', label: 'Campaigns', Icon: Clipboard },
  { to: '/library', label: 'Library', Icon: BookOpen },
  { to: '/brand', label: 'Brand', Icon: House },
  { to: '/audit', label: 'Audit', Icon: MagnifyingGlass },
]

function SideNavItem({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium transition-colors ${
          isActive
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
        }`
      }
    >
      <Icon size={17} weight="regular" />
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <Container className="flex h-14 items-center justify-between">
          <NavLink to="/" aria-label="Marque.ai home">
            <Logo />
          </NavLink>
          <div className="flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-500">
            <span className="hidden sm:inline">Drafts only. You approve everything.</span>
          </div>
        </Container>
      </header>

      <div className="flex flex-1">
        {/* Left sidebar */}
        <aside className="hidden w-52 shrink-0 border-r border-zinc-200 dark:border-zinc-800 lg:block">
          <nav className="sticky top-14 flex flex-col gap-0.5 p-3 pt-4">
            {NAV_ITEMS.map((item) => (
              <SideNavItem key={item.to} {...item} />
            ))}
          </nav>
        </aside>

        {/* Page content */}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
