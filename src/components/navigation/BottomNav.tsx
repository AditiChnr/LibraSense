'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Calendar, QrCode, Timer, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BottomNav() {
  const pathname = usePathname();

  const items = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Map', href: '/map', icon: MapPin },
    { name: 'Bookings', href: '/reservations', icon: Calendar },
    { name: 'Scan', href: '/scan', icon: QrCode },
    { name: 'Session', href: '/session', icon: Timer },
    { name: 'Stats', href: '/analytics', icon: BarChart2 },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 z-40 px-4 flex items-center justify-around">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center space-y-1 text-[11px] font-medium transition py-1 px-3 rounded-lg',
              isActive ? 'text-indigo-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Icon className="w-5 h-5" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
