'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, Bell, LogOut, Shield, User as UserIcon } from 'lucide-react';

export default function Topbar() {
  const { profile, logout } = useAuth();

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between">
      {/* Brand & Campus Status */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-tight leading-none">LibraSense</h1>
          <p className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Central Library • Open</span>
          </p>
        </div>
      </div>

      {/* Right User Actions */}
      <div className="flex items-center space-x-3">
        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500"></span>
        </button>

        <div className="h-5 w-px bg-slate-800"></div>

        {/* User Info Badge */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
            {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-200 leading-none">{profile?.displayName || 'Student'}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1">
              {profile?.role === 'admin' ? (
                <span className="inline-flex items-center text-indigo-400 font-medium">
                  <Shield className="w-3 h-3 mr-0.5" /> Admin
                </span>
              ) : (
                <span>ID: {profile?.studentId || '23CSE001'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
