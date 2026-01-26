import { Bell, Search, Activity } from 'lucide-react'

export default function TopBar() {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search workflows, agents..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 ml-6">
          <button title="Notifications" className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1 bg-green-500 bg-opacity-20 text-green-400 rounded-full text-sm">
            <Activity className="w-4 h-4" />
            All Systems Operational
          </div>
        </div>
      </div>
    </header>
  )
}
