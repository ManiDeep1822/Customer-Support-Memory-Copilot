import React, { useState } from 'react';
import { Activity, CheckSquare, Loader2, Sparkles } from 'lucide-react';
import { HindsightLogo } from './BrandLogos';

export default function AgentMemoryPanel({ 
  customerId, 
  memoryEnabled, 
  recalledItems, 
  riskProfile, 
  onResolveTicket,
  memoryLoading = false
}) {
  const [resolving, setResolving] = useState(false);
  const [resolveSuccess, setResolveSuccess] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onResolveTicket();
      setResolveSuccess(true);
      setTimeout(() => setResolveSuccess(false), 3500);
    } catch (err) {
      console.error("Failed to resolve ticket:", err);
    } finally {
      setResolving(false);
    }
  };

  if (!memoryEnabled) {
    return (
      <div className="w-[360px] flex-shrink-0 bg-white border-l border-slate-200 p-6 flex flex-col items-center justify-center text-center text-slate-500">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3 border border-slate-200">
          <HindsightLogo className="w-6 h-6 opacity-40" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Hindsight Memory Off</h3>
        <p className="text-xs mt-1.5 leading-relaxed text-slate-500 max-w-[220px]">
          Toggle <strong>Memory ON</strong> to retrieve real-time Hindsight customer experiences, effort trajectory, and confidence signals.
        </p>
      </div>
    );
  }

  const confidencePct = Math.round((riskProfile?.confidence || 0.8) * 100);

  return (
    <div className="w-[360px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full">
      {/* Header with Authentic Hindsight Enterprise Logo */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <HindsightLogo className="w-5 h-5 shadow-xs flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide truncate">
              Hindsight Intelligence
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Temporal Memory Bank</p>
          </div>
        </div>
        {memoryLoading ? (
          <span className="flex-shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
            <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
            Recalling...
          </span>
        ) : (
          <span className="flex-shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active Recall
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Customer Effort Trajectory & Opinion Card (Master Prompt §4) */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              Customer Effort Trajectory
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Hindsight Opinion</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Contacts</span>
              <span className="text-sm font-bold text-slate-900">
                {riskProfile?.contact_count_this_issue || 1} turns
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Sentiment</span>
              <span className={`text-xs font-bold uppercase ${
                riskProfile?.sentiment_trend === 'declining' ? 'text-red-700' : 'text-emerald-700'
              }`}>
                {riskProfile?.sentiment_trend || 'stable'}
              </span>
            </div>
          </div>

          {/* Confidence Meter */}
          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Risk Confidence</span>
              <span className="font-mono font-bold text-slate-900">{confidencePct}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-200/80">
            <span className="text-slate-600 font-medium">Risk Level:</span>
            <span className={`font-bold uppercase text-[11px] px-2.5 py-0.5 rounded ${
              riskProfile?.risk_level === 'escalate'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : riskProfile?.risk_level === 'watch'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              {riskProfile?.risk_level || 'normal'}
            </span>
          </div>
        </div>

        {/* Recalled Memory Insights (SRS FR-6) */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Recalled Memory Insights ({recalledItems?.length || 0})
          </h3>

          <div className="space-y-2">
            {memoryLoading ? (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-6 bg-slate-50 rounded-lg border border-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Recalling customer memories...</span>
              </div>
            ) : !recalledItems || recalledItems.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                No past memories found for this customer.
              </div>
            ) : (
              recalledItems.map((item, idx) => (
                <div 
                  key={idx} 
                  className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 shadow-xs hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      item.type === 'opinion' 
                        ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {item.type}
                    </span>
                    {item.confidence && (
                      <span className="text-slate-500 font-mono text-[11px]">
                        {(item.confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-normal">
                    {item.summary}
                  </p>
                  {item.timestamp && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      Timestamp: {item.timestamp}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* "Mark Resolved" Action Button (SRS FR-7, FR-8) */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50">
        <button
          onClick={handleResolve}
          disabled={resolving}
          className={`w-full py-2.5 px-3 rounded-md text-xs font-bold text-white flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-xs ${
            resolveSuccess 
              ? 'bg-emerald-700 ring-2 ring-emerald-400' 
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {resolving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : resolveSuccess ? (
            <CheckSquare className="w-4 h-4 text-emerald-200" />
          ) : (
            <CheckSquare className="w-4 h-4" />
          )}
          <span>
            {resolving 
              ? 'Reflecting in Hindsight...' 
              : resolveSuccess 
                ? 'Ticket Resolved & Reflected!' 
                : 'Mark Resolved (Trigger Reflect)'}
          </span>
        </button>
        <p className="text-[11px] text-slate-500 text-center mt-2 leading-tight">
          Reflects resolution into Hindsight & updates risk score.
        </p>
      </div>
    </div>
  );
}
