import React from 'react';
import { Zap, RefreshCw, Plus, ExternalLink } from 'lucide-react';

interface NavbarProps {
  backendHealthy: boolean | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onCreateClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  backendHealthy,
  onRefresh,
  isRefreshing,
  onCreateClick,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-brand-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">FlowPilot</span>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">AI Workflow Automation Platform</p>
            </div>
          </div>

          {/* Right actions: Backend status, Docs, Refresh, Create */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Backend status pill */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                backendHealthy === true
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : backendHealthy === false
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title={
                backendHealthy === true
                  ? 'FastAPI backend is online'
                  : backendHealthy === false
                  ? 'Backend unreachable at http://127.0.0.1:8000'
                  : 'Checking backend...'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendHealthy === true
                    ? 'bg-emerald-500'
                    : backendHealthy === false
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
                }`}
              />
              <span className="hidden md:inline">
                {backendHealthy === true
                  ? 'API Connected'
                  : backendHealthy === false
                  ? 'API Offline'
                  : 'Connecting...'}
              </span>
            </div>

            {/* API Docs Link */}
            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center space-x-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <span>API Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
              title="Refresh Workflows"
              aria-label="Refresh Workflows"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-600' : ''}`} />
            </button>

            {/* Create New Workflow Button */}
            <button
              onClick={onCreateClick}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-medium rounded-lg shadow-sm shadow-brand-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workflow</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
