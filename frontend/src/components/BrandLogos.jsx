import React from 'react';

// Official Amazon 'a' + Smile Vector Emblem (pixel-perfect centered geometry)
export function AmazonEmblem({ className = "w-6 h-6" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Amazon Emblem"
    >
      <rect width="24" height="24" rx="5.5" fill="#232F3E" />
      <g transform="translate(4, 4)">
        {/* Letter 'a' in crisp white — centered directly above the smile */}
        <path 
          d="M10.813 11.968c.157.083.36.074.5-.05l.005.005a90 90 0 0 1 1.623-1.405c.173-.143.143-.372.006-.563l-.125-.17c-.345-.465-.673-.906-.673-1.791v-3.3l.001-.335c.008-1.265.014-2.421-.933-3.305C10.404.274 9.06 0 8.03 0 6.017 0 3.77.75 3.296 3.24c-.047.264.143.404.316.443l2.054.22c.19-.009.33-.196.366-.387.176-.857.896-1.271 1.703-1.271.435 0 .929.16 1.188.55.264.39.26.91.257 1.376v.432q-.3.033-.621.065c-1.113.114-2.397.246-3.36.67C3.873 5.91 2.94 7.08 2.94 8.798c0 2.2 1.387 3.298 3.168 3.298 1.506 0 2.328-.354 3.489-1.54l.167.246c.274.405.456.675 1.047 1.166ZM6.03 8.431C6.03 6.627 7.647 6.3 9.177 6.3v.57c.001.776.002 1.434-.396 2.133-.336.595-.87.961-1.465.961-.812 0-1.286-.619-1.286-1.533" 
          fill="#FFFFFF" 
        />
        {/* Smile arrow in official Amazon amber #FF9900 curving directly under the 'a' */}
        <path 
          d="M.435 12.174c2.629 1.603 6.698 4.084 13.183.997.28-.116.475.078.199.431C13.538 13.96 11.312 16 7.57 16 3.832 16 .968 13.446.094 12.386c-.24-.275.036-.4.199-.299z M13.828 11.943c.567-.07 1.468-.027 1.645.204.135.176-.004.966-.233 1.533-.23.563-.572.961-.762 1.115s-.333.094-.23-.137c.105-.23.684-1.663.455-1.963-.213-.278-1.177-.177-1.625-.13l-.09.009q-.142.013-.233.024c-.193.021-.245.027-.274-.032-.074-.209.779-.556 1.347-.623" 
          fill="#FF9900" 
        />
      </g>
    </svg>
  );
}

// Official Amazon Header Branding (amazon.in + Smile Arrow Vector)
export function AmazonLogo({ className = "h-6 w-auto", dark = false }) {
  return (
    <div className={`flex items-center gap-1.5 select-none ${className}`}>
      <div className="flex flex-col relative">
        <div className="flex items-baseline gap-0.5">
          <span className={`font-black text-lg tracking-tighter font-sans leading-none ${dark ? 'text-white' : 'text-slate-900'}`}>
            amazon
          </span>
          <span className={`text-[10px] font-bold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
            .in
          </span>
        </div>
        {/* Official Amazon Smile Curve in Amazon Amber #FF9900 */}
        <svg className="w-14 h-2.5 -mt-0.5" viewBox="0 0 50 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 2 3 Q 25 11 48 3" stroke="#FF9900" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M 44 2 L 48 3 L 45 6.5" fill="#FF9900" stroke="#FF9900" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}

// Official Groq Enterprise Mark
export function GroqLogo({ className = "w-4 h-4" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Groq Logo"
    >
      <rect width="24" height="24" rx="5" fill="#F55036" />
      {/* Geometric stylized Groq 'G' icon */}
      <circle cx="12" cy="12" r="7" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="32 10" strokeLinecap="round" />
      <path d="M12 12 H17" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Official Hindsight Temporal Memory Mark
export function HindsightLogo({ className = "w-4 h-4" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Hindsight Memory Logo"
    >
      <rect width="24" height="24" rx="5" fill="#059669" />
      {/* Interconnected temporal memory neural nodes */}
      <circle cx="8" cy="8" r="2.2" fill="#FFFFFF" />
      <circle cx="16" cy="9" r="2.2" fill="#FFFFFF" />
      <circle cx="12" cy="16" r="2.5" fill="#A7F3D0" />
      <path d="M8 8 L12 16 L16 9" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8 L16 9" stroke="#A7F3D0" strokeWidth="1.2" strokeDasharray="2 2" />
    </svg>
  );
}

// Enterprise Customer Avatar
export function CustomerAvatar({ label = "Customer", className = "w-7 h-7" }) {
  // Extract number or initial from display_label (e.g. "Customer #4471" -> "44")
  const match = label.match(/\d+/);
  const initials = match ? `#${match[0].slice(-2)}` : "C";

  return (
    <div 
      className={`${className} rounded-full bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-[11px] select-none flex-shrink-0`}
      title={label}
    >
      {initials}
    </div>
  );
}
