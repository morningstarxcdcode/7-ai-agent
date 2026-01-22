import { TrendingUp, Activity, Wallet, AlertCircle, BarChart3, Brain } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import StatCard from '../components/StatCard'
import AgentCard from '../components/AgentCard'

const chartData = [
  { date: 'Mon', value: 118000, agents: 5 },
  { date: 'Tue', value: 120000, agents: 5 },
  { date: 'Wed', value: 122000, agents: 6 },
  { date: 'Thu', value: 121000, agents: 6 },
  { date: 'Fri', value: 123000, agents: 6 },
  { date: 'Sat', value: 125000, agents: 6 },
  { date: 'Sun', value: 125000, agents: 6 },
]

const agents: Array<{
  id: string
  name: string
  description: string
  status: 'running' | 'idle'
  performance: string
}> = [
  {
    id: 'defi-strategist',
    name: 'DeFi Strategist',
    description: 'Analyzes yield farming opportunities',
    status: 'running',
    performance: '+12.5%',
  },
  {
    id: 'portfolio-rebalancer',
    name: 'Portfolio Rebalancer',
    description: 'Maintains optimal asset allocation',
    status: 'idle',
    performance: '+8.3%',
  },
  {
    id: 'prediction-market',
    name: 'Prediction Market',
    description: 'Analyzes market prediction data',
    status: 'running',
    performance: '+5.2%',
  },
  {
    id: 'security-guardian',
    name: 'Security Guardian',
    description: 'Monitors for security threats',
    status: 'idle',
    performance: 'Protected',
  },
]

export default function Dashboard() {
  const portfolioValue = 125000

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Monitor your DeFi automation and portfolio performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Portfolio Value"
          value={`$${portfolioValue.toLocaleString()}`}
          change="+5.2%"
          icon={<Wallet className="w-6 h-6" />}
          color="indigo"
        />
        <StatCard
          title="Total Yield"
          value="$6,250"
          change="+12.5%"
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Active Agents"
          value="6/6"
          change="All Running"
          icon={<Brain className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Risk Level"
          value="Medium"
          change="Within Limits"
          icon={<AlertCircle className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Value Chart */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Portfolio Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94A3B8" />
              <YAxis stroke="#94A3B8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E293B',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#F1F5F9',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366F1"
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Active Agents Chart */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Active Agents
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94A3B8" />
              <YAxis stroke="#94A3B8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E293B',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#F1F5F9',
                }}
              />
              <Bar dataKey="agents" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Agents */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Active Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} {...agent} />
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-slate-700 bg-opacity-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <div>
                  <p className="text-white font-medium">Yield farming executed on Aave</p>
                  <p className="text-xs text-slate-400">2 hours ago</p>
                </div>
              </div>
              <span className="text-green-400 font-semibold">+$125</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
