import { create } from 'zustand'

interface Workflow {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed'
  progress: number
}

interface Store {
  workflows: Workflow[]
  activeAgent: string | null
  systemHealth: number
  setActiveAgent: (agent: string) => void
  addWorkflow: (workflow: Workflow) => void
}

export const useStore = create<Store>((set) => ({
  workflows: [],
  activeAgent: null,
  systemHealth: 98,
  setActiveAgent: (agent) => set({ activeAgent: agent }),
  addWorkflow: (workflow) => set((state) => ({ workflows: [...state.workflows, workflow] })),
}))
