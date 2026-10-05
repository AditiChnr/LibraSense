'use client';

import React from 'react';
import {
  Cpu,
  WifiOff,
  AlertTriangle,
  Clock,
  Shield,
} from 'lucide-react';
import { Device, Seat } from '@/types';
import { evaluateDeviceHeartbeat } from '@/lib/services/iotSecurity';

interface IoTDeviceMonitorProps {
  devices: Device[];
  seats: Seat[];
}

export default function IoTDeviceMonitor({ devices, seats }: IoTDeviceMonitorProps) {
  const seatMap = new Map(seats.map((s) => [s.id, s]));

  const getStatusBadge = (lastHeartbeat: string) => {
    const status = evaluateDeviceHeartbeat(lastHeartbeat);
    switch (status) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            WARNING (Lagging)
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <WifiOff className="w-3 h-3" />
            OFFLINE
          </span>
        );
    }
  };

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>IoT Edge Devices & Camera Sensors</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#151D2B] border border-[#263244] text-slate-400">
              {devices.length} registered
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hardware daemon telemetry, heartbeat vitality, and edge computer vision health
          </p>
        </div>
      </div>

      {/* Grid of Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-500 bg-[#151D2B]/50 rounded-xl border border-[#263244]">
            <p className="text-sm font-medium">No IoT edge devices currently registered</p>
            <p className="text-xs text-slate-600 mt-1">Run database seed or connect a Raspberry Pi client</p>
          </div>
        ) : (
          devices.map((device) => {
            const seat = seatMap.get(device.assignedSeatId);

            return (
              <div
                key={device.id}
                className="bg-[#151D2B] border border-[#263244] rounded-xl p-5 space-y-4 hover:border-slate-700 transition"
              >
                {/* Top info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#4F8CFF]/15 border border-[#4F8CFF]/30 flex items-center justify-center text-[#4F8CFF]">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{device.name}</h3>
                      <p className="text-xs font-mono text-slate-400">{device.id}</p>
                    </div>
                  </div>
                  {getStatusBadge(device.lastHeartbeat)}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#263244]">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Assigned Seat</span>
                    <span className="font-semibold text-white">
                      {seat ? `Desk ${seat.seatNumber}` : device.assignedSeatId}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Edge IP Address</span>
                    <span className="font-mono text-slate-300">{device.ipAddress}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Detection Confidence</span>
                    <span className="font-mono text-slate-300">
                      {Math.round(device.detectionConfidence * 100)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Last Heartbeat</span>
                    <span className="text-slate-300 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(device.lastHeartbeat).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Footer status notice */}
                <div className="text-[11px] text-slate-400 bg-[#101621] p-2.5 rounded-lg border border-[#263244] flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Shield className="w-3.5 h-3.5 text-[#38D9C5]" />
                    HMAC-SHA256 Ingestion Active
                  </span>
                  <span className="text-slate-500 font-mono">
                    Window: 30s
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
