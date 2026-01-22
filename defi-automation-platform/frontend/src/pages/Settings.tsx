import { Lock, Bell, Code } from 'lucide-react'

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your preferences and configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* General Settings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Security
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-700 bg-opacity-30 rounded-lg">
                <div>
                  <p className="text-white font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-slate-400">Protect your account</p>
                </div>
                <button className="btn btn-primary text-sm">Enable</button>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-700 bg-opacity-30 rounded-lg">
                <div>
                  <p className="text-white font-medium">API Keys</p>
                  <p className="text-sm text-slate-400">Manage API access</p>
                </div>
                <button className="btn btn-secondary text-sm">Manage</button>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h2>
            <div className="space-y-3">
              {[
                { name: 'Agent Status Changes', enabled: true },
                { name: 'High-Risk Alerts', enabled: true },
                { name: 'Daily Summary', enabled: false },
              ].map((notif) => (
                <label key={notif.name} className="flex items-center gap-3 p-3 bg-slate-700 bg-opacity-30 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={notif.enabled}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-white font-medium">{notif.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Settings */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Code className="w-5 h-5" />
            Preferences
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-2">Risk Level</label>
              <select className="w-full" title="Risk Level" aria-label="Select risk level">
                <option>Conservative</option>
                <option selected>Moderate</option>
                <option>Aggressive</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Currency</label>
              <select className="w-full" title="Currency" aria-label="Select currency">
                <option selected>USD</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Theme</label>
              <select className="w-full" title="Theme" aria-label="Select theme">
                <option selected>Dark</option>
                <option>Light</option>
              </select>
            </div>
            <button className="btn btn-primary w-full">Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  )
}
