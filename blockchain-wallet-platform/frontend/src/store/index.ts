import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WalletState {
  address: string | null
  balance: string
  isConnected: boolean
  setWallet: (address: string) => void
  setBalance: (balance: string) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      balance: '0',
      isConnected: false,
      setWallet: (address) => set({ address, isConnected: true }),
      setBalance: (balance) => set({ balance }),
      disconnect: () => set({ address: null, balance: '0', isConnected: false }),
    }),
    {
      name: 'wallet-storage',
    }
  )
)

interface ChatState {
  isOpen: boolean
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  toggleChat: () => void
  addMessage: (role: 'user' | 'assistant', content: string) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  messages: [{
    role: 'assistant',
    content: 'Hello! I\'m your blockchain assistant. I can help you swap tokens, check balances, send transactions, and more. What would you like to do?'
  }],
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  addMessage: (role, content) =>
    set((state) => ({
      messages: [...state.messages, { role, content }],
    })),
  clearMessages: () =>
    set({
      messages: [{
        role: 'assistant',
        content: 'Hello! I\'m your blockchain assistant. I can help you swap tokens, check balances, send transactions, and more. What would you like to do?'
      }],
    }),
}))
