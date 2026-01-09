import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowDownUp, Loader2, Info, Settings, Zap } from 'lucide-react'
import { useWalletStore } from '../store'
import { swapApi } from '../api'
import toast from 'react-hot-toast'

const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0x0', decimals: 18, logo: '⟠' },
  { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, logo: '💵' },
  { symbol: 'USDT', name: 'Tether', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6, logo: '💲' },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18, logo: '🪙' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8, logo: '₿' },
]

export default function Swap() {
  const { address } = useWalletStore()
  const [fromToken, setFromToken] = useState(TOKENS[0])
  const [toToken, setToToken] = useState(TOKENS[1])
  const [fromAmount, setFromAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [showSettings, setShowSettings] = useState(false)

  // Fetch quote
  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['quote', fromToken.symbol, toToken.symbol, fromAmount],
    queryFn: async () => {
      if (!fromAmount || parseFloat(fromAmount) <= 0) return null
      const response = await swapApi.getQuote({
        from_token: fromToken.symbol,
        to_token: toToken.symbol,
        amount: fromAmount,
      })
      return response.data
    },
    enabled: !!fromAmount && parseFloat(fromAmount) > 0,
  })

  // Execute swap mutation
  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error('Wallet not connected')
      const response = await swapApi.executeSwap({
        from_token: fromToken.symbol,
        to_token: toToken.symbol,
        amount: fromAmount,
        user_address: address,
        slippage,
      })
      return response.data
    },
    onSuccess: (data) => {
      toast.success(`Swap initiated! Transaction: ${data.tx_hash?.slice(0, 10)}...`)
      setFromAmount('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Swap failed')
    },
  })

  const handleSwap = () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    swapMutation.mutate()
  }

  const switchTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount('')
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Swap Tokens</h1>
        <p className="text-gray-600">Exchange your crypto assets instantly</p>
      </div>

      {/* Swap Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Swap</h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Swap settings"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Slippage Tolerance
              </label>
              <div className="flex gap-2">
                {[0.1, 0.5, 1.0].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      slippage === value
                        ? 'bg-primary-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* From Token */}
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium text-gray-700">From</label>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <select
                value={fromToken.symbol}
                onChange={(e) => setFromToken(TOKENS.find(t => t.symbol === e.target.value)!)}
                title="Select from token"
                aria-label="Select token to swap from"
                className="bg-transparent text-lg font-semibold outline-none cursor-pointer"
              >
                {TOKENS.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.logo} {token.symbol}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                className="bg-transparent text-right text-2xl font-bold outline-none w-40"
              />
            </div>
            <div className="text-sm text-gray-500 text-right">
              {fromToken.name}
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={switchTokens}
            title="Switch tokens"
            className="w-10 h-10 bg-white border-4 border-gray-50 rounded-xl hover:bg-gray-50 transition-colors shadow-md"
          >
            <ArrowDownUp className="w-5 h-5 mx-auto text-gray-600" />
          </button>
        </div>

        {/* To Token */}
        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium text-gray-700">To</label>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <select
                value={toToken.symbol}
                onChange={(e) => setToToken(TOKENS.find(t => t.symbol === e.target.value)!)}
                title="Select to token"
                aria-label="Select token to swap to"
                className="bg-transparent text-lg font-semibold outline-none cursor-pointer"
              >
                {TOKENS.filter(t => t.symbol !== fromToken.symbol).map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.logo} {token.symbol}
                  </option>
                ))}
              </select>
              <div className="text-2xl font-bold text-gray-400">
                {quoteLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : quote ? (
                  parseFloat(quote.to_amount).toFixed(6)
                ) : (
                  '0.0'
                )}
              </div>
            </div>
            <div className="text-sm text-gray-500 text-right">
              {toToken.name}
            </div>
          </div>
        </div>

        {/* Quote Details */}
        {quote && (
          <div className="mb-6 p-4 bg-primary-50 border border-primary-100 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Rate</span>
              <span className="font-medium">
                1 {fromToken.symbol} ≈ {(parseFloat(quote.to_amount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Price Impact</span>
              <span className={`font-medium ${parseFloat(quote.price_impact) > 1 ? 'text-orange-600' : 'text-green-600'}`}>
                {quote.price_impact}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Gas Estimate</span>
              <span className="font-medium">{quote.gas_estimate} ETH</span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!fromAmount || parseFloat(fromAmount) <= 0 || swapMutation.isPending}
          className="w-full btn btn-primary py-4 text-lg flex items-center justify-center gap-2"
        >
          {swapMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Swapping...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Swap
            </>
          )}
        </button>

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            Swaps are executed on-chain. You'll need to confirm the transaction in your wallet.
          </p>
        </div>
      </div>

      {/* AI Assistant Tip */}
      <div className="card bg-gradient-to-br from-primary-50 to-blue-50 border-primary-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Pro Tip: Use AI Assistant</h3>
            <p className="text-sm text-gray-700">
              Try saying "Swap 0.1 ETH to USDC" in the AI chat for guided transactions!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
