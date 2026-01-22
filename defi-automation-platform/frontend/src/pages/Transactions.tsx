import { useState } from 'react'
import { Check, Clock, AlertCircle } from 'lucide-react'

const TRANSACTIONS = [
  {
    id: '1',
    type: 'Swap',
    from: 'USDC',
    to: 'ETH',
    amount: '5,000',
    status: 'completed',
    time: '2 hours ago',
  },
  {
    id: '2',
    type: 'Deposit',
    from: 'Wallet',
    to: 'Aave',
    amount: '10,000',
    status: 'completed',
    time: '4 hours ago',
  },
  {
    id: '3',
    type: 'Claim Reward',
    from: 'Curve',
    to: 'Wallet',
    amount: '125',
    status: 'pending',
    time: '10 minutes ago',
  },
  {
    id: '4',
    type: 'Rebalance',
    from: 'Portfolio',
    to: 'Portfolio',
    amount: '$45,000',
    status: 'completed',
    time: '1 day ago',
  },
  {
    id: '5',
    type: 'Bridge',
    from: 'Ethereum',
    to: 'Polygon',
    amount: '2 ETH',
    status: 'failed',
    time: '2 days ago',
  },
]

export default function Transactions() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')

  const filtered = TRANSACTIONS.filter((tx) => {
    if (filter === 'all') return true
    return tx.status === filter
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-400" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Transactions</h1>
        <p className="text-slate-400">View and manage your transaction history</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'completed', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg transition-colors capitalize ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400">Type</th>
                <th className="text-left py-3 px-4 text-slate-400">From</th>
                <th className="text-left py-3 px-4 text-slate-400">To</th>
                <th className="text-left py-3 px-4 text-slate-400">Amount</th>
                <th className="text-left py-3 px-4 text-slate-400">Status</th>
                <th className="text-left py-3 px-4 text-slate-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-800 hover:bg-slate-800 hover:bg-opacity-50">
                  <td className="py-3 px-4 text-white font-medium">{tx.type}</td>
                  <td className="py-3 px-4 text-slate-100">{tx.from}</td>
                  <td className="py-3 px-4 text-slate-100">{tx.to}</td>
                  <td className="py-3 px-4 text-white font-semibold">{tx.amount}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tx.status)}
                      <span className={
                        tx.status === 'completed' ? 'text-green-400' :
                        tx.status === 'pending' ? 'text-yellow-400' :
                        'text-red-400'
                      }>
                        {tx.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{tx.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
