'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Reservation, Seat } from '@/types';
import ReservationCard from '@/components/reservations/ReservationCard';
import NewReservationFlow from '@/components/reservations/NewReservationFlow';
import { Calendar, Plus, Clock, RefreshCw, AlertCircle, Inbox } from 'lucide-react';

function ReservationsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const preselectedSeatId = searchParams.get('seatId');

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(() => Boolean(preselectedSeatId));
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // 1. Fetch Seats for modal selection
  useEffect(() => {
    const unsubSeats = onSnapshot(
      collection(db, 'seats'),
      (snap) => {
        const list: Seat[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Seat));
        list.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber));
        setSeats(list);
      },
      (err) => console.error('Error fetching seats:', err)
    );
    return () => unsubSeats();
  }, []);

  // 2. Fetch User Reservations in Real-Time
  useEffect(() => {
    if (!user?.uid) return;

    const qRes = query(
      collection(db, 'reservations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubRes = onSnapshot(
      qRes,
      (snap) => {
        const list: Reservation[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Reservation));
        setReservations(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching reservations:', err);
        setError('Failed to load reservations.');
        setLoading(false);
      }
    );

    return () => unsubRes();
  }, [user?.uid]);

  const activeReservations = reservations.filter((r) => r.status === 'active' || r.status === 'checked_in');
  const pastReservations = reservations.filter((r) => r.status !== 'active' && r.status !== 'checked_in');

  const displayedList = activeTab === 'active' ? activeReservations : pastReservations;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#263244] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7FA] tracking-tight">Seat Reservations</h1>
          <p className="text-xs text-[#9AA7B8] mt-1">Manage current study bookings and reservation history</p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-semibold px-4 py-2.5 rounded-xl transition flex items-center justify-center space-x-2 text-xs shadow-lg shadow-[#4F8CFF]/20 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Reservation</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#263244] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-2 ${
            activeTab === 'active'
              ? 'bg-[#151D2B] text-[#4F8CFF] border border-[#263244]'
              : 'text-[#9AA7B8] hover:text-[#F5F7FA]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Active Bookings ({activeReservations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-2 ${
            activeTab === 'history'
              ? 'bg-[#151D2B] text-[#4F8CFF] border border-[#263244]'
              : 'text-[#9AA7B8] hover:text-[#F5F7FA]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>History ({pastReservations.length})</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Grid / Empty States */}
      {loading ? (
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-16 text-center text-[#9AA7B8] flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#4F8CFF]" />
          <p className="text-xs">Loading reservation telemetry...</p>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-16 text-center text-[#9AA7B8] space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#151D2B] text-[#9AA7B8] flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F5F7FA]">
              {activeTab === 'active' ? 'No Active Reservations' : 'No Reservation History'}
            </h3>
            <p className="text-xs text-[#9AA7B8] mt-1">
              {activeTab === 'active'
                ? 'Select a desk from the live map or create a new booking to get started.'
                : 'Completed and cancelled bookings will appear here.'}
            </p>
          </div>

          {activeTab === 'active' && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-medium text-xs px-4 py-2 rounded-xl transition inline-flex items-center space-x-1.5 shadow-md shadow-[#4F8CFF]/10"
            >
              <Plus className="w-4 h-4" />
              <span>Book a Desk Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedList.map((res) => (
            <ReservationCard
              key={res.id}
              reservation={res}
              onCancelSuccess={() => {}}
            />
          ))}
        </div>
      )}

      {/* Create Reservation Modal */}
      <NewReservationFlow
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        seats={seats}
        preselectedSeatId={preselectedSeatId}
        onSuccess={() => {}}
      />
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={<div className="text-xs text-[#9AA7B8] p-8">Loading reservations...</div>}>
      <ReservationsContent />
    </Suspense>
  );
}
