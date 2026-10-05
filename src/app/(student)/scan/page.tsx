'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import QrCameraScanner from '@/components/scan/QrCameraScanner';
import { QrCode, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Timer, MapPin } from 'lucide-react';

type ScanStage = 'SCANNING' | 'GENERATING_CHALLENGE' | 'CONSUMING_CHALLENGE' | 'SUCCESS' | 'ERROR';

export default function ScanPage() {
  const [stage, setStage] = useState<ScanStage>('SCANNING');
  const [statusMessage, setStatusMessage] = useState<string>('Align desk QR code within the viewfinder frame.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkedInSeat, setCheckedInSeat] = useState<string>('');

  const handleScanSuccess = async (decodedQrText: string) => {
    setStage('GENERATING_CHALLENGE');
    setStatusMessage('Authenticating seat reservation and requesting server challenge...');
    setErrorMessage(null);

    try {
      // 1. Request Short-Lived Signed Challenge (Step 1)
      const challengeRes = await fetch('/api/v1/checkin/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPublicId: decodedQrText }),
      });

      const challengeData = await challengeRes.json();
      if (!challengeRes.ok) {
        throw new Error(challengeData.message || 'Challenge generation failed.');
      }

      const { challengeId, challengeToken, seatNumber } = challengeData;
      setCheckedInSeat(seatNumber || 'A01');

      // 2. Consume Challenge Token Atomically (Step 2)
      setStage('CONSUMING_CHALLENGE');
      setStatusMessage('Verifying cryptographic token and initializing study session...');

      const consumeRes = await fetch('/api/v1/checkin/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          challengeToken,
        }),
      });

      const consumeData = await consumeRes.json();
      if (!consumeRes.ok) {
        throw new Error(consumeData.message || 'Token verification failed.');
      }

      // Success
      setStage('SUCCESS');
      setStatusMessage(`Successfully checked in at Desk ${seatNumber || 'A01'}.`);
    } catch (err: unknown) {
      console.error('Check-in process error:', err);
      const msg = err instanceof Error ? err.message : 'Check-in failed.';
      setErrorMessage(msg);
      setStage('ERROR');
    }
  };

  const handleReset = () => {
    setStage('SCANNING');
    setErrorMessage(null);
    setStatusMessage('Align desk QR code within the viewfinder frame.');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="border-b border-[#263244] pb-4 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start space-x-2 text-xs text-[#4F8CFF] font-semibold uppercase tracking-wider mb-1">
          <ShieldCheck className="w-4 h-4 text-[#38D9C5]" />
          <span>Server-Verified Two-Step Protocol</span>
        </div>
        <h1 className="text-2xl font-bold text-[#F5F7FA] tracking-tight">QR Seat Check-In</h1>
        <p className="text-xs text-[#9AA7B8] mt-1">{statusMessage}</p>
      </div>

      {/* Success View */}
      {stage === 'SUCCESS' ? (
        <div className="bg-[#101621] border border-[#38D9C5]/40 rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-[#38D9C5]/10 text-[#38D9C5] border border-[#38D9C5]/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#F5F7FA]">Check-In Confirmed</h2>
            <p className="text-xs text-[#9AA7B8]">
              Your reservation for <strong className="text-[#38D9C5]">Desk {checkedInSeat}</strong> is now verified and your study session is officially active.
            </p>
          </div>

          <div className="p-4 bg-[#151D2B] border border-[#263244] rounded-xl text-xs text-[#9AA7B8] flex items-center justify-around">
            <span className="flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-[#4F8CFF]" />
              <span>Desk {checkedInSeat}</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center space-x-1.5 text-[#38D9C5]">
              <Timer className="w-4 h-4" />
              <span>Timer Running</span>
            </span>
          </div>

          <Link
            href="/session"
            className="w-full bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-[#4F8CFF]/20 text-sm"
          >
            <span>Open Study Session & Pomodoro Timer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : stage === 'ERROR' ? (
        /* Error View */
        <div className="bg-[#101621] border border-[#FF647C]/40 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-[#FF647C]/10 text-[#FF647C] border border-[#FF647C]/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#F5F7FA]">Check-In Rejected</h2>
            <p className="text-xs text-[#FF647C]">{errorMessage || 'Could not verify check-in challenge.'}</p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full bg-[#151D2B] hover:bg-[#151D2B]/80 text-[#F5F7FA] border border-[#263244] font-medium py-3 px-6 rounded-xl transition flex items-center justify-center space-x-2 text-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Scanning Again</span>
          </button>
        </div>
      ) : stage === 'GENERATING_CHALLENGE' || stage === 'CONSUMING_CHALLENGE' ? (
        /* Processing Loading View */
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-12 shadow-2xl text-center space-y-4 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[#4F8CFF]" />
          <h3 className="text-sm font-semibold text-[#F5F7FA]">Cryptographic Handshake in Progress</h3>
          <p className="text-xs text-[#9AA7B8] max-w-sm">{statusMessage}</p>
        </div>
      ) : (
        /* Active Scanner View */
        <div className="space-y-4">
          <QrCameraScanner
            onScanSuccess={handleScanSuccess}
            disabled={stage !== 'SCANNING'}
          />

          <div className="p-4 bg-[#101621] border border-[#263244] rounded-xl text-xs text-[#9AA7B8] flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <QrCode className="w-4 h-4 text-[#4F8CFF]" />
              <span>Seat QR must match active reservation</span>
            </span>
            <span className="text-[#F5B942] font-semibold">15m Grace Window</span>
          </div>
        </div>
      )}
    </div>
  );
}
