'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, KeyRound } from 'lucide-react';

interface QrCameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  disabled?: boolean;
}

export default function QrCameraScanner({ onScanSuccess, disabled = false }: QrCameraScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    const elementId = 'qr-reader-container';

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (!disabled && !isScanningRef.current) {
              isScanningRef.current = true;
              onScanSuccess(decodedText);
            }
          },
          () => {
            // Ignore ongoing frame decode misses
          }
        );
      } catch (err: unknown) {
        console.warn('Camera scanner initialization error:', err);
        const msg = err instanceof Error ? err.message : 'Camera access unavailable';
        setCameraError(msg);
        setShowManualInput(true);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch((err) => console.warn('Error stopping QR scanner:', err));
      }
    };
  }, [disabled, onScanSuccess]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim() && !disabled) {
      onScanSuccess(manualCode.trim());
    }
  };

  return (
    <div className="w-full bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Scanner Viewport */}
      <div className="relative w-full aspect-square max-w-[360px] mx-auto bg-[#080B12] border border-[#263244] rounded-2xl overflow-hidden flex items-center justify-center">
        <div id="qr-reader-container" className="w-full h-full" />

        {/* Viewfinder Target Overlay */}
        {!cameraError && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="w-48 h-48 border-2 border-[#4F8CFF]/80 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#38D9C5] -mt-1 -ml-1"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#38D9C5] -mt-1 -mr-1"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#38D9C5] -mb-1 -ml-1"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#38D9C5] -mb-1 -mr-1"></div>

              {/* Animated Target Scanning Line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#4F8CFF] to-transparent animate-pulse absolute top-1/2 -translate-y-1/2"></div>
            </div>
          </div>
        )}

        {/* Camera Permission / Fallback State */}
        {cameraError && (
          <div className="absolute inset-0 bg-[#080B12]/95 p-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#151D2B] text-[#FF647C] flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-xs text-[#9AA7B8]">
              Camera stream unavailable. You can use the manual seat code input below for demo testing.
            </p>
          </div>
        )}
      </div>

      {/* Manual Seat Code Testing Mode Helper */}
      <div className="border-t border-[#263244] pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#9AA7B8] font-medium flex items-center space-x-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#4F8CFF]" />
            <span>Manual Public Seat QR Entry</span>
          </span>
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-xs text-[#4F8CFF] hover:underline"
          >
            {showManualInput ? 'Hide' : 'Manual Entry'}
          </button>
        </div>

        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. SEAT_FL1_A01"
              disabled={disabled}
              className="flex-1 bg-[#151D2B] border border-[#263244] rounded-xl px-3.5 py-2 text-xs text-[#F5F7FA] uppercase focus:outline-none focus:border-[#4F8CFF]"
            />
            <button
              type="submit"
              disabled={disabled || !manualCode.trim()}
              className="bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 disabled:bg-[#151D2B] text-[#F5F7FA] font-semibold px-4 py-2 rounded-xl text-xs transition"
            >
              Verify
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
