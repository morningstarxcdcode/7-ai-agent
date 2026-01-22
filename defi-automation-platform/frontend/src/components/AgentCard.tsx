import { Play, Pause } from 'lucide-react'

interface AgentCardProps {
  id: string
  name: string
  description: string
  status: 'running' | 'idle'
  performance: string
}

export default function AgentCard({ id: _id, name, description, status, performance }: AgentCardProps) {
  return (
    <div className="card hover:border-indigo-500 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{name}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        <button className={`p-2 rounded-lg ${
          status === 'running'
            ? 'bg-red-500 bg-opacity-20 text-red-400'
            : 'bg-green-500 bg-opacity-20 text-green-400'
        }`}>
          {status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-green-400' : 'bg-slate-600'}`}></div>
          <span className={status === 'running' ? 'text-green-400 text-sm' : 'text-slate-400 text-sm'}>
            {status === 'running' ? 'Running' : 'Idle'}
          </span>
        </div>
        <span className={performance.includes('-') ? 'text-red-400' : 'text-green-400'}>
          {performance}
        </span>
      </div>
    </div>
  )
}
