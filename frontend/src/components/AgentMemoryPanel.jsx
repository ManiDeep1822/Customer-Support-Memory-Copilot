import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckSquare, 
  Loader2, 
  Sparkles, 
  Pin, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap, 
  ArrowRight, 
  CornerDownRight,
  Lightbulb,
  Info,
  Package,
  AlertTriangle,
  Mail,
  CheckCircle2
} from 'lucide-react';
import { HindsightLogo } from './BrandLogos';

export default function AgentMemoryPanel({ 
  customerId, 
  memoryEnabled, 
  recalledItems, 
  riskProfile, 
  frustrationTrajectory,
  actionRecommendation,
  onResolveTicket,
  memoryLoading = false
}) {
  const [resolving, setResolving] = useState(false);
  const [resolveSuccess, setResolveSuccess] = useState(false);

  // MemGPT Core Memory Buffer State
  const [coreFacts, setCoreFacts] = useState([]);
  const [showAddFact, setShowAddFact] = useState(false);
  const [newFactText, setNewFactText] = useState('');
  const [newFactCategory, setNewFactCategory] = useState('Preference');
  const [addingFact, setAddingFact] = useState(false);


  // Fetch Core Memory Pinned Facts when customer changes
  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/tickets/${customerId}/core-memory`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setCoreFacts(data))
      .catch(err => console.error("Error fetching core memory:", err));
  }, [customerId]);

  const handleAddFact = async (textToAdd = null, catToAdd = null) => {
    const text = textToAdd || newFactText.trim();
    const category = catToAdd || newFactCategory;
    if (!text || !customerId) return;

    setAddingFact(true);
    try {
      const res = await fetch(`/api/tickets/${customerId}/core-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, category })
      });
      if (res.ok) {
        const updated = await res.json();
        setCoreFacts(updated);
        setNewFactText('');
        setShowAddFact(false);
      }
    } catch (err) {
      console.error("Error adding core memory fact:", err);
    } finally {
      setAddingFact(false);
    }
  };

  const handleDeleteFact = async (factId) => {
    if (!customerId || !factId) return;
    try {
      const res = await fetch(`/api/tickets/${customerId}/core-memory/${factId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const updated = await res.json();
        setCoreFacts(updated);
      }
    } catch (err) {
      console.error("Error deleting core memory fact:", err);
    }
  };

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
      <div className="w-full h-full bg-white border-l border-slate-200 p-6 flex flex-col items-center justify-center text-center text-slate-500 overflow-y-auto">
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
    <div className="w-full bg-white flex flex-col h-full overflow-hidden">
      {/* Header with Authentic Hindsight Enterprise Logo — Fixed Navbar */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white flex-shrink-0 sticky top-0 z-10">
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

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 min-h-0">
        {/* Feature 2: Memory-Grounded Support Action Recommendation Card */}
        {actionRecommendation && (() => {
          const isEscalate = actionRecommendation.action_type === 'escalate_manager' || actionRecommendation.action_type === 'issue_goodwill';
          const isWatch = actionRecommendation.action_type === 'verify_details';

          const cardStyle = isEscalate 
            ? 'bg-red-50/90 border-red-300' 
            : isWatch 
            ? 'bg-amber-50/90 border-amber-300' 
            : 'bg-emerald-50/90 border-emerald-300';

          const headerBorder = isEscalate ? 'border-red-200' : isWatch ? 'border-amber-200' : 'border-emerald-200';
          const iconColor = isEscalate ? 'text-red-600 fill-red-500' : isWatch ? 'text-amber-600 fill-amber-500' : 'text-emerald-600 fill-emerald-500';
          const titleColor = isEscalate ? 'text-red-950' : isWatch ? 'text-amber-950' : 'text-emerald-950';
          const matchBadge = isEscalate ? 'bg-red-200 text-red-950' : isWatch ? 'bg-amber-200 text-amber-950' : 'bg-emerald-200 text-emerald-950';
          const headlineColor = isEscalate ? 'text-red-900' : isWatch ? 'text-amber-900' : 'text-emerald-900';
          const actionBoxBorder = isEscalate ? 'border-red-200' : isWatch ? 'border-amber-200' : 'border-emerald-200';
          const actionLabelColor = isEscalate ? 'text-red-800' : isWatch ? 'text-amber-800' : 'text-emerald-800';
          const actionIconColor = isEscalate ? 'text-red-600' : isWatch ? 'text-amber-600' : 'text-emerald-600';
          const rationaleBg = isEscalate ? 'bg-red-100/50 border-red-200' : isWatch ? 'bg-amber-100/50 border-amber-200' : 'bg-emerald-100/50 border-emerald-200';
          const rationaleTitle = isEscalate ? 'text-red-900' : isWatch ? 'text-amber-900' : 'text-emerald-900';

          return (
            <div className={`${cardStyle} border rounded-lg p-3.5 space-y-2.5 shadow-xs animate-fade-in`}>
              <div className={`flex items-center justify-between border-b ${headerBorder} pb-2 gap-2`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Zap className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0 animate-pulse`} />
                  <span className={`text-xs font-bold ${titleColor} uppercase tracking-wide truncate`}>
                    Action Recommendation
                  </span>
                </div>
                <span className={`text-[10px] ${matchBadge} font-bold px-2 py-0.5 rounded font-mono whitespace-nowrap flex-shrink-0`}>
                  {Math.round((actionRecommendation.confidence || 0.94) * 100)}% Match
                </span>
              </div>

              <div className={`text-xs font-bold ${headlineColor} leading-snug`}>
                {actionRecommendation.headline}
              </div>

              {/* Recommended Agent Action (What to do next) */}
              <div className={`bg-white border ${actionBoxBorder} rounded-md p-2.5 space-y-1 text-xs shadow-2xs`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${actionLabelColor} flex items-center gap-1`}>
                  <CornerDownRight className={`w-3 h-3 ${actionIconColor}`} />
                  Recommended Next Agent Action:
                </span>
                <p className="font-bold text-slate-900 leading-relaxed">
                  {actionRecommendation.recommended_action}
                </p>
              </div>

              {/* Memory Rationale */}
              <div className={`${rationaleBg} border rounded-md p-2 text-[11px] text-slate-800 space-y-0.5`}>
                <span className={`text-[10px] font-bold ${rationaleTitle} uppercase tracking-wider flex items-center gap-1`}>
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 inline" />
                  Memory & Frustration Rationale:
                </span>
                <p className="leading-relaxed font-normal">{actionRecommendation.rationale}</p>
              </div>

              <span className="text-[10px] text-slate-500 italic flex items-center gap-1 pt-0.5">
                <Info className="w-3 h-3 text-slate-400 inline flex-shrink-0" />
                Support representative retains full control. Action recommendation is advisory prior to dispatching reply.
              </span>
            </div>
          );
        })()}

        {/* Feature 1: Multi-Session Frustration Trajectory Card */}
        {frustrationTrajectory && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 min-w-0 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="truncate">Frustration Trajectory</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${
                frustrationTrajectory.overall_trend === 'increasing'
                  ? 'bg-red-100 text-red-800 border-red-300'
                  : frustrationTrajectory.overall_trend === 'decreasing'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {frustrationTrajectory.overall_trend === 'increasing' ? (
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-red-600 flex-shrink-0" />
                    <span>Increasing Frustration</span>
                  </span>
                ) : frustrationTrajectory.overall_trend === 'decreasing' ? (
                  <span className="inline-flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>Decreasing Frustration</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Minus className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    <span>Stable Frustration</span>
                  </span>
                )}
              </span>
            </div>

            {/* Overall Frustration Meter */}
            <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-xs space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600 font-medium">Current Frustration Level:</span>
                <span className={`font-bold uppercase ${
                  frustrationTrajectory.current_frustration_level === 'Critical' ? 'text-red-700' :
                  frustrationTrajectory.current_frustration_level === 'High' ? 'text-amber-700' : 'text-slate-900'
                }`}>
                  {frustrationTrajectory.current_frustration_level} ({frustrationTrajectory.current_frustration_score}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    frustrationTrajectory.current_frustration_score >= 80 ? 'bg-red-600' :
                    frustrationTrajectory.current_frustration_score >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} 
                  style={{ width: `${frustrationTrajectory.current_frustration_score}%` }}
                />
              </div>
            </div>

            {/* Step-by-Step Session Progression Timeline */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Session Progression History:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar">
                {frustrationTrajectory.sessions?.map((s, idx) => (
                  <React.Fragment key={s.session_id}>
                    <div 
                      title={s.summary_reason}
                      className={`p-2 rounded-md border text-center flex-shrink-0 min-w-[95px] shadow-2xs ${
                        s.frustration_level === 'Critical' ? 'bg-red-50 text-red-950 border-red-300' :
                        s.frustration_level === 'High' ? 'bg-amber-50 text-amber-950 border-amber-300' :
                        s.frustration_level === 'Medium' ? 'bg-yellow-50 text-yellow-950 border-yellow-300' :
                        'bg-emerald-50 text-emerald-950 border-emerald-300'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-800 truncate">{s.session_label}</div>
                      <div className="text-xs font-extrabold font-mono mt-0.5">{s.frustration_score}%</div>
                      <div className="text-[9px] font-semibold uppercase opacity-80">{s.frustration_level}</div>
                    </div>
                    {idx < frustrationTrajectory.sessions.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MemGPT Core Memory Buffer (Working Memory Pinned Facts) Card */}
        <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Pin className="w-3.5 h-3.5 text-amber-700 fill-amber-500 flex-shrink-0" />
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wide truncate">
                Core Memory
              </span>
              <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded font-mono whitespace-nowrap flex-shrink-0">
                MemGPT
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddFact(!showAddFact)}
              className="text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-0.5 rounded flex items-center gap-1 transition whitespace-nowrap flex-shrink-0 shadow-2xs"
            >
              <Plus className="w-3 h-3" />
              <span>{showAddFact ? 'Cancel' : 'Pin Fact'}</span>
            </button>
          </div>

          <p className="text-[11px] text-amber-850 leading-tight">
            High-priority customer constraints pinned directly into LLM copilot prompt header:
          </p>

          {/* Fact Tags List */}
          <div className="space-y-1.5 pt-1">
            {coreFacts.length === 0 ? (
              <span className="text-[11px] text-amber-700 italic block">No core facts pinned yet. Click 'Pin Fact' to add custom constraints.</span>
            ) : (
              coreFacts.map(fact => (
                <div 
                  key={fact.id}
                  className="bg-white border border-amber-300 rounded p-2 flex items-start justify-between gap-2 shadow-2xs group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                        {fact.category || 'Constraint'}
                      </span>
                      {fact.timestamp && <span className="text-[9px] text-slate-400 font-mono">{fact.timestamp}</span>}
                    </div>
                    <p className="text-xs font-medium text-slate-900 leading-snug">{fact.text}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteFact(fact.id)}
                    className="text-slate-400 hover:text-red-600 p-0.5 transition"
                    title="Unpin fact from Core Memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Fact Form */}
          {showAddFact && (
            <div className="pt-2 border-t border-amber-200/90 space-y-2 animate-fade-in">
              <input
                type="text"
                placeholder="Enter customer preference or constraint..."
                value={newFactText}
                onChange={(e) => setNewFactText(e.target.value)}
                className="w-full bg-white border border-amber-300 rounded px-2.5 py-1 text-xs text-slate-900 placeholder-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
              />
              
              <div className="flex items-center justify-between gap-2">
                <select
                  value={newFactCategory}
                  onChange={(e) => setNewFactCategory(e.target.value)}
                  className="bg-white text-xs text-slate-800 border border-amber-300 rounded px-2 py-0.5 focus:outline-none"
                >
                  <option value="Preference">Preference</option>
                  <option value="Packaging Issue">Packaging Issue</option>
                  <option value="Escalation Risk">Escalation Risk</option>
                  <option value="Service Quality">Service Quality</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleAddFact()}
                  disabled={addingFact || !newFactText.trim()}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded transition shadow-2xs disabled:opacity-50"
                >
                  {addingFact ? 'Pinning...' : 'Save to Core Memory'}
                </button>
              </div>

              {/* Quick Preset Pills */}
              <div className="pt-1 flex flex-wrap gap-1 text-[10px]">
                <span className="text-amber-800 font-semibold self-center mr-1">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleAddFact("Prime Tape Packaging Confusion", "Packaging Issue")}
                  className="bg-white border border-amber-300 text-amber-900 px-1.5 py-0.5 rounded hover:bg-amber-100 font-medium inline-flex items-center gap-1"
                >
                  <Package className="w-3 h-3 text-amber-800" />
                  Tape Confusion
                </button>
                <button
                  type="button"
                  onClick={() => handleAddFact("4 Contact Turns Without Resolution", "Escalation Risk")}
                  className="bg-white border border-amber-300 text-amber-900 px-1.5 py-0.5 rounded hover:bg-amber-100 font-medium inline-flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                  4 Escalations
                </button>
                <button
                  type="button"
                  onClick={() => handleAddFact("Prefers Email Notifications", "Preference")}
                  className="bg-white border border-amber-300 text-amber-900 px-1.5 py-0.5 rounded hover:bg-amber-100 font-medium inline-flex items-center gap-1"
                >
                  <Mail className="w-3 h-3 text-amber-800" />
                  Email Preference
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Customer Effort Trajectory & Opinion Card (Master Prompt §4) */}
        <div className={`border rounded-lg p-3.5 space-y-3 shadow-xs transition-all duration-500 ${
          resolveSuccess 
            ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400 shadow-md animate-pulse' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              Customer Effort Trajectory
            </span>
            {resolveSuccess ? (
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-200/80 px-2 py-0.5 rounded inline-flex items-center gap-1 animate-bounce">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                Reflected in Hindsight
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">Hindsight Opinion</span>
            )}
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

          {/* Function 3: Customer Distress & Churn Risk Gauge */}
          <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-xs space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500 font-medium">Customer Frustration Index:</span>
              <span className={`font-bold ${riskProfile?.sentiment_trend === 'declining' ? 'text-red-700' : 'text-emerald-700'}`}>
                {riskProfile?.sentiment_trend === 'declining' ? '88% (High Frustration)' : '24% (Low Frustration)'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500 font-medium">Recommended Tone:</span>
              <span className="font-semibold text-slate-900">
                {riskProfile?.sentiment_trend === 'declining' ? 'Empathetic & Direct Action' : 'Helpful & Standard'}
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

        {/* Recalled Memory Insights Header (SRS FR-6) */}
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

      {/* "Mark Resolved" Action Button (SRS FR-7, FR-8) — Fixed Footer */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex-shrink-0 sticky bottom-0 z-10">
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
