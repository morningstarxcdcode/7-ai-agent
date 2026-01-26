import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, GitBranch, Cpu, Zap, FileText, 
  BarChart3, Settings, LogOut 
} from 'lucide-react'

const MENU_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/workflows', label: 'Workflows', icon: GitBranch },
  { path: '/agents', label: 'Agents', icon: Cpu },
  { path: '/tasks', label: 'Tasks', icon: Zap },
  { path: '/results', label: 'Results', icon: FileText },
  { path: '/monitoring', label: 'Monitoring', icon: BarChart3 },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600">
          <Cpu className="w-6 h-6 text-white" />
          <div>
            <h1 className="font-bold text-white">Agent Hub</h1>
            <p className="text-xs text-indigo-200">Engineering</p>
          </div>
        </div>
      </div>

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

      <div className="pt-4 border-t border-slate-800">
        <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-400 mt-2 rounded-lg hover:bg-slate-800">
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
