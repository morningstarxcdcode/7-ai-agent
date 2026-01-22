import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const portfolioData = [
  { name: 'ETH', value: 45, color: '#6366F1' },
  { name: 'USDC', value: 30, color: '#10B981' },
  { name: 'DAI', value: 15, color: '#F59E0B' },
  { name: 'USDT', value: 10, color: '#8B5CF6' },
]

export default function Portfolio() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Portfolio</h1>
        <p className="text-slate-400">View your asset allocation and performance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="lg:col-span-2 card">
          <h2 className="text-xl font-semibold text-white mb-4">Asset Allocation</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={portfolioData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {portfolioData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Summary</h2>
          <div className="space-y-3">
            <div>
              <p className="text-slate-400 text-sm">Total Value</p>
              <p className="text-2xl font-bold text-white">$125,000</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">24h Change</p>
              <p className="text-2xl font-bold text-green-400">+$1,250</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">YTD Return</p>
              <p className="text-2xl font-bold text-green-400">+12.5%</p>
            </div>
            <button className="btn btn-primary w-full">Rebalance</button>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Holdings</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400">Asset</th>
                <th className="text-left py-3 px-4 text-slate-400">Amount</th>
                <th className="text-left py-3 px-4 text-slate-400">Price</th>
                <th className="text-left py-3 px-4 text-slate-400">Value</th>
                <th className="text-left py-3 px-4 text-slate-400">Change</th>
              </tr>
            </thead>
            <tbody>
              {[
                { asset: 'ETH', amount: '25', price: '$1,800', value: '$45,000', change: '+5.2%' },
                { asset: 'USDC', amount: '30,000', price: '$1.00', value: '$30,000', change: '-' },
                { asset: 'DAI', amount: '15,000', price: '$1.00', value: '$15,000', change: '-' },
                { asset: 'USDT', amount: '10,000', price: '$1.00', value: '$10,000', change: '-' },
              ].map((row) => (
                <tr key={row.asset} className="border-b border-slate-800 hover:bg-slate-800 hover:bg-opacity-50">
                  <td className="py-3 px-4 text-white font-medium">{row.asset}</td>
                  <td className="py-3 px-4 text-slate-100">{row.amount}</td>
                  <td className="py-3 px-4 text-slate-100">{row.price}</td>
                  <td className="py-3 px-4 text-white font-semibold">{row.value}</td>
                  <td className="py-3 px-4 text-green-400">{row.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
