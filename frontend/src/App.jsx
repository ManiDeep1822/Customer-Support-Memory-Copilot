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
  const handleSelectTicket = async (id, force = false) => {
    if (!id) return;
    setSelectedId(id);
    selectedIdRef.current = id;
    activeRequestIdRef.current = id;

    // 1. Instant Cache Check for Ticket Detail (0ms) - skip if force
    if (!force && ticketCacheRef.current[id]) {
      setTicketDetail(ticketCacheRef.current[id]);
    }

    // 2. Instant Cache Check for Memory (0ms) - skip if force
    if (!force && memoryCacheRef.current[id]) {
      setRecalledItems(memoryCacheRef.current[id]);
      setMemoryLoading(false);
    } else {
      if (force) setRecalledItems([]);
      setMemoryLoading(true);
    }

    // 3. Parallel fetch detail & memory simultaneously for maximum speed
    const cacheBuster = force ? `?t=${Date.now()}` : '';
    const detailPromise = fetch(`/api/tickets/${id}${cacheBuster}`)
      .then(res => res.ok ? res.json() : null)
      .then(detail => {
        if (detail && activeRequestIdRef.current === id) {
          ticketCacheRef.current[id] = detail;
          setTicketDetail(prev => ({
            ...detail,
            risk_profile: prev?.risk_profile || detail.risk_profile,
            frustration_trajectory: prev?.frustration_trajectory || detail.frustration_trajectory,
            action_recommendation: prev?.action_recommendation || detail.action_recommendation
          }));
        }
      })
      .catch(err => console.error("Failed to load ticket detail:", err));

    const memoryPromise = fetch(`/api/tickets/${id}/memory${cacheBuster}`)
      .then(res => res.ok ? res.json() : null)
      .then(mem => {
        if (mem && activeRequestIdRef.current === id) {
          const items = mem.recalled_items || [];
          memoryCacheRef.current[id] = items;
          setRecalledItems(items);
          if (mem.risk_profile) {
            setTicketDetail(prev => (prev && activeRequestIdRef.current === id) ? {
              ...prev,
              risk_profile: mem.risk_profile,
              frustration_trajectory: mem.frustration_trajectory || prev.frustration_trajectory,
              action_recommendation: mem.action_recommendation || prev.action_recommendation
            } : prev);
          }
        }
      })
      .catch(memErr => console.error("Memory load error:", memErr))
      .finally(() => {
        if (activeRequestIdRef.current === id) {
          setMemoryLoading(false);
        }
      });

    await Promise.allSettled([detailPromise, memoryPromise]);
  };

  // Fetch ticket queue on mount or user reload
  const fetchTickets = async (forceRefresh = false) => {
    setLoading(true);
    if (forceRefresh) {
      ticketCacheRef.current = {};
      memoryCacheRef.current = {};
    }
    try {
      const cacheBuster = forceRefresh ? `?t=${Date.now()}` : '';
      const res = await fetch(`/api/tickets${cacheBuster}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        const currentActive = selectedIdRef.current;
        if (data.length > 0) {
          if (!currentActive) {
            handleSelectTicket(data[0].customer_id);
          } else if (forceRefresh) {
            await handleSelectTicket(currentActive, true);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      if (forceRefresh) {
        setTimeout(() => setLoading(false), 350);
      } else {
        setLoading(false);
      }
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
        if (data.action_recommendation) {
          setTicketDetail(prev => (prev && selectedId) ? { ...prev, action_recommendation: data.action_recommendation } : prev);
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
            risk_profile: data.updated_risk_profile,
            frustration_trajectory: data.frustration_trajectory || prev.frustration_trajectory,
            action_recommendation: data.action_recommendation || prev.action_recommendation
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
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans antialiased overflow-hidden select-none">
      {/* Top Navbar — Prominent Authentic Amazon Customer Service Navigation Banner (Fixed 56px) */}
      <header className="h-14 bg-[#131921] px-5 flex items-center justify-between flex-shrink-0 shadow-md z-30 text-white border-b border-slate-800 select-none sticky top-0">
        {/* Left: Official Amazon.in Customer Service Branding */}
        <div className="flex items-center gap-3">
          <AmazonLogo className="h-6 w-auto" dark={true} />
          <span className="text-slate-600 font-light text-xl">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight text-white font-sans uppercase">
              amazon customer service
            </span>
            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-400/30">
              Copilot Rep Desk
            </span>
          </div>
        </div>

        {/* Right: Partner Badges (Groq LPU + Hindsight Memory) */}
        <div className="flex items-center gap-3 text-xs">
          {/* Groq Enterprise Inference Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200">
            <GroqLogo className="w-3.5 h-3.5" />
            <span className="text-[11px]">
              Fast Inference: <strong className="font-semibold text-white">Groq LPU</strong>
            </span>
          </div>

          {/* Hindsight Persistent Memory System Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
            memoryEnabled 
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            <HindsightLogo className="w-3.5 h-3.5" />
            <span>Hindsight Memory: {memoryEnabled ? 'Active' : 'Bypassed'}</span>
          </div>
        </div>
      </header>

      {/* Main 3-Column Split Pane — Fixed, Non-Stretchable, Non-Draggable Layout */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-3.5rem)]">
        {/* Left Column: Ticket Queue (Fixed 320px Width) */}
        <aside className="w-80 flex-shrink-0 h-full flex flex-col min-w-[320px] max-w-[320px] bg-white border-r border-slate-200 overflow-hidden z-10">
          <TicketList
            tickets={tickets}
            selectedId={selectedId}
            onSelectTicket={handleSelectTicket}
            loading={loading}
            onRefresh={() => fetchTickets(true)}
            widthClass="w-full"
          />
        </aside>

        {/* Center Column: Active Conversation & Reply Generator (Fluid min-w-0, non-stretchable) */}
        <main className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden min-w-0 border-r border-slate-200 z-10">
          {ticketDetail ? (
            <>
              {/* Proactive Escalation Banner (SRS FR-9) */}
              <div className="flex-shrink-0">
                <EscalationBanner 
                  riskProfile={ticketDetail.risk_profile} 
                  memoryEnabled={memoryEnabled} 
                />
              </div>

              {/* Upper Section: Conversation Thread (flex-1 min-h-0 scrollable) */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <ConversationThread
                  customer={ticketDetail.customer}
                  threads={ticketDetail.threads}
                  heldOutThread={ticketDetail.customer?.held_out_thread}
                />
              </div>

              {/* Lower Section: Reply Drafting Composer (flex-shrink-0, sticky bottom) */}
              <div className="flex-shrink-0 border-t border-slate-200 bg-white z-20">
                <ResponseGenerator
                  customerId={selectedId}
                  incomingMessage={currentIncomingMsg}
                  memoryEnabled={memoryEnabled}
                  onToggleMemory={() => setMemoryEnabled(!memoryEnabled)}
                  onGenerateResponse={handleGenerateResponse}
                  generating={generating}
                  onMessageSent={handleSendMessage}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <AmazonEmblem className="w-8 h-8 opacity-40" />
              <span>Select a customer ticket from the queue to view history and draft replies</span>
            </div>
          )}
        </main>

        {/* Right Column: Live Agent Memory Panel (Fixed 410px Width) */}
        <aside className="w-[410px] flex-shrink-0 h-full flex flex-col min-w-[410px] max-w-[410px] bg-white overflow-hidden z-10">
          <AgentMemoryPanel
            customerId={selectedId}
            memoryEnabled={memoryEnabled}
            recalledItems={recalledItems}
            riskProfile={ticketDetail?.risk_profile}
            frustrationTrajectory={ticketDetail?.frustration_trajectory}
            actionRecommendation={ticketDetail?.action_recommendation}
            onResolveTicket={handleResolveTicket}
            memoryLoading={memoryLoading}
          />
        </aside>
      </div>
    </div>
  );
}
