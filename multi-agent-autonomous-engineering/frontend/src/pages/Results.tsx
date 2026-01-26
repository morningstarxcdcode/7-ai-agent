export default function Results() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Results</h1>
        <p className="text-slate-400">View workflow and task results</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-2">Workflow Result #{i}</h3>
            <p className="text-sm text-slate-400 mb-4">Code Review Pipeline executed successfully</p>
            <pre className="bg-slate-900 p-3 rounded text-xs text-slate-300 overflow-auto max-h-32">
{`{
  "status": "completed",
  "duration": "12m 34s",
  "quality_score": 8.5,
  "issues_found": 3
}`}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
