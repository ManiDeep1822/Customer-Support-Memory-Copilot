import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function EscalationBanner({ riskProfile, memoryEnabled }) {
  // Only render when risk_level is escalate AND memory is enabled (SRS FR-9)
  if (!memoryEnabled || riskProfile?.risk_level !== 'escalate') {
    return null;
  }

  const contactCount = riskProfile?.contact_count_this_issue || 3;
  const confidence = Math.round((riskProfile?.confidence || 0.88) * 100);

  return (
    <div className="bg-red-50 border-b border-red-200 border-l-4 border-l-red-600 p-4 flex items-start gap-3.5 text-red-950 shadow-xs">
      <div className="p-2 rounded-lg bg-red-100 text-red-700 mt-0.5 flex-shrink-0">
        <ShieldAlert className="w-5 h-5 text-red-700" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-2">
            Proactive Escalation Alert
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
              Confidence: {confidence}%
            </span>
          </h4>
          <span className="text-xs text-red-700 font-semibold px-2 py-0.5 rounded bg-red-100/70 border border-red-200">
            Memory ON Signal
          </span>
        </div>
        <p className="text-xs text-red-900 mt-1.5 leading-relaxed">
          This customer has contacted support <strong>{contactCount} times</strong> about this recurring issue with a declining sentiment trajectory. 
          Prompt proactive escalation, manager intervention, or an immediate goodwill resolution (refund / replacement) is strongly advised.
        </p>
      </div>
    </div>
  );
}
