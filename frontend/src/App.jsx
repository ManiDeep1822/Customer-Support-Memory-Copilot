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

  // Dynamic Layout & Resizable Frames State (Fixed 70px Header, Mouse Drag Column & Middle Splitters)
  const [queueWidth, setQueueWidth] = useState(320); // Width in px
  const [memoryWidth, setMemoryWidth] = useState(360); // Width in px
  const [threadHeightPercent, setThreadHeightPercent] = useState(55); // Height percentage of conversation vs composer
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingMiddle, setIsResizingMiddle] = useState(false);

  const mainRef = useRef(null);

  // Mouse Drag Handlers for Resizing Left Queue Frame
  const handleMouseDownLeft = (e) => {
    e.preventDefault();
    setIsResizingLeft(true);
  };

  // Mouse Drag Handlers for Resizing Right Memory Frame
  const handleMouseDownRight = (e) => {
    e.preventDefault();
    setIsResizingRight(true);
  };

  // Mouse Drag Handlers for Resizing Middle Vertical Frame
  const handleMouseDownMiddle = (e) => {
    e.preventDefault();
    setIsResizingMiddle(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft) {
        const newWidth = Math.max(220, Math.min(500, e.clientX));
        setQueueWidth(newWidth);
      } else if (isResizingRight) {
        const newWidth = Math.max(260, Math.min(550, window.innerWidth - e.clientX));
        setMemoryWidth(newWidth);
      } else if (isResizingMiddle && mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const newPercent = Math.max(25, Math.min(75, (relativeY / rect.height) * 100));
        setThreadHeightPercent(newPercent);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      setIsResizingMiddle(false);
    };

    if (isResizingLeft || isResizingRight || isResizingMiddle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight, isResizingMiddle]);

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
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans antialiased overflow-hidden">
      {/* Top Navbar — Prominent Authentic Amazon Customer Service Navigation Banner (Fixed 70px) */}
      <header className="h-[70px] bg-[#131921] px-6 py-2.5 flex items-center justify-between flex-shrink-0 shadow-lg z-10 text-white border-b border-slate-800 select-none">
        {/* Left: Official Amazon.in Customer Service Branding */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <AmazonLogo className="h-7 w-auto" dark={true} />
            <span className="text-slate-600 font-light text-2xl">|</span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white font-sans">
                  amazon customer service
                </span>
                <span className="text-[11px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-400/40">
                  Rep Copilot Workbench
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                AmazonHelp Support Memory & Escalation Copilot System
              </span>
            </div>
          </div>
        </div>

        {/* Right: Partner Badges (Groq LPU + Hindsight Memory) */}
        <div className="flex items-center gap-3.5 text-xs">
          {/* Groq Enterprise Inference Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/90 border border-slate-700 text-slate-200 shadow-xs">
            <GroqLogo className="w-4 h-4" />
            <span className="text-[11px]">
              Fast Inference: <strong className="font-semibold text-white">Groq LPU</strong>
            </span>
          </div>

          {/* Hindsight Persistent Memory System Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-colors shadow-xs ${
            memoryEnabled 
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            <HindsightLogo className="w-4 h-4" />
            <span>Hindsight Memory: {memoryEnabled ? 'Active' : 'Bypassed'}</span>
          </div>
        </div>
      </header>

      {/* Main 3-Column Split Pane with Draggable Column & Row Resizers */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Ticket Queue (Draggable Width) */}
        <div style={{ width: `${queueWidth}px` }} className="flex-shrink-0 h-full flex flex-col transition-all duration-75">
          <TicketList
            tickets={tickets}
            selectedId={selectedId}
            onSelectTicket={handleSelectTicket}
            loading={loading}
            onRefresh={fetchTickets}
            widthClass="w-full"
          />
        </div>

        {/* Draggable Column Splitter Handle 1 (Queue / Conversation) */}
        <div 
          onMouseDown={handleMouseDownLeft}
          title="Click and drag left/right to resize Ticket Queue column"
          className="w-2 hover:w-2.5 bg-slate-300 hover:bg-amber-500 cursor-col-resize transition-all flex items-center justify-center flex-shrink-0 select-none z-20 group"
        >
          <div className="h-8 w-1 bg-slate-400 group-hover:bg-white rounded-full" />
        </div>

        {/* Center Column: Active Conversation & Reply Generator with Vertical Frame Resizer */}
        <main ref={mainRef} className="flex-1 flex flex-col bg-slate-50 overflow-hidden border-r border-slate-200 min-w-[320px]">
          {ticketDetail ? (
            <>
              {/* Proactive Escalation Banner (SRS FR-9) */}
              <EscalationBanner 
                riskProfile={ticketDetail.risk_profile} 
                memoryEnabled={memoryEnabled} 
              />

              {/* Upper Middle Frame: Conversation Thread (Resizable Height) */}
              <div style={{ height: `${threadHeightPercent}%` }} className="flex flex-col overflow-hidden flex-shrink-0">
                <ConversationThread
                  customer={ticketDetail.customer}
                  threads={ticketDetail.threads}
                  heldOutThread={ticketDetail.customer?.held_out_thread}
                />
              </div>

              {/* Draggable Row Splitter Handle (Middle Frame Top/Bottom Resizer) */}
              <div 
                onMouseDown={handleMouseDownMiddle}
                title="Click and drag up/down to resize Conversation vs Reply Composer frame"
                className="h-2.5 hover:h-3 bg-slate-200 hover:bg-amber-400 cursor-row-resize transition-all flex items-center justify-center flex-shrink-0 select-none border-y border-slate-300 z-20 group"
              >
                <div className="w-16 h-1 bg-slate-400 group-hover:bg-slate-900 rounded-full flex items-center justify-center">
                  <div className="w-6 h-0.5 bg-white/80 rounded-full" />
                </div>
              </div>

              {/* Lower Middle Frame: Reply Drafting Composer */}
              <div className="flex-1 overflow-y-auto flex flex-col min-h-[160px]">
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

        {/* Draggable Column Splitter Handle 2 (Conversation / Memory Panel) */}
        <div 
          onMouseDown={handleMouseDownRight}
          title="Click and drag left/right to resize Memory Panel column"
          className="w-2 hover:w-2.5 bg-slate-300 hover:bg-amber-500 cursor-col-resize transition-all flex items-center justify-center flex-shrink-0 select-none z-20 group"
        >
          <div className="h-8 w-1 bg-slate-400 group-hover:bg-white rounded-full" />
        </div>

        {/* Right Column: Live Agent Memory Panel (Draggable Width) */}
        <div style={{ width: `${memoryWidth}px` }} className="flex-shrink-0 h-full flex flex-col transition-all duration-75">
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
        </div>
      </div>
    </div>
  );
}
