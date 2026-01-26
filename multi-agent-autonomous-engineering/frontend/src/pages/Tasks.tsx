export default function Tasks() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Task Queue</h1>
        <p className="text-slate-400">View active and historical tasks</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400">Task ID</th>
                <th className="text-left py-3 px-4 text-slate-400">Type</th>
                <th className="text-left py-3 px-4 text-slate-400">Agent</th>
                <th className="text-left py-3 px-4 text-slate-400">Status</th>
                <th className="text-left py-3 px-4 text-slate-400">Progress</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: 'TASK-001', type: 'Code Review', agent: 'Quality Reviewer', status: 'completed', progress: 100 },
                { id: 'TASK-002', type: 'Security Scan', agent: 'Security Scanner', status: 'running', progress: 67 },
                { id: 'TASK-003', type: 'Performance Analysis', agent: 'Performance Analyzer', status: 'pending', progress: 0 },
                { id: 'TASK-004', type: 'Bug Detection', agent: 'Bug Detector', status: 'completed', progress: 100 },
              ].map((task) => (
                <tr key={task.id} className="border-b border-slate-800 hover:bg-slate-700 hover:bg-opacity-50">
                  <td className="py-3 px-4 text-white font-medium">{task.id}</td>
                  <td className="py-3 px-4 text-slate-100">{task.type}</td>
                  <td className="py-3 px-4 text-slate-100">{task.agent}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      task.status === 'completed' ? 'bg-green-500 bg-opacity-20 text-green-400' :
                      task.status === 'running' ? 'bg-blue-500 bg-opacity-20 text-blue-400' :
                      'bg-slate-600 text-slate-300'
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-24 bg-slate-700 rounded-full h-2">
                      <div className={`bg-indigo-600 h-2 rounded-full ${
                        task.progress === 100 ? 'w-full' : 
                        task.progress >= 67 ? 'w-2/3' :
                        task.progress > 0 ? 'w-0' : 'w-0'
                      }`}></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
