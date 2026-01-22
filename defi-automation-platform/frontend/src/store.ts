import { create } from 'zustand'

interface DeFiState {
  agentStatus: Record<string, 'running' | 'idle' | 'error'>
  selectedAgent: string | null
  portfolioValue: number
  selectedStrategy: string | null
  transactionFilter: 'all' | 'pending' | 'completed' | 'failed'
  
  // Actions
  updateAgentStatus: (agentId: string, status: 'running' | 'idle' | 'error') => void
  setSelectedAgent: (agentId: string | null) => void
  setPortfolioValue: (value: number) => void
  setSelectedStrategy: (strategyId: string | null) => void
  setTransactionFilter: (filter: 'all' | 'pending' | 'completed' | 'failed') => void
}

export const useDefiStore = create<DeFiState>((set) => ({
  agentStatus: {
    'defi-strategist': 'idle',
    'portfolio-rebalancer': 'idle',
    'prediction-market': 'idle',
    'security-guardian': 'idle',
    'smart-wallet': 'idle',
    'world-solver': 'idle',
  },
  selectedAgent: null,
  portfolioValue: 125000,
  selectedStrategy: null,
  transactionFilter: 'all',
  
  updateAgentStatus: (agentId, status) =>
    set((state) => ({
      agentStatus: { ...state.agentStatus, [agentId]: status },
    })),
  
  setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),
  setPortfolioValue: (value) => set({ portfolioValue: value }),
  setSelectedStrategy: (strategyId) => set({ selectedStrategy: strategyId }),
  setTransactionFilter: (filter) => set({ transactionFilter: filter }),
}))
