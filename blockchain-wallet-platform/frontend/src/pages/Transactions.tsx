import { useQuery } from '@tanstack/react-query'
import { History, CheckCircle, XCircle, Clock, ExternalLink, Filter } from 'lucide-react'
import { useWalletStore } from '../store'
import { transactionApi } from '../api'
import { useState } from 'react'

export default function Transactions() {
  const { address } = useWalletStore()
  const [filter, setFilter] = useState<'all' | 'Confirmed' | 'Pending' | 'Failed'>('all')

  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ['transactions', address],
    queryFn: async () => {
      const userId = address || ''
      const response = await transactionApi.getByUser(userId)
      return response.data
    },
    enabled: !!address,
    refetchInterval: 5000, // Refetch every 5 seconds
  })

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter(tx => tx.status === filter)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'Failed':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'Failed':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Transaction History</h1>
        <p className="text-gray-600">View and track all your blockchain transactions</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700 mr-2">Filter:</span>
          {(['all', 'Confirmed', 'Pending', 'Failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === status
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            {filteredTransactions.length} Transaction{filteredTransactions.length !== 1 ? 's' : ''}
          </h2>
          <button
            onClick={() => refetch()}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-600">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filter === 'all' ? 'No transactions yet' : `No ${filter.toLowerCase()} transactions`}
            </h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'Your transaction history will appear here once you make your first transaction.'
                : `You don't have any ${filter.toLowerCase()} transactions.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-6 rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {getStatusIcon(tx.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">
                          {tx.token_symbol || 'ETH'} Transfer
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Amount:</span>
                          <span className="font-mono font-bold text-gray-900">
                            {tx.amount} {tx.token_symbol || 'ETH'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">To:</span>
                          <span className="font-mono text-gray-900 truncate">
                            {tx.to_address}
                          </span>
                        </div>
                        {tx.from_address && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">From:</span>
                            <span className="font-mono text-gray-900 truncate">
                              {tx.from_address}
                            </span>
                          </div>
                        )}
                        {tx.tx_hash && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Hash:</span>
                            <a
                              href={`https://etherscan.io/tx/${tx.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-mono"
                            >
                              {tx.tx_hash.slice(0, 10)}...{tx.tx_hash.slice(-8)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500 flex-shrink-0 ml-4">
                    {formatDate(tx.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
