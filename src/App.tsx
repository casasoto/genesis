import { useState } from 'react'
import { getFeatureFlags } from './config'

type Tab = 'dashboard' | 'lessons' | 'exams' | 'flashcards' | 'planner' | 'tutor'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const flags = getFeatureFlags()

  const tabs: Array<{ id: Tab; label: string; enabled: boolean }> = [
    { id: 'dashboard', label: 'Dashboard', enabled: true },
    { id: 'lessons', label: 'Lessons', enabled: true },
    { id: 'exams', label: 'Practice Exams', enabled: true },
    { id: 'flashcards', label: 'Flashcards', enabled: flags.flashcardsEnabled },
    { id: 'planner', label: 'Study Plan', enabled: true },
    { id: 'tutor', label: 'AI Tutor', enabled: flags.aiTutorEnabled },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Disclaimer banner */}
      <div className="bg-amber-900/30 border-b border-amber-700 px-4 py-2 text-sm text-amber-200 text-center">
        ⚠️ LocksmithPrep is a study aid only. It does not guarantee passing any exam. Always seek supervised hands-on practice and follow all applicable laws.
      </div>

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-4">
        <h1 className="text-xl font-bold text-blue-400">🔐 LocksmithPrep</h1>
        <p className="text-sm text-slate-400 mt-1">ALOA Locksmith Exam Preparation</p>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-900/50 border-b border-slate-800 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.filter((t) => t.enabled).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content area */}
      <main className="p-6 max-w-6xl mx-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Welcome to LocksmithPrep</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-blue-400">Study Progress</h3>
                <p className="text-slate-400 mt-2">Track your learning journey</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-green-400">Exam Readiness</h3>
                <p className="text-slate-400 mt-2">Practice exam performance</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-amber-400">Study Streak</h3>
                <p className="text-slate-400 mt-2">Keep your momentum going</p>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'dashboard' && (
          <div className="bg-slate-900 rounded-lg p-8 border border-slate-700 text-center">
            <h2 className="text-xl font-semibold mb-2 capitalize">{activeTab}</h2>
            <p className="text-slate-400">Module coming in MVP. Architecture is ready.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-4 text-center text-sm text-slate-500">
        LocksmithPrep v0.1.0-alpha — Not affiliated with ALOA. For study purposes only.
      </footer>
    </div>
  )
}
