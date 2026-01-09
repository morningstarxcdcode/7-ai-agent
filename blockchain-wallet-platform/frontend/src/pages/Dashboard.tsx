import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'
import { useWalletStore } from '../store'
import { transactionApi } from '../api'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { address } = useWalletStore()
  const navigate = useNavigate()
  const [balance, setBalance] = useState('0')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch balance
  const refreshBalance = async () => {
    if (!address) return
    setIsRefreshing(true)
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const balanceWei = await provider.getBalance(address)
        const balanceEth = ethers.formatEther(balanceWei)
        setBalance(parseFloat(balanceEth).toFixed(4))
      }
    } catch (error) {
      console.error('Balance fetch error:', error)
      toast.error('Failed to fetch balance')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    refreshBalance()
  }, [address])

  // Fetch recent transactions
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', address],
    queryFn: async () => {
      // For demo, create a mock user ID from address
      const userId = address || ''
      const response = await transactionApi.getByUser(userId)
      return response.data
    },
    enabled: !!address,
  })

  const stats = [
    {
      label: 'Total Balance',
      value: `${balance} ETH`,
      change: '+5.2%',
      trend: 'up',
      icon: Wallet,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Total Transactions',
      value: transactions.length.toString(),
      change: '+12',
      trend: 'up',
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's your wallet overview.</p>
        </div>
        <button
          onClick={refreshBalance}
          disabled={isRefreshing}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm">
                {stat.trend === 'up' ? (
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                )}
                <span className={stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
                  {stat.change}
                </span>
                <span className="text-gray-500">this month</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/swap')}
            className="p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 group-hover:bg-primary-200 rounded-xl flex items-center justify-center transition-colors">
                <ArrowUpRight className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Swap Tokens</h3>
                <p className="text-sm text-gray-600">Exchange your crypto assets</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => navigate('/transactions')}
            className="p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 group-hover:bg-primary-200 rounded-xl flex items-center justify-center transition-colors">
                <TrendingUp className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">View Transactions</h3>
                <p className="text-sm text-gray-600">Track your transaction history</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <button
            onClick={() => navigate('/transactions')}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View All
          </button>
        </div>
        {txLoading ? (
          <div className="text-center py-8 text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No transactions yet</p>
            <p className="text-sm">Start by making a swap!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.status === 'Confirmed' ? 'bg-green-100' : tx.status === 'Failed' ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    <ArrowUpRight className={`w-5 h-5 ${
                      tx.status === 'Confirmed' ? 'text-green-600' : tx.status === 'Failed' ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium">{tx.token_symbol || 'ETH'}</p>
                    <p className="text-sm text-gray-500">
                      To: {tx.to_address.slice(0, 6)}...{tx.to_address.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{tx.amount} {tx.token_symbol || 'ETH'}</p>
                  <p className={`text-sm ${
                    tx.status === 'Confirmed' ? 'text-green-600' : tx.status === 'Failed' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
