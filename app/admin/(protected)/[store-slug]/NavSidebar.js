'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Pizza, LayoutDashboard, ClipboardList, FolderOpen, Bike, BarChart2, Users, Wallet, Settings, Globe, TrendingUp, ListChecks } from 'lucide-react'

const ICONS = { LayoutDashboard, ClipboardList, Pizza, FolderOpen, Bike, BarChart2, Users, Wallet, Settings, Globe, TrendingUp, ListChecks }

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function NavSidebar({ storeName, userEmail, navItems, signOut }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Logo + Store name */}
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <Pizza className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate leading-tight">{storeName}</p>
            <p className="text-slate-500 text-xs">Painel Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = isActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? '_blank' : undefined}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                active
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
              }`}
            >
              {(() => { const Icon = ICONS[item.iconName]; return Icon ? <Icon className="w-4 h-4 shrink-0" /> : null })()}
              <span className="flex-1">{item.label}</span>
              {item.external && (
                <svg className="w-3 h-3 text-slate-600 group-hover:text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 pb-4 border-t border-slate-800 pt-3">
        <div className="px-3 py-2 mb-1">
          <p className="text-slate-500 text-xs truncate">{userEmail}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sair</span>
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-slate-900 border-r border-slate-800 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile: topbar com botão hamburguer */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
            <Pizza className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">{storeName}</span>
        </div>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="text-slate-400 hover:text-white p-1"
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile: drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col pt-14">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
