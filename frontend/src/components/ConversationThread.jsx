import React, { useState, useRef, useEffect } from 'react';
import { History, ChevronDown, ChevronRight, MessageSquare, Clock, Check } from 'lucide-react';
import { AmazonEmblem, CustomerAvatar } from './BrandLogos';

export default function ConversationThread({ customer, threads, heldOutThread }) {
  const [expandedThreads, setExpandedThreads] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [heldOutThread?.messages?.length]);

  const toggleThread = (threadId) => {
    setExpandedThreads(prev => ({
      ...prev,
      [threadId]: !prev[threadId]
    }));
  };

  const renderMessageCard = (msg, index, isCurrent = false) => {
    const isCustomer = msg.role === 'customer';
    return (
      <div 
        key={index} 
        className={`w-full rounded-lg p-4 transition-all ${
          isCustomer 
            ? (isCurrent ? 'bg-white border-2 border-amber-300 shadow-sm' : 'bg-white border border-slate-200 shadow-xs')
            : 'bg-amber-50/50 border border-amber-200 shadow-xs'
        }`}
      >
        {/* Transcript Message Header with Authentic Enterprise Logos */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {isCustomer ? (
              <CustomerAvatar label={customer?.display_label || 'Customer'} className="w-7 h-7" />
            ) : (
              <AmazonEmblem className="w-7 h-7 flex-shrink-0 shadow-xs" />
            )}
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900">
                {isCustomer ? (customer?.display_label || 'Customer') : 'AmazonHelp Support Rep'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                isCustomer 
                  ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}>
                {isCustomer ? 'Verified Customer' : 'Official Amazon Agent'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{msg.timestamp || 'Recent'}</span>
          </div>
        </div>

        {/* Message Content — 14px High-Contrast Body */}
        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
          {msg.text}
        </p>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
      {/* Historical Threads Section */}
      {threads && threads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <History className="w-4 h-4 text-slate-500" />
              <span>Past Conversation History ({threads.length} threads in Hindsight)</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">Indexed Real Threads</span>
          </div>

          <div className="space-y-2.5">
            {threads.map((t, idx) => {
              const isExpanded = expandedThreads[t.thread_id] ?? (idx === threads.length - 1);
              return (
                <div 
                  key={t.thread_id} 
                  className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden"
                >
                  <button
                    onClick={() => toggleThread(t.thread_id)}
                    className="w-full px-4 py-3 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between text-xs text-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                      <span className="font-semibold text-slate-900">Historical Thread #{idx + 1}</span>
                      <span className="text-[11px] text-slate-500 font-mono">({t.thread_id})</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-medium">
                        {t.messages.length} messages
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{t.timestamp_start}</span>
                  </button>
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/50 space-y-3 border-t border-slate-200">
                      {t.messages.map((m, mIdx) => renderMessageCard(m, mIdx))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Held-out Current Thread Section (Live Incoming Demo Ticket) */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <span>Active Incoming Message (Live Ticket)</span>
          </div>
          {heldOutThread?.messages?.some(m => m.role === 'brand') ? (
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              Rep Replied & Retained (FR-12)
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              Awaiting Copilot Draft
            </span>
          )}
        </div>

        <div className="space-y-3">
          {heldOutThread?.messages && heldOutThread.messages.length > 0 ? (
            heldOutThread.messages.map((m, idx) => renderMessageCard(m, idx, true))
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
              No active incoming message in queue.
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
