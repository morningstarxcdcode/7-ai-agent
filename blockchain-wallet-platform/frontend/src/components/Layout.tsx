import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Wallet, ArrowLeftRight, History, MessageCircle, LogOut } from 'lucide-react'
import { useWalletStore, useChatStore } from '../store'
import ChatBot from './ChatBot'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { address, disconnect } = useWalletStore()
  const { isOpen, toggleChat } = useChatStore()

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Wallet },
    { name: 'Swap', href: '/swap', icon: ArrowLeftRight },
    { name: 'Transactions', href: '/transactions', icon: History },
  ]

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Blockchain</h1>
              <p className="text-xs text-gray-500">Wallet Platform</p>
            </div>
          </div>

          {/* Wallet Info */}
          <div className="mb-6 p-4 bg-gradient-to-br from-primary-50 to-blue-50 rounded-lg border border-primary-100">
            <p className="text-xs text-gray-600 mb-1">Connected Wallet</p>
            <p className="font-mono text-sm font-medium text-gray-900">
              {address ? shortenAddress(address) : 'Not connected'}
            </p>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto p-6 border-t border-gray-200">
          <button
            onClick={() => toggleChat()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all mb-2"
          >
            <MessageCircle className="w-5 h-5" />
            AI Assistant
          </button>
          <button
            onClick={disconnect}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Disconnect
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </div>

      {/* ChatBot */}
      {isOpen && <ChatBot />}
    </div>
  )
}
