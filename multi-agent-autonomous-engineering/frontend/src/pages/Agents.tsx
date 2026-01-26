import { Cpu, CheckCircle, AlertCircle } from 'lucide-react'

const AGENTS = [
  { name: 'Intent Router', status: 'healthy', uptime: '99.8%', tasks: 245 },
  { name: 'Code Analyzer', status: 'healthy', uptime: '99.9%', tasks: 189 },
  { name: 'Quality Reviewer', status: 'healthy', uptime: '98.5%', tasks: 156 },
  { name: 'Security Scanner', status: 'warning', uptime: '98.2%', tasks: 87 },
  { name: 'Performance Analyzer', status: 'healthy', uptime: '99.7%', tasks: 134 },
  { name: 'Bug Detector', status: 'healthy', uptime: '99.6%', tasks: 201 },
  { name: 'Code Optimizer', status: 'healthy', uptime: '99.5%', tasks: 98 },
]

export default function Agents() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Agents</h1>
        <p className="text-slate-400">Manage and monitor individual agents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Total Agents</p>
          <p className="text-2xl font-bold text-white">{AGENTS.length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Healthy</p>
          <p className="text-2xl font-bold text-green-400">{AGENTS.filter(a => a.status === 'healthy').length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Avg Tasks/Agent</p>
          <p className="text-2xl font-bold text-indigo-400">{Math.round(AGENTS.reduce((a, b) => a + b.tasks, 0) / AGENTS.length)}</p>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {AGENTS.map((agent) => (
          <div key={agent.name} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 bg-opacity-20 rounded-lg">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{agent.name}</h3>
                </div>
              </div>
              {agent.status === 'healthy' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-slate-400">Uptime</p>
                <p className="text-lg font-semibold text-white">{agent.uptime}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tasks</p>
                <p className="text-lg font-semibold text-green-400">{agent.tasks}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className={`text-lg font-semibold ${agent.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {agent.status}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
