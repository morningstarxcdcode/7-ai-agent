import { BarChart3, Cpu, Zap, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const performanceData = [
  { time: '00:00', agents: 7, tasks: 42 },
  { time: '04:00', agents: 7, tasks: 156 },
  { time: '08:00', agents: 7, tasks: 289 },
  { time: '12:00', agents: 7, tasks: 412 },
  { time: '16:00', agents: 7, tasks: 578 },
  { time: '20:00', agents: 7, tasks: 721 },
  { time: '24:00', agents: 7, tasks: 845 },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">System Dashboard</h1>
        <p className="text-slate-400">Monitor your 7-agent autonomous engineering system</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <p className="text-slate-400 text-sm">Active Agents</p>
          </div>
          <p className="text-3xl font-bold text-white">7/7</p>
          <p className="text-xs text-green-400">All running</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-purple-400" />
            <p className="text-slate-400 text-sm">Tasks Completed</p>
          </div>
          <p className="text-3xl font-bold text-white">845</p>
          <p className="text-xs text-green-400">+12 today</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-green-400" />
            <p className="text-slate-400 text-sm">Success Rate</p>
          </div>
          <p className="text-3xl font-bold text-white">98.5%</p>
          <p className="text-xs text-green-400">Excellent</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <p className="text-slate-400 text-sm">Errors</p>
          </div>
          <p className="text-3xl font-bold text-white">13</p>
          <p className="text-xs text-yellow-400">2 critical</p>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Performance Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94A3B8" />
            <YAxis stroke="#94A3B8" />
            <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569' }} />
            <Line type="monotone" dataKey="tasks" stroke="#6366F1" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Workflows */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Workflows</h2>
        <div className="space-y-2">
          {[
            { name: 'Code Review Pipeline', status: 'completed', agents: 3 },
            { name: 'Security Analysis', status: 'running', agents: 2 },
            { name: 'Performance Optimization', status: 'pending', agents: 4 },
            { name: 'Bug Detection', status: 'completed', agents: 2 },
          ].map((wf) => (
            <div key={wf.name} className="flex items-center justify-between p-3 bg-slate-700 bg-opacity-50 rounded-lg">
              <div>
                <p className="text-white font-medium">{wf.name}</p>
                <p className="text-xs text-slate-400">{wf.agents} agents</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                wf.status === 'completed' ? 'bg-green-500 bg-opacity-20 text-green-400' :
                wf.status === 'running' ? 'bg-blue-500 bg-opacity-20 text-blue-400' :
                'bg-slate-600 text-slate-300'
              }`}>
                {wf.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
