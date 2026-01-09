import { Routes, Route, Navigate } from 'react-router-dom'
import { useWalletStore } from './store'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Swap from './pages/Swap'
import Transactions from './pages/Transactions'
import Connect from './pages/Connect'

function App() {
  const isConnected = useWalletStore((state) => state.isConnected)

  return (
    <Routes>
      <Route path="/connect" element={<Connect />} />
      <Route
        path="/"
        element={
          isConnected ? (
            <Layout>
              <Dashboard />
            </Layout>
          ) : (
            <Navigate to="/connect" replace />
          )
        }
      />
      <Route
        path="/swap"
        element={
          isConnected ? (
            <Layout>
              <Swap />
            </Layout>
          ) : (
            <Navigate to="/connect" replace />
          )
        }
      />
      <Route
        path="/transactions"
        element={
          isConnected ? (
            <Layout>
              <Transactions />
            </Layout>
          ) : (
            <Navigate to="/connect" replace />
          )
        }
      />
    </Routes>
  )
}

export default App
