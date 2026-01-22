import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, Settings, Brain, TrendingUp, Wallet, 
  Zap, ChevronDown, LogOut 
} from 'lucide-react'

const MENU_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/agents', label: 'Agents', icon: Brain },
  { path: '/strategies', label: 'Strategies', icon: Zap },
  { path: '/portfolio', label: 'Portfolio', icon: Wallet },
  { path: '/transactions', label: 'Transactions', icon: TrendingUp },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
      {/* Logo */}
      <div className="mb-8">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600">
          <Brain className="w-6 h-6 text-white" />
          <div>
            <h1 className="font-bold text-white">DeFi Hub</h1>
            <p className="text-xs text-indigo-200">Automation</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 space-y-2">
        {MENU_ITEMS.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
              location.pathname === path
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* User Profile */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">User Account</p>
            <p className="text-xs text-slate-400">Premium</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white" />
        </div>
        <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-400 mt-2 rounded-lg hover:bg-slate-800">
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
