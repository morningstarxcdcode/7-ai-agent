import { useState } from 'react'
import { Brain, Play, Pause } from 'lucide-react'

const AGENTS = [
  {
    id: 'defi-strategist',
    name: 'DeFi Strategist',
    description: 'Analyzes yield farming opportunities across protocols',
    status: 'running',
    uptime: '99.8%',
    performance: '+12.5%',
    lastRun: '2 minutes ago',
  },
  {
    id: 'portfolio-rebalancer',
    name: 'Portfolio Rebalancer',
    description: 'Maintains optimal asset allocation based on market conditions',
    status: 'idle',
    uptime: '99.9%',
    performance: '+8.3%',
    lastRun: '1 hour ago',
  },
  {
    id: 'prediction-market',
    name: 'Prediction Market Analyst',
    description: 'Analyzes market prediction data and identifies trends',
    status: 'running',
    uptime: '98.5%',
    performance: '+5.2%',
    lastRun: '5 minutes ago',
  },
  {
    id: 'security-guardian',
    name: 'Security Guardian',
    description: 'Monitors for security threats and anomalies',
    status: 'idle',
    uptime: '100%',
    performance: 'Protected',
    lastRun: 'Just now',
  },
  {
    id: 'smart-wallet',
    name: 'Smart Wallet Manager',
    description: 'Manages wallet operations and optimizes gas fees',
    status: 'running',
    uptime: '99.7%',
    performance: '-0.5%',
    lastRun: '3 minutes ago',
  },
  {
    id: 'world-solver',
    name: 'World Problem Solver',
    description: 'Analyzes global impact investments',
    status: 'idle',
    uptime: '99.2%',
    performance: '+2.1%',
    lastRun: '2 hours ago',
  },
]

export default function Agents() {
  const [agents, setAgents] = useState(AGENTS)

  const toggleAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === id
          ? { ...agent, status: agent.status === 'running' ? 'idle' : 'running' }
          : agent
      )
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">AI Agents</h1>
        <p className="text-slate-400">Monitor and manage your autonomous agents</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-slate-400 text-sm">Total Agents</p>
          <p className="text-3xl font-bold text-white">{agents.length}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm">Running</p>
          <p className="text-3xl font-bold text-green-400">{agents.filter((a) => a.status === 'running').length}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm">Average Uptime</p>
          <p className="text-3xl font-bold text-indigo-400">99.5%</p>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <div key={agent.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-indigo-600 bg-opacity-20 rounded-lg">
                  <Brain className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                  <p className="text-sm text-slate-400">{agent.description}</p>
                </div>
              </div>
              <button
                onClick={() => toggleAgent(agent.id)}
                className={`p-2 rounded-lg transition-colors ${
                  agent.status === 'running'
                    ? 'bg-red-500 bg-opacity-20 text-red-400 hover:bg-opacity-30'
                    : 'bg-green-500 bg-opacity-20 text-green-400 hover:bg-opacity-30'
                }`}
              >
                {agent.status === 'running' ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-2 h-2 rounded-full ${
                  agent.status === 'running' ? 'bg-green-400' : 'bg-slate-600'
                }`}
              ></div>
              <span className={agent.status === 'running' ? 'text-green-400' : 'text-slate-400'}>
                {agent.status === 'running' ? 'Running' : 'Idle'}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{agent.lastRun}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
              <div>
                <p className="text-xs text-slate-400 mb-1">Uptime</p>
                <p className="text-lg font-semibold text-white">{agent.uptime}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Performance</p>
                <p className={`text-lg font-semibold ${agent.performance.includes('-') ? 'text-red-400' : 'text-green-400'}`}>
                  {agent.performance}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Status</p>
                <button className="btn btn-secondary text-xs py-1">View Logs</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
