'use client';

import React from 'react';
import Link from 'next/link';
import { Seat, DerivedSeatState } from '@/types';
import SeatStateBadge from './SeatStateBadge';
import { X, MapPin, Zap, Monitor, ArrowRight, ShieldCheck } from 'lucide-react';

interface SeatDetailDrawerProps {
  seat: Seat | null;
  derivedState: DerivedSeatState;
  onClose: () => void;
}

export default function SeatDetailDrawer({ seat, derivedState, onClose }: SeatDetailDrawerProps) {
  if (!seat) return null;

  const isReservable = derivedState === 'AVAILABLE';

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#101621] border-l border-[#263244] shadow-2xl z-50 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#263244] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F8CFF]/10 text-[#4F8CFF] border border-[#4F8CFF]/20 flex items-center justify-center font-bold text-sm">
              {seat.seatNumber}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F5F7FA]">Desk {seat.seatNumber}</h3>
              <p className="text-xs text-[#9AA7B8] flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-[#38D9C5]" />
                <span>{seat.zone}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#9AA7B8] hover:text-[#F5F7FA] hover:bg-[#151D2B] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Badge */}
        <div className="bg-[#151D2B] border border-[#263244] p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#9AA7B8] font-medium">Derived Status</span>
            <SeatStateBadge state={derivedState} />
          </div>
          <p className="text-xs text-[#9AA7B8]">
            {derivedState === 'AVAILABLE' && 'This desk is currently free and ready to be reserved.'}
            {derivedState === 'RESERVED' && 'An upcoming reservation is active for this seat.'}
            {derivedState === 'OCCUPIED_VALID' && 'A student is currently checked in and using this seat.'}
            {derivedState === 'OCCUPIED_UNAUTHORIZED' && 'Hardware camera detects a person without active check-in.'}
            {derivedState === 'NO_SHOW_PENDING' && 'Reservation grace period expired; pending release.'}
            {derivedState === 'MAINTENANCE' && 'Seat is disabled for routine facility maintenance.'}
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider">Desk Amenities</h4>
          <div className="grid grid-cols-2 gap-2">
            {seat.features.map((feat) => (
              <div
                key={feat}
                className="bg-[#151D2B] border border-[#263244] p-3 rounded-xl flex items-center space-x-2 text-xs text-[#F5F7FA]"
              >
                {feat === 'Power Outlet' && <Zap className="w-4 h-4 text-[#F5B942]" />}
                {feat === 'Monitor' && <Monitor className="w-4 h-4 text-[#4F8CFF]" />}
                {feat !== 'Power Outlet' && feat !== 'Monitor' && (
                  <ShieldCheck className="w-4 h-4 text-[#38D9C5]" />
                )}
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware Status */}
        <div className="bg-[#151D2B]/60 border border-[#263244] p-3.5 rounded-xl text-xs text-[#9AA7B8] flex items-center justify-between">
          <span>Camera Occupancy Sensor</span>
          <span className={`font-semibold ${seat.isHardwareMonitored ? 'text-[#38D9C5]' : 'text-[#9AA7B8]'}`}>
            {seat.isHardwareMonitored ? 'Monitored (Raspberry Pi)' : 'Standard Seat'}
          </span>
        </div>
      </div>

      {/* Action CTA */}
      <div className="pt-6 border-t border-[#263244]">
        {isReservable ? (
          <Link
            href={`/reservations?seatId=${seat.id}`}
            className="w-full bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-[#4F8CFF]/20 text-sm"
          >
            <span>Reserve Seat {seat.seatNumber}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="w-full bg-[#151D2B] text-[#9AA7B8] font-medium py-3 px-4 rounded-xl cursor-not-allowed text-xs text-center border border-[#263244]"
          >
            Seat Currently Unavailable for Booking
          </button>
        )}
      </div>
    </div>
  );
}
