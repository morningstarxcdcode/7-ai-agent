import axios from 'axios'

const API_BASE = 'http://localhost:8001'

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const api = {
  workflows: {
    list: () => client.get('/workflows'),
    get: (id: string) => client.get(`/workflows/${id}`),
    create: (data: any) => client.post('/workflows', data),
    execute: (id: string) => client.post(`/workflows/${id}/execute`),
  },
  agents: {
    list: () => client.get('/agents'),
    get: (id: string) => client.get(`/agents/${id}`),
    getStatus: (id: string) => client.get(`/agents/${id}/status`),
  },
  tasks: {
    list: () => client.get('/tasks'),
    get: (id: string) => client.get(`/tasks/${id}`),
    cancel: (id: string) => client.post(`/tasks/${id}/cancel`),
  },
  results: {
    list: () => client.get('/results'),
    get: (id: string) => client.get(`/results/${id}`),
  },
  monitoring: {
    health: () => client.get('/health'),
    metrics: () => client.get('/metrics'),
    logs: () => client.get('/logs'),
  },
}
