import React, { useState } from 'react';
import { Send, Check, Loader2 } from 'lucide-react';
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

  const handleGenerate = async () => {
    if (!incomingMessage) return;
    const response = await onGenerateResponse(incomingMessage, memoryEnabled);
    if (response) {
      setDraftText(response);
    }
  };

  // Clear composer draft when switching tickets
  React.useEffect(() => {
    setDraftText('');
    setSentSuccess(false);
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
        } else {
          setSending(false);
          return;
        }
      } catch (err) {
        console.error("Failed to generate response before sending:", err);
        setSending(false);
        return;
      }
    }

    // 1. Immediately append to chat transcript! (0ms)
    if (onMessageSent) {
      onMessageSent(textToSend);
    }

    // 2. Clear composer and show success badge immediately! (0ms)
    setDraftText('');
    setSentSuccess(true);
    setSending(false);
    setTimeout(() => setSentSuccess(false), 3500);

    // 3. Background retain into Hindsight (FR-12) — non-blocking!
    fetch(`/api/tickets/${customerId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToSend,
        memory_enabled: false
      })
    }).catch(err => console.error("Background retain error:", err));
  };

  return (
    <div className="bg-white border-t border-slate-200 p-4 space-y-3.5 shadow-sm">
      {/* Control bar: Memory Segmented Toggle + Generate CTA with Authentic Brand Logos */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Memory Toggle (SRS FR-3) */}
        <div className="flex items-center gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={memoryEnabled ? undefined : onToggleMemory}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                memoryEnabled 
                  ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300 font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HindsightLogo className="w-3.5 h-3.5" />
              <span>Memory ON (Hindsight)</span>
            </button>
            <button
              type="button"
              onClick={!memoryEnabled ? undefined : onToggleMemory}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                !memoryEnabled 
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-300 font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${!memoryEnabled ? 'bg-slate-400' : 'bg-transparent'}`} />
              <span>Memory OFF (Stateless)</span>
            </button>
          </div>
          <span className="text-xs text-slate-500 hidden md:inline">
            {memoryEnabled 
              ? 'Grounds responses in real Hindsight conversation history' 
              : 'Stateless turn: responds strictly to latest inquiry'}
          </span>
        </div>

        {/* Generate Copilot Draft with Amazon Emblem */}
        <button
          onClick={handleGenerate}
          disabled={generating || !incomingMessage}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold bg-[#FF9900] hover:bg-[#e88b00] text-slate-950 transition disabled:opacity-50 shadow-xs"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
          ) : (
            <AmazonEmblem className="w-4 h-4 rounded-xs" />
          )}
          <span>Generate Amazon Copilot Suggestion</span>
        </button>
      </div>

      {/* Response Drafting Area */}
      <div className="relative">
        <textarea
          rows={3}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Amazon Copilot suggested reply will appear here for review before sending..."
          className="w-full bg-white border border-slate-300 rounded-lg p-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 leading-relaxed resize-none shadow-xs font-normal"
        />

        <div className="flex items-center justify-between mt-2.5">
          <span className="text-xs text-slate-500">
            Rep can inspect and edit suggestion prior to dispatching
          </span>

          <button
            onClick={handleSend}
            disabled={sending || generating}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition shadow-xs ${
              sentSuccess 
                ? 'bg-emerald-600 text-white' 
                : 'bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50'
            }`}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : sentSuccess ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {sending 
                ? 'Sending & Retaining...' 
                : sentSuccess 
                  ? 'Sent & Retained in Memory!' 
                  : 'Send & Retain (FR-12)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
