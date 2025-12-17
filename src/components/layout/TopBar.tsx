'use client';

export default function TopBar() {
  return (
    <header className="h-12 border-b border-slate-700 bg-slate-900 flex items-center justify-between px-6">
      {/* Left: Branding */}
      <div className="flex items-center">
        <h1 className="text-sm font-semibold text-slate-100">PatternPAL Pro</h1>
      </div>

      {/* Right: Help and Upgrade */}
      <div className="flex items-center gap-3">
        <button className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors">
          Help
        </button>
        <button 
          className="text-xs font-medium text-white px-4 py-1.5 rounded-md transition-colors"
          style={{ backgroundColor: '#f1737c' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e05a65'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1737c'}
        >
          Upgrade
        </button>
      </div>
    </header>
  );
}


