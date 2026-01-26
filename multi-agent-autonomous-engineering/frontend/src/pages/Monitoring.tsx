import { Activity } from 'lucide-react'

export default function Monitoring() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">System Monitoring</h1>
        <p className="text-slate-400">Real-time system metrics and health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'CPU Usage', value: '34%', color: 'green' },
          { label: 'Memory', value: '2.1 GB', color: 'green' },
          { label: 'Network I/O', value: '145 Mbps', color: 'yellow' },
          { label: 'Task Queue', value: '42 tasks', color: 'green' },
          { label: 'Errors/min', value: '0.5', color: 'green' },
          { label: 'Response Time', value: '245ms', color: 'green' },
        ].map((metric) => (
          <div key={metric.label} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className={`w-4 h-4 ${metric.color === 'green' ? 'text-green-400' : 'text-yellow-400'}`} />
              <p className="text-slate-400 text-sm">{metric.label}</p>
            </div>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">System Logs</h2>
        <div className="space-y-2 font-mono text-sm">
          {[
            { time: '14:32:01', msg: '[INFO] Workflow completed successfully', color: 'green' },
            { time: '14:31:45', msg: '[INFO] Agent initialized: Code Analyzer', color: 'blue' },
            { time: '14:31:12', msg: '[WARN] High memory usage detected', color: 'yellow' },
            { time: '14:30:58', msg: '[INFO] Task queued: Performance analysis', color: 'green' },
          ].map((log, i) => (
            <div key={i} className={`text-${log.color}-400`}>
              <span className="text-slate-500">{log.time}</span> {log.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
