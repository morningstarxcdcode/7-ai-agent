import { GitBranch, Play, Pause, Trash2 } from 'lucide-react'

const WORKFLOWS = [
  {
    id: '1',
    name: 'Code Review Pipeline',
    description: 'Automated code review and analysis',
    status: 'completed',
    agents: ['Intent Router', 'Code Analyzer', 'Quality Reviewer'],
    progress: 100,
    duration: '12m 34s',
  },
  {
    id: '2',
    name: 'Security Audit',
    description: 'Full security audit and compliance check',
    status: 'running',
    agents: ['Intent Router', 'Security Scanner', 'Vulnerability Hunter'],
    progress: 65,
    duration: '5m 12s',
  },
  {
    id: '3',
    name: 'Performance Optimization',
    description: 'Analyze and optimize code performance',
    status: 'pending',
    agents: ['Intent Router', 'Performance Analyzer'],
    progress: 0,
    duration: 'N/A',
  },
]

export default function Workflows() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Workflows</h1>
          <p className="text-slate-400">Create and manage multi-agent workflows</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">
          Create Workflow
        </button>
      </div>

      {/* Workflow Cards */}
      <div className="space-y-4">
        {WORKFLOWS.map((wf) => (
          <div key={wf.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-semibold text-white">{wf.name}</h3>
                </div>
                <p className="text-slate-400 text-sm">{wf.description}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                wf.status === 'completed' ? 'bg-green-500 bg-opacity-20 text-green-400' :
                wf.status === 'running' ? 'bg-blue-500 bg-opacity-20 text-blue-400' :
                'bg-slate-600 text-slate-300'
              }`}>
                {wf.status}
              </span>
            </div>

            {/* Agents */}
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">Agents ({wf.agents.length})</p>
              <div className="flex gap-2 flex-wrap">
                {wf.agents.map((agent) => (
                  <span key={agent} className="bg-slate-700 text-slate-200 px-3 py-1 rounded-full text-xs">
                    {agent}
                  </span>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-slate-400">Progress</p>
                <p className="text-sm font-semibold text-white">{wf.progress}%</p>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`bg-indigo-600 h-2 rounded-full transition-all ${
                    wf.progress === 100 ? 'w-full' : 
                    wf.progress >= 75 ? 'w-3/4' :
                    wf.progress >= 50 ? 'w-1/2' :
                    wf.progress >= 25 ? 'w-1/4' :
                    wf.progress > 0 ? 'w-[10%]' : 'w-0'
                  }`}
                ></div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Duration: {wf.duration}</p>
              <div className="flex gap-2">
                <button title={wf.status === 'running' ? 'Pause workflow' : 'Start workflow'} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                  {wf.status === 'running' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button title="Delete workflow" className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
