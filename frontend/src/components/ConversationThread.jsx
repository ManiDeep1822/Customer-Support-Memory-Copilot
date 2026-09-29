import React, { useState, useRef, useEffect } from 'react';
import { History, ChevronDown, ChevronRight, MessageSquare, Clock, Check, ArrowUpDown, Search, X, Package } from 'lucide-react';
import { AmazonEmblem, CustomerAvatar } from './BrandLogos';

export default function ConversationThread({ customer, threads, heldOutThread }) {
  const [expandedThreads, setExpandedThreads] = useState({});
  const [threadSearchTerm, setThreadSearchTerm] = useState('');
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
  const isMatched = threadSearchTerm.trim() && msg.text.toLowerCase().includes(threadSearchTerm.trim().toLowerCase());
  return (
    <div 
      key={index} 
      className={`w-full rounded-lg p-4 transition-all ${
        isMatched
          ? 'bg-amber-100/90 border-2 border-amber-500 shadow-md ring-2 ring-amber-400'
          : isCustomer 
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

      {/* Message Content — 14px High-Contrast Body with Search Keyword Highlighting */}
      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
        {highlightMatch(msg.text, threadSearchTerm.trim())}
      </p>
    </div>
  );
};

// Calculate total search matches across past and active threads
const totalMatches = React.useMemo(() => {
  if (!threadSearchTerm.trim()) return 0;
  const term = threadSearchTerm.trim().toLowerCase();
  let count = 0;
  (threads || []).forEach(t => {
    (t.messages || []).forEach(m => {
      if (m.text && m.text.toLowerCase().includes(term)) count++;
    });
  });
  (heldOutThread?.messages || []).forEach(m => {
    if (m.text && m.text.toLowerCase().includes(term)) count++;
  });
  return count;
}, [threads, heldOutThread, threadSearchTerm]);

// Helper to highlight matching text
const highlightMatch = (text, term) => {
  if (!term || !text) return text;
  try {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 text-amber-950 font-bold px-0.5 rounded shadow-2xs">
          {part}
        </mark>
      ) : (
        part
      )
    );
  } catch {
    return text;
  }
};

return (
  <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
    {/* Fixed Top Sub-Navbar (Solid, Non-Floating, Never Overlaps or Drifts) */}
    <div className="flex-shrink-0 px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs z-10 shadow-2xs">
      <span className="flex items-center gap-1.5 font-semibold text-slate-700 text-xs">
        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
        <span>Conversation History ({threads?.length || 0} historical threads + active ticket)</span>
      </span>

      {/* Live Past Thread Keyword Search */}
      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 focus-within:ring-1 focus-within:ring-amber-500 focus-within:border-amber-500">
        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search past threads..."
          value={threadSearchTerm}
          onChange={(e) => setThreadSearchTerm(e.target.value)}
          className="bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none w-36 sm:w-44 font-sans font-medium"
        />
        {threadSearchTerm && (
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              totalMatches > 0 ? 'bg-amber-200 text-amber-950' : 'bg-slate-200 text-slate-600'
            }`}>
              {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
            </span>
            <button 
              type="button"
              onClick={() => setThreadSearchTerm('')} 
              className="text-slate-400 hover:text-slate-700 font-bold" 
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Pure Scrollable Messages Body */}
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0">
      {/* Function 2: Live Order & Delivery Context Card */}
      {(() => {
        const order = customer?.order_details || {
          order_id: `302-${customer?.customer_id ? customer.customer_id.replace('cust_', '') : '8819'}-4471`,
          item_name: 'Wireless Noise-Canceling Headset (Black)',
          price: '$149.99',
          membership_tier: 'Amazon Prime',
          tracking_status: 'Out for Delivery (Delayed - 3 Days Past SLA)'
        };
        const isDelayed = order.tracking_status.includes('Delay') || order.tracking_status.includes('Damaged') || order.tracking_status.includes('Pending') || order.tracking_status.includes('Inquiry');
        const isDelivered = order.tracking_status.includes('Delivered') && !isDelayed;

        return (
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-800" />
                <span>Order Details</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    Order #{order.order_id}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    order.membership_tier === 'Amazon Prime' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {order.membership_tier}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Item: {order.item_name} • {order.price}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500 font-medium">Tracking Status:</span>
              <span className={`px-2.5 py-1 rounded-md font-semibold ${
                isDelayed
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : isDelivered
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {order.tracking_status}
              </span>
            </div>
          </div>
        );
      })()}

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
              // Auto-expand thread if search matches any message inside it
              const hasSearchMatch = threadSearchTerm.trim() && t.messages?.some(m => m.text?.toLowerCase().includes(threadSearchTerm.trim().toLowerCase()));
              const isExpanded = hasSearchMatch ? true : (expandedThreads[t.thread_id] ?? (idx === threads.length - 1));
              const matchCount = threadSearchTerm.trim() 
                ? t.messages.filter(m => m.text?.toLowerCase().includes(threadSearchTerm.trim().toLowerCase())).length
                : 0;

              return (
                <div 
                  key={t.thread_id} 
                  className={`bg-white border rounded-lg shadow-xs overflow-hidden transition-all ${
                    hasSearchMatch ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
                  }`}
                >
                  <button
                    onClick={() => toggleThread(t.thread_id)}
                    className="w-full px-4 py-3 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between text-xs text-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
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
                      {matchCount > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                        </span>
                      )}
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
  </div>
);
}
