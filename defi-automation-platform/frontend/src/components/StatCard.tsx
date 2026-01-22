import React from 'react'

interface StatCardProps {
  title: string
  value: string
  change: string
  icon: React.ReactNode
  color: 'indigo' | 'green' | 'purple' | 'yellow'
}

const colorMap = {
  indigo: 'bg-indigo-600 bg-opacity-20 text-indigo-400',
  green: 'bg-green-600 bg-opacity-20 text-green-400',
  purple: 'bg-purple-600 bg-opacity-20 text-purple-400',
  yellow: 'bg-yellow-600 bg-opacity-20 text-yellow-400',
}

export default function StatCard({ title, value, change, icon, color }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-sm text-green-400">{change}</p>
    </div>
  )
}
