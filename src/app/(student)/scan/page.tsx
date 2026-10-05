'use client';

import React from 'react';

export default function ScanPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">QR Check-In Scanner</h1>
        <p className="text-xs text-slate-400 mt-1">Scan seat physical QR code to begin study session (Phase 5)</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        <p className="text-sm">Two-step QR Challenge Scanner will be integrated in Phase 5.</p>
      </div>
    </div>
  );
}
