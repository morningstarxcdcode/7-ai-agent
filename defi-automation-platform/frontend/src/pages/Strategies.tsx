const STRATEGIES = [
  {
    id: 'yield-farming',
    name: 'Yield Farming',
    type: 'Automated',
    protocols: ['Aave', 'Compound', 'Curve'],
    apy: '12.5%',
    tvl: '$45,000',
    risk: 'Medium',
  },
  {
    id: 'liquidity-provision',
    name: 'Liquidity Provision',
    type: 'Passive',
    protocols: ['Uniswap', 'Balancer'],
    apy: '8.3%',
    tvl: '$35,000',
    risk: 'High',
  },
  {
    id: 'staking',
    name: 'Staking',
    type: 'Automated',
    protocols: ['Eth2', 'Lido', 'Rocket Pool'],
    apy: '5.2%',
    tvl: '$25,000',
    risk: 'Low',
  },
  {
    id: 'arbitrage',
    name: 'Cross-Protocol Arbitrage',
    type: 'Active',
    protocols: ['Multiple DEXs'],
    apy: '15.8%',
    tvl: '$20,000',
    risk: 'Medium',
  },
]

export default function Strategies() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">DeFi Strategies</h1>
        <p className="text-slate-400">Manage and monitor your investment strategies</p>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {STRATEGIES.map((strategy) => (
          <div key={strategy.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
              <span className="badge badge-info">{strategy.type}</span>
            </div>

            <p className="text-sm text-slate-400 mb-4">
              Protocols: {strategy.protocols.join(', ')}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-slate-700 bg-opacity-30 rounded-lg">
              <div>
                <p className="text-xs text-slate-400">APY</p>
                <p className="text-lg font-semibold text-green-400">{strategy.apy}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">TVL</p>
                <p className="text-lg font-semibold text-indigo-400">{strategy.tvl}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Risk</p>
                <p className={`text-lg font-semibold ${
                  strategy.risk === 'Low' ? 'text-green-400' :
                  strategy.risk === 'Medium' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {strategy.risk}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1">Activate</button>
              <button className="btn btn-ghost flex-1">Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
