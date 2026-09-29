import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Check, Loader2, Zap, X, ShieldCheck, Star } from 'lucide-react';
import { AmazonEmblem, HindsightLogo } from './BrandLogos';

export default function ResponseGenerator({ 
  customerId, 
  incomingMessage, 
  memoryEnabled, 
  onToggleMemory, 
  onGenerateResponse, 
  generating,
  onMessageSent
}) {
  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Requirement 4: Customer Satisfaction & CSAT Feedback System (From Customer)
  const [csatRating, setCsatRating] = useState(5);
  const [customerComment, setCustomerComment] = useState('Customer satisfied with clear Prime branding explanation.');
  const [csatSubmitted, setCsatSubmitted] = useState(false);

  // Side-by-side comparison state
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compMemoryOff, setCompMemoryOff] = useState('');
  const [compMemoryOn, setCompMemoryOn] = useState('');
  const [draftGenerated, setDraftGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!incomingMessage) return;
    const response = await onGenerateResponse(incomingMessage, memoryEnabled);
    if (response) {
      setDraftText(response);
      setDraftGenerated(true);
    }
  };

  const handleCompare = async () => {
    if (!incomingMessage) return;
    setCompareModalOpen(true);
    setComparing(true);
    setCompMemoryOff('');
    setCompMemoryOn('');
    try {
      const [resOff, resOn] = await Promise.all([
        onGenerateResponse(incomingMessage, false),
        onGenerateResponse(incomingMessage, true)
      ]);
      setCompMemoryOff(resOff || '');
      setCompMemoryOn(resOn || '');
    } catch (err) {
      console.error("Comparison generation error:", err);
    } finally {
      setComparing(false);
    }
  };

  // Clear composer draft when switching tickets
  React.useEffect(() => {
    setDraftText('');
    setSentSuccess(false);
    setCompareModalOpen(false);
    setDraftGenerated(false);
  }, [customerId]);

  const handleSend = async () => {
    let textToSend = draftText.trim();

    // If composer is empty, automatically generate copilot suggestion first!
    if (!textToSend) {
      if (!incomingMessage) return;
      setSending(true);
      try {
        const response = await onGenerateResponse(incomingMessage, memoryEnabled);
        if (response && response.trim()) {
          textToSend = response.trim();
          setDraftGenerated(true);
        } else {
          setSending(false);
          return;
        }
      } catch (err) {
        console.error("Failed to generate response before sending:", err);
        setSending(false);
        return;
      }
    } else if (!draftGenerated && incomingMessage) {
      // If rep typed a custom reply without prior generation, trigger retention in background
      fetch(`/api/tickets/${customerId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: incomingMessage,
          memory_enabled: memoryEnabled
        })
      }).catch(err => console.error("Background retain error:", err));
    }

    // 1. Immediately append to chat transcript! (0ms)
    if (onMessageSent) {
      onMessageSent(textToSend);
    }

    // 2. Clear composer and show success badge immediately! (0ms)
    setDraftText('');
    setDraftGenerated(false);
    setSentSuccess(true);
    setSending(false);
    setTimeout(() => setSentSuccess(false), 3500);
  };

  return (
    <div className="bg-white border-t border-slate-200 px-4 py-2.5 space-y-2 shadow-sm">
      {/* Row 1: Memory Toggle + Policy Guardrail Indicator + Action CTAs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Memory Segmented Toggle & Policy Indicator */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200">
            <button
              type="button"
              onClick={memoryEnabled ? undefined : onToggleMemory}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                memoryEnabled 
                  ? 'bg-white text-emerald-900 shadow-2xs border border-emerald-300 font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HindsightLogo className="w-3.5 h-3.5" />
              <span>Memory ON</span>
            </button>
            <button
              type="button"
              onClick={!memoryEnabled ? undefined : onToggleMemory}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                !memoryEnabled 
                  ? 'bg-white text-slate-800 shadow-2xs border border-slate-300 font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${!memoryEnabled ? 'bg-slate-500' : 'bg-transparent'}`} />
              <span>Memory OFF</span>
            </button>
          </div>

          {/* Compact Inline Guardrail Indicator */}
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
            <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
            <span>Policy Compliant (FR-11)</span>
          </span>
        </div>

        {/* Right: Action Buttons (Compare & Generate) */}
        <div className="flex items-center gap-2">
          {/* Side-by-Side Comparison Feature */}
          <button
            type="button"
            onClick={handleCompare}
            disabled={comparing || !incomingMessage}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition disabled:opacity-50 shadow-2xs"
            title="Compare Memory OFF vs Memory ON responses side by side"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
            <span>Compare ON vs OFF</span>
          </button>

          {/* Generate Copilot Draft with Amazon Emblem */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !incomingMessage}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-[#FF9900] hover:bg-[#e88b00] text-slate-950 transition disabled:opacity-50 shadow-2xs"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
            ) : (
              <AmazonEmblem className="w-3.5 h-3.5 rounded-xs" />
            )}
            <span>Generate Suggestion</span>
          </button>
        </div>
      </div>

      {/* Row 2: Response Drafting Area (Compact 2-row textarea) */}
      <div className="relative">
        <textarea
          rows={2}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Amazon Copilot suggested reply will appear here for review before sending..."
          className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 leading-relaxed resize-none shadow-2xs font-normal"
        />
      </div>

      {/* Row 3: CSAT & Action Footer Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
        {/* Left: Compact Customer Satisfaction (CSAT) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-emerald-50/90 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-emerald-900 font-bold mr-1">CSAT:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setCsatRating(star)}
                className="transition-transform hover:scale-125"
                title={`Rate ${star} Star${star > 1 ? 's' : ''}`}
              >
                <Star className={`w-3 h-3 ${csatRating >= star ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
              </button>
            ))}
            <span className="text-slate-700 font-bold ml-1">{csatRating}/5</span>
          </div>

          <span className="text-[10px] text-slate-400 hidden xl:inline">
            Rep can inspect and edit suggestion prior to dispatching
          </span>
        </div>

        {/* Right: Send & Retain Action */}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || generating}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition shadow-xs ${
            sentSuccess 
              ? 'bg-emerald-600 text-white' 
              : 'bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50'
          }`}
        >
          {sending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : sentSuccess ? (
            <Check className="w-3.5 h-3.5 text-white" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>
            {sending 
              ? 'Sending...' 
              : sentSuccess 
                ? 'Sent & Retained!' 
                : 'Send & Retain (FR-12)'}
          </span>
        </button>
      </div>

      {/* Helper to format response text: sanitize handles & parse markdown bold */}
      {/* Side-by-Side Comparison Modal — Rendered into document.body via Portal to prevent any stacking context clipping */}
      {compareModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-[9999] animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setCompareModalOpen(false); }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Side-by-Side Copilot Memory Comparison</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Demonstrates how Hindsight memory alters the copilot response with real customer history</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setCompareModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-md hover:bg-slate-200 bg-slate-100 flex items-center gap-1 font-semibold transition"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 min-h-0">
              {comparing ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600 text-xs">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                  <span className="font-semibold text-slate-700">Generating both Memory OFF (Stateless) & Memory ON (Hindsight) responses...</span>
                  <span className="text-[11px] text-slate-400">Querying Groq LPU inference engine in parallel</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs items-stretch h-full">
                  {/* Memory OFF Card */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3 shadow-xs">
                    <div className="flex items-center justify-between font-bold text-slate-700 border-b border-slate-200 pb-2.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span className="text-xs font-bold text-slate-800">Memory OFF (Stateless)</span>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">SRS FR-4</span>
                    </div>
                    
                    <div className="flex-1 bg-white p-4 rounded-lg border border-slate-200 min-h-[220px] max-h-[50vh] overflow-y-auto shadow-inner text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                      {(() => {
                        if (!compMemoryOff) return "No memory response generated.";
                        let sanitized = compMemoryOff.replace(/@(\d+)/g, 'Customer #$1').replace(/@Customer/gi, 'Customer');
                        const parts = sanitized.split(/(\*\*.*?\*\*)/g);
                        return parts.map((part, index) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={index} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        });
                      })()}
                    </div>

                    <button
                      type="button"
                      onClick={() => { setDraftText(compMemoryOff); setDraftGenerated(true); setCompareModalOpen(false); }}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs transition mt-auto flex-shrink-0 shadow-xs"
                    >
                      Use Memory OFF Draft
                    </button>
                  </div>

                  {/* Memory ON Card */}
                  <div className="p-4 rounded-xl bg-emerald-50/70 border-2 border-emerald-400/80 flex flex-col justify-between space-y-3 shadow-xs">
                    <div className="flex items-center justify-between font-bold text-emerald-950 border-b border-emerald-200 pb-2.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <HindsightLogo className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs font-bold text-emerald-900">Memory ON (Hindsight Grounded)</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-mono font-bold">SRS FR-5</span>
                    </div>

                    <div className="flex-1 bg-white p-4 rounded-lg border border-emerald-200 min-h-[220px] max-h-[50vh] overflow-y-auto shadow-inner text-slate-900 leading-relaxed font-normal whitespace-pre-wrap">
                      {(() => {
                        if (!compMemoryOn) return "No hindsight response generated.";
                        let sanitized = compMemoryOn.replace(/@(\d+)/g, 'Customer #$1').replace(/@Customer/gi, 'Customer');
                        const parts = sanitized.split(/(\*\*.*?\*\*)/g);
                        return parts.map((part, index) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={index} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        });
                      })()}
                    </div>

                    <button
                      type="button"
                      onClick={() => { setDraftText(compMemoryOn); setDraftGenerated(true); setCompareModalOpen(false); }}
                      className="w-full py-2.5 bg-[#FF9900] hover:bg-[#e88b00] text-slate-950 font-bold rounded-lg shadow-xs transition mt-auto flex-shrink-0 text-xs border border-amber-600/30"
                    >
                      Use Memory ON Draft (Recommended)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
