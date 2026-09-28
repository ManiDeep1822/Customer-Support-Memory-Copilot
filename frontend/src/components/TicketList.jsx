import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Search, RefreshCw } from 'lucide-react';

export default function TicketList({ tickets, selectedId, onSelectTicket, loading, onRefresh, widthClass = "w-80" }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = !searchTerm || 
      t.display_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.last_message_preview.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customer_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = selectedFilter === 'all' || t.risk_level === selectedFilter;
    return matchesSearch && matchesRisk;
  });

  const getRiskBadge = (level) => {
    switch (level) {
      case 'escalate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" />
            Escalate
          </span>
        );
      case 'watch':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Watch
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            Normal
          </span>
        );
    }
  };

  return (
    <div className={`${widthClass} transition-all duration-300 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full`}>
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ticket Queue</h2>
          <p className="text-xs text-slate-500">AmazonHelp ({filteredTickets.length} cases)</p>
        </div>
        <button 
          onClick={onRefresh} 
          title="Refresh Queue"
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search & Scenario Preset Filters */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50/60 flex flex-col gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Filter by customer or text..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 shadow-sm"
          />
        </div>

        {/* Demo Scenario Presets */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
          {['all', 'escalate', 'watch', 'normal'].map((filterType) => {
            const active = selectedFilter === filterType;
            const labels = { all: 'All Cases', escalate: 'Escalate', watch: 'Watch', normal: 'Normal' };
            return (
              <button
                key={filterType}
                onClick={() => setSelectedFilter(filterType)}
                className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition-all ${
                  active 
                    ? 'bg-slate-900 text-white font-semibold shadow-xs' 
                    : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/80'
                }`}
              >
                {labels[filterType]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading && tickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">No tickets found</div>
        ) : (
          filteredTickets.map((ticket) => {
            const isSelected = ticket.customer_id === selectedId;
            return (
              <button
                key={ticket.customer_id}
                onClick={() => onSelectTicket(ticket.customer_id)}
                className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 ${
                  isSelected 
                    ? 'bg-amber-50/70 border-l-4 border-amber-500 pl-3' 
                    : 'hover:bg-slate-50 border-l-4 border-transparent pl-3'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">
                    {ticket.display_label}
                  </span>
                  {getRiskBadge(ticket.risk_level)}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {ticket.last_message_preview}
                </p>
                <div className="text-[11px] text-slate-400">
                  ID: <span className="font-mono text-slate-500">{ticket.customer_id}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
