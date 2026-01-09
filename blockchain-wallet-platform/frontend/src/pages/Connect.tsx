import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, Loader2 } from 'lucide-react'
import { ethers } from 'ethers'
import { useWalletStore } from '../store'
import { walletApi } from '../api'
import toast from 'react-hot-toast'

export default function Connect() {
  const [isConnecting, setIsConnecting] = useState(false)
  const { setWallet } = useWalletStore()
  const navigate = useNavigate()

  const connectWallet = async () => {
    setIsConnecting(true)
    try {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        toast.error('Please install MetaMask to continue')
        setIsConnecting(false)
        return
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (accounts.length === 0) {
        throw new Error('No accounts found')
      }

      const address = accounts[0]
      
      // Create provider for future network verification
      void new ethers.BrowserProvider(window.ethereum)
      
      // Register wallet with backend
      try {
        await walletApi.register({
          address,
          public_key: address, // In production, use actual public key
        })
      } catch (error: any) {
        // Wallet might already be registered, that's okay
        console.log('Wallet registration:', error.message)
      }

      setWallet(address)
      toast.success('Wallet connected successfully!')
      navigate('/')
    } catch (error: any) {
      console.error('Connection error:', error)
      toast.error(error.message || 'Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl items-center justify-center mb-4 shadow-lg">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            Blockchain Wallet
          </h1>
          <p className="text-gray-600">
            Connect your wallet to get started
          </p>
        </div>

        {/* Features */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">What you can do:</h2>
          <ul className="space-y-3">
            {[
              'Swap tokens instantly',
              'Track all your transactions',
              'AI-powered transaction assistance',
              'Multi-chain support',
              'Secure & non-custodial',
            ].map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary-500 rounded-full" />
                <span className="text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Connect Button */}
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full btn btn-primary py-4 text-lg flex items-center justify-center gap-3"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              Connect MetaMask
            </>
          )}
        </button>

        {/* Security Note */}
        <p className="text-xs text-gray-500 text-center mt-4">
          🔒 Your private keys never leave your device
        </p>
      </div>
    </div>
  )
}

declare global {
  interface Window {
    ethereum?: any
  }
}
