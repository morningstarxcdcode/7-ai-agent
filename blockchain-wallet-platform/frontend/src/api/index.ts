import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface Transaction {
  id: string
  user_id: string
  amount: string
  to_address: string
  from_address?: string
  token_symbol?: string
  status: 'Pending' | 'Confirmed' | 'Failed'
  tx_hash?: string
  created_at: string
  updated_at: string
}

export interface WalletInfo {
  address: string
  public_key: string
  created_at: string
}

export interface SwapQuote {
  from_token: string
  to_token: string
  from_amount: string
  to_amount: string
  price_impact: string
  gas_estimate: string
}

export interface SwapRequest {
  from_token: string
  to_token: string
  amount: string
  user_address: string
  slippage: number
}

// Wallet APIs
export const walletApi = {
  register: (data: { address: string; public_key: string }) =>
    api.post<WalletInfo>('/wallet/register', data),
  
  getInfo: (address: string) =>
    api.get<WalletInfo>(`/wallet/${address}`),
  
  getBalance: (address: string, network: string = 'ethereum') =>
    api.get<{ balance: string; formatted: string }>(`/wallet/${address}/balance`, {
      params: { network },
    }),
}

// Transaction APIs
export const transactionApi = {
  create: (data: { user_id: string; amount: string; to_address: string; from_address?: string; token_symbol?: string }) =>
    api.post<Transaction>('/transactions', data),
  
  getById: (id: string) =>
    api.get<Transaction>(`/transactions/${id}`),
  
  getByUser: (userId: string) =>
    api.get<Transaction[]>(`/transactions/user/${userId}`),
  
  updateStatus: (id: string, status: 'Pending' | 'Confirmed' | 'Failed') =>
    api.patch<Transaction>(`/transactions/${id}`, { status }),
}

// Swap APIs
export const swapApi = {
  getQuote: (params: { from_token: string; to_token: string; amount: string }) =>
    api.get<SwapQuote>('/swap/quote', { params }),
  
  executeSwap: (data: SwapRequest) =>
    api.post<{ transaction_id: string; tx_hash: string }>('/swap/execute', data),
  
  getSupportedTokens: () =>
    api.get<Array<{ symbol: string; name: string; address: string; decimals: number }>>('/swap/tokens'),
}

// Chatbot API
export const chatApi = {
  sendMessage: (message: string, context?: any) =>
    api.post<{ response: string; action?: any }>('/chat/message', { message, context }),
}

export default api
