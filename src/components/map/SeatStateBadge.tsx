'use client';

import React from 'react';
import { DerivedSeatState } from '@/types';
import { CheckCircle2, Clock, UserCheck, AlertOctagon, Wrench } from 'lucide-react';

interface SeatStateBadgeProps {
  state: DerivedSeatState;
  showIcon?: boolean;
}

export default function SeatStateBadge({ state, showIcon = true }: SeatStateBadgeProps) {
  const getBadgeConfig = (s: DerivedSeatState) => {
    switch (s) {
      case 'AVAILABLE':
        return {
          label: 'Available',
          bg: 'bg-[#38D9C5]/10',
          text: 'text-[#38D9C5]',
          border: 'border-[#38D9C5]/30',
          Icon: CheckCircle2,
        };
      case 'RESERVED':
        return {
          label: 'Reserved',
          bg: 'bg-[#F5B942]/10',
          text: 'text-[#F5B942]',
          border: 'border-[#F5B942]/30',
          Icon: Clock,
        };
      case 'OCCUPIED_VALID':
        return {
          label: 'Occupied (Valid)',
          bg: 'bg-[#FF647C]/10',
          text: 'text-[#FF647C]',
          border: 'border-[#FF647C]/30',
          Icon: UserCheck,
        };
      case 'OCCUPIED_UNAUTHORIZED':
        return {
          label: 'Occupied (Unchecked)',
          bg: 'bg-[#FF4D4D]/10',
          text: 'text-[#FF4D4D]',
          border: 'border-[#FF4D4D]/30',
          Icon: AlertOctagon,
        };
      case 'NO_SHOW_PENDING':
        return {
          label: 'No-Show Pending',
          bg: 'bg-[#F5B942]/10',
          text: 'text-[#F5B942]',
          border: 'border-[#F5B942]/30',
          Icon: Clock,
        };
      case 'MAINTENANCE':
        return {
          label: 'Maintenance',
          bg: 'bg-[#8B95A7]/10',
          text: 'text-[#8B95A7]',
          border: 'border-[#8B95A7]/30',
          Icon: Wrench,
        };
      default:
        return {
          label: 'Unknown',
          bg: 'bg-slate-800',
          text: 'text-slate-400',
          border: 'border-slate-700',
          Icon: CheckCircle2,
        };
    }
  };

  const config = getBadgeConfig(state);
  const IconComponent = config.Icon;

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}
    >
      {showIcon && <IconComponent className="w-3.5 h-3.5 shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
}
