import axios from 'axios'

const API_BASE = 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const agentsApi = {
  getAgents: () => api.get('/agents'),
  getAgentStatus: (agentId: string) => api.get(`/agents/${agentId}/status`),
  getAgentResults: (agentId: string) => api.get(`/agents/${agentId}/results`),
  startAgent: (agentId: string) => api.post(`/agents/${agentId}/start`),
  stopAgent: (agentId: string) => api.post(`/agents/${agentId}/stop`),
}

export const strategiesApi = {
  getStrategies: () => api.get('/strategies'),
  getStrategyDetails: (strategyId: string) => api.get(`/strategies/${strategyId}`),
  executeStrategy: (strategyId: string, params: any) => api.post(`/strategies/${strategyId}/execute`, params),
}

export const portfolioApi = {
  getPortfolio: () => api.get('/portfolio'),
  getHoldings: () => api.get('/portfolio/holdings'),
  getPerformance: () => api.get('/portfolio/performance'),
  rebalance: (params: any) => api.post('/portfolio/rebalance', params),
}

export const transactionsApi = {
  getTransactions: (filter?: string) => api.get(`/transactions${filter ? `?status=${filter}` : ''}`),
  getTransactionDetails: (txId: string) => api.get(`/transactions/${txId}`),
}

export const marketDataApi = {
  getPrices: () => api.get('/market/prices'),
  getYieldOpportunities: () => api.get('/market/yield-opportunities'),
}

export default api
