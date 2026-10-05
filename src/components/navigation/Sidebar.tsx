'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  MapPin,
  Calendar,
  QrCode,
  Timer,
  BarChart2,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Live Seat Map', href: '/map', icon: MapPin },
    { name: 'Reservations', href: '/reservations', icon: Calendar },
    { name: 'QR Check-In', href: '/scan', icon: QrCode },
    { name: 'Active Session', href: '/session', icon: Timer },
    { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ name: 'Admin Console', href: '/admin', icon: ShieldCheck });
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 p-4 space-y-6 min-h-[calc(100vh-4rem)]">
      <div className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        Student Portal
      </div>

      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition',
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info Widget */}
      <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300">LibraSense Smart IoT</p>
        <p className="text-[11px] text-slate-500">Hardware & Camera Detection Active</p>
      </div>
    </aside>
  );
}
