import React, { useState, useEffect, useRef } from 'react';
import { AmazonLogo, AmazonEmblem, GroqLogo, HindsightLogo } from './components/BrandLogos';
import TicketList from './components/TicketList';
import ConversationThread from './components/ConversationThread';
import EscalationBanner from './components/EscalationBanner';
import ResponseGenerator from './components/ResponseGenerator';
import AgentMemoryPanel from './components/AgentMemoryPanel';

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [recalledItems, setRecalledItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Client-side cache refs for instant switching and race condition handling
  const ticketCacheRef = useRef({});
  const memoryCacheRef = useRef({});
  const activeRequestIdRef = useRef(null);
  const selectedIdRef = useRef(null);

  // Handle ticket selection with decoupled fast rendering and client caching
  const handleSelectTicket = async (id) => {
    if (!id) return;
    setSelectedId(id);
    selectedIdRef.current = id;
    activeRequestIdRef.current = id;

    // 1. Instant Cache Check for Ticket Detail (0ms)
    if (ticketCacheRef.current[id]) {
      setTicketDetail(ticketCacheRef.current[id]);
    }

    // 2. Instant Cache Check for Memory (0ms)
    if (memoryCacheRef.current[id]) {
      setRecalledItems(memoryCacheRef.current[id]);
      setMemoryLoading(false);
    } else {
      setRecalledItems([]);
      setMemoryLoading(true);
    }

    // 3. Fast Detail Fetch (20-40ms) — independent of slow cloud memory
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (res.ok && activeRequestIdRef.current === id) {
        const detail = await res.json();
        ticketCacheRef.current[id] = detail;
        setTicketDetail(detail);
      }
    } catch (err) {
      console.error("Failed to load ticket detail:", err);
    }

    // 4. Background Memory Fetch — non-blocking!
    try {
      const memRes = await fetch(`/api/tickets/${id}/memory`);
      if (memRes.ok && activeRequestIdRef.current === id) {
        const mem = await memRes.json();
        const items = mem.recalled_items || [];
        memoryCacheRef.current[id] = items;
        setRecalledItems(items);
        if (mem.risk_profile) {
          setTicketDetail(prev => (prev && activeRequestIdRef.current === id) ? { ...prev, risk_profile: mem.risk_profile } : prev);
        }
      }
    } catch (memErr) {
      console.error("Background memory load error:", memErr);
    } finally {
      if (activeRequestIdRef.current === id) {
        setMemoryLoading(false);
      }
    }
  };

  // Fetch ticket queue on mount
  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        if (data.length > 0 && !selectedIdRef.current) {
          handleSelectTicket(data[0].customer_id);
        }
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Handle Generate Suggestion (Groq + Hindsight)
  const handleGenerateResponse = async (text, memEnabled) => {
    if (!selectedId) return "";
    setGenerating(true);
    try {
      const res = await fetch(`/api/tickets/${selectedId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          memory_enabled: memEnabled
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.recalled_context) {
          setRecalledItems(data.recalled_context);
          if (selectedId) {
            memoryCacheRef.current[selectedId] = data.recalled_context;
          }
        }
        return data.agent_response;
      }
    } catch (err) {
      console.error("Error generating copilot draft:", err);
    } finally {
      setGenerating(false);
    }
    return "";
  };

  // Handle Message Sent (FR-12 optimistic chat transcript update and background retention)
  const handleSendMessage = (text) => {
    if (!text || !text.trim() || !selectedId) return;

    const newMsg = {
      role: 'brand',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    // 1. Immediately append reply to active conversation transcript in state (0ms)
    setTicketDetail(prev => {
      if (!prev) return prev;
      const currentHeldOut = prev.customer?.held_out_thread || {
        thread_id: 'thread_live',
        messages: []
      };

      const updatedHeldOut = {
        ...currentHeldOut,
        messages: [...(currentHeldOut.messages || []), newMsg]
      };

      const updated = {
        ...prev,
        customer: {
          ...prev.customer,
          held_out_thread: updatedHeldOut
        }
      };

      if (selectedId) {
        ticketCacheRef.current[selectedId] = updated;
      }

      return updated;
    });

    // 2. Background memory refresh for live retention (FR-12) — non-blocking!
    const targetId = selectedId;
    fetch(`/api/tickets/${targetId}/memory`)
      .then(res => res.ok ? res.json() : null)
      .then(mem => {
        if (mem && activeRequestIdRef.current === targetId) {
          const items = mem.recalled_items || [];
          setRecalledItems(items);
          memoryCacheRef.current[targetId] = items;
          if (mem.risk_profile) {
            setTicketDetail(prev => (prev && activeRequestIdRef.current === targetId) ? { ...prev, risk_profile: mem.risk_profile } : prev);
          }
        }
      })
      .catch(err => console.error("Background memory refresh error:", err));
  };

  // Handle Mark Resolved (SRS FR-7, FR-8) — responds in ~30-40ms
  const handleResolveTicket = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/tickets/${selectedId}/resolve`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        // Update local state with new risk profile immediately
        setTicketDetail(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            risk_profile: data.updated_risk_profile
          };
          if (selectedId) {
            ticketCacheRef.current[selectedId] = updated;
          }
          return updated;
        });

        // Update ticket in sidebar list
        setTickets(prev => prev.map(t => 
          t.customer_id === selectedId 
            ? { ...t, risk_level: data.updated_risk_profile.risk_level }
            : t
        ));

        // Background memory refresh — non-blocking!
        const targetId = selectedId;
        fetch(`/api/tickets/${targetId}/memory`)
          .then(r => r.ok ? r.json() : null)
          .then(mem => {
            if (mem && activeRequestIdRef.current === targetId) {
              const items = mem.recalled_items || [];
              setRecalledItems(items);
              memoryCacheRef.current[targetId] = items;
            }
          })
          .catch(e => console.error("Background memory refresh error after resolve:", e));
      }
    } catch (err) {
      console.error("Error resolving ticket:", err);
    }
  };

  // Get latest incoming customer message for drafting
  const heldOutMsgs = ticketDetail?.customer?.held_out_thread?.messages || [];
  const currentIncomingMsg = [...heldOutMsgs].reverse().find(m => m.role === 'customer')?.text
    || [...(ticketDetail?.threads?.slice(-1)[0]?.messages || [])].reverse().find(m => m.role === 'customer')?.text
    || "I am waiting for an update on my package.";

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans antialiased">
      {/* Top Navbar — Authentic Enterprise Branding Bar */}
      <header className="h-14 border-b border-slate-200 bg-white px-5 flex items-center justify-between flex-shrink-0 shadow-sm z-10">
        {/* Left: Official Amazon Customer Service Branding */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2">
            <AmazonLogo className="h-5 w-auto" />
            <span className="text-slate-300 font-light text-lg">|</span>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight text-slate-900 uppercase">
                Customer Support Desk
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                AmazonHelp Copilot Workbench
              </span>
            </div>
          </div>
        </div>

        {/* Right: Official Enterprise Partner Badges */}
        <div className="flex items-center gap-3 text-xs">
          {/* Groq Enterprise Inference Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 shadow-xs">
            <GroqLogo className="w-4 h-4" />
            <span className="text-xs">
              Fast Inference: <strong className="font-semibold text-slate-900">Groq LPU</strong>
            </span>
          </div>

          {/* Hindsight Persistent Memory System Badge */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold border transition-colors shadow-xs ${
            memoryEnabled 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            <HindsightLogo className="w-4 h-4" />
            <span>Hindsight Memory: {memoryEnabled ? 'Active' : 'Bypassed'}</span>
          </div>
        </div>
      </header>

      {/* Main 3-Column Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Ticket Queue */}
        <TicketList
          tickets={tickets}
          selectedId={selectedId}
          onSelectTicket={handleSelectTicket}
          loading={loading}
          onRefresh={fetchTickets}
        />

        {/* Center Column: Active Conversation & Reply Generator */}
        <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden border-r border-slate-200">
          {ticketDetail ? (
            <>
              {/* Proactive Escalation Banner (SRS FR-9) */}
              <EscalationBanner 
                riskProfile={ticketDetail.risk_profile} 
                memoryEnabled={memoryEnabled} 
              />

              {/* Conversation History & Incoming Ticket */}
              <ConversationThread
                customer={ticketDetail.customer}
                threads={ticketDetail.threads}
                heldOutThread={ticketDetail.customer?.held_out_thread}
              />

              {/* Reply Drafting Composer with Memory Toggle */}
              <ResponseGenerator
                customerId={selectedId}
                incomingMessage={currentIncomingMsg}
                memoryEnabled={memoryEnabled}
                onToggleMemory={() => setMemoryEnabled(!memoryEnabled)}
                onGenerateResponse={handleGenerateResponse}
                generating={generating}
                onMessageSent={handleSendMessage}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <AmazonEmblem className="w-8 h-8 opacity-40" />
              <span>Select a customer ticket from the queue to view history and draft replies</span>
            </div>
          )}
        </main>

        {/* Right Column: Live Agent Memory Panel */}
        <AgentMemoryPanel
          customerId={selectedId}
          memoryEnabled={memoryEnabled}
          recalledItems={recalledItems}
          riskProfile={ticketDetail?.risk_profile}
          onResolveTicket={handleResolveTicket}
          memoryLoading={memoryLoading}
        />
      </div>
    </div>
  );
}
