import React from 'react';

interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps): React.ReactElement | null {
  if (!message) return null;

  return (
    <div id="prototype-toast" className="fixed top-16 inset-x-4 z-50 flex justify-center animate-bounce">
      <div className="acrylic-pill px-4 py-2.5 rounded-full flex items-center gap-2 border border-blue-400/60 shadow-lg text-xs font-bold text-[#0F172A]">
        <span className="material-symbols-outlined text-blue-600 text-[18px]">info</span>
        <span>{message}</span>
      </div>
    </div>
  );
}
