'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Floor, Seat, HardwareState, Reservation, StudySession, DerivedSeatState, SeatZone, SeatFeature } from '@/types';
import { resolveSeatState } from '@/lib/services/seatStateResolver';
import FloorMapSvg from '@/components/map/FloorMapSvg';
import SeatDetailDrawer from '@/components/map/SeatDetailDrawer';
import BestSeatMatcherModal from '@/components/map/BestSeatMatcherModal';
import SeatStateBadge from '@/components/map/SeatStateBadge';
import { Layers, Sparkles, Filter, RefreshCw, AlertCircle } from 'lucide-react';

export default function LiveSeatMapPage() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('floor_1');
  const [seats, setSeats] = useState<Seat[]>([]);

  // Telemetry sources of truth
  const [hardwareStates, setHardwareStates] = useState<Record<string, HardwareState>>({});
  const [activeReservations, setActiveReservations] = useState<Record<string, Reservation>>({});
  const [activeSessions, setActiveSessions] = useState<Record<string, StudySession>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [zoneFilter, setZoneFilter] = useState<SeatZone | ''>('');
  const [featureFilter, setFeatureFilter] = useState<SeatFeature | ''>('');

  // Selected Seat & Modal States
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isMatcherOpen, setIsMatcherOpen] = useState(false);

  // 1. Fetch Floors
  useEffect(() => {
    const unsubFloors = onSnapshot(
      collection(db, 'floors'),
      (snap) => {
        const list: Floor[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Floor));
        list.sort((a, b) => a.floorNumber - b.floorNumber);
        setFloors(list);
        if (list.length > 0 && !selectedFloorId) {
          setSelectedFloorId(list[0]!.id);
        }
      },
      (err) => console.error('Error fetching floors:', err)
    );
    return () => unsubFloors();
  }, [selectedFloorId]);

  // 2. Fetch Seats for Selected Floor
  useEffect(() => {
    const qSeats = query(collection(db, 'seats'), where('floorId', '==', selectedFloorId));
    const unsubSeats = onSnapshot(
      qSeats,
      (snap) => {
        const list: Seat[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Seat));
        list.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber));
        setSeats(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching seats:', err);
        setError('Failed to load seat data.');
        setLoading(false);
      }
    );

    return () => unsubSeats();
  }, [selectedFloorId]);

  // 3. Listen to Hardware States
  useEffect(() => {
    const unsubHw = onSnapshot(
      collection(db, 'hardwareStates'),
      (snap) => {
        const map: Record<string, HardwareState> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as HardwareState;
        });
        setHardwareStates(map);
      },
      (err) => console.error('Error fetching hardware states:', err)
    );
    return () => unsubHw();
  }, []);

  // 4. Listen to Active Reservations
  useEffect(() => {
    const qRes = query(collection(db, 'reservations'), where('status', '==', 'active'));
    const unsubRes = onSnapshot(
      qRes,
      (snap) => {
        const map: Record<string, Reservation> = {};
        snap.forEach((d) => {
          const res = { id: d.id, ...d.data() } as Reservation;
          map[res.seatId] = res;
        });
        setActiveReservations(map);
      },
      (err) => console.error('Error fetching active reservations:', err)
    );
    return () => unsubRes();
  }, []);

  // 5. Listen to Active Sessions
  useEffect(() => {
    const qSess = query(collection(db, 'sessions'), where('status', '==', 'active'));
    const unsubSess = onSnapshot(
      qSess,
      (snap) => {
        const map: Record<string, StudySession> = {};
        snap.forEach((d) => {
          const sess = { id: d.id, ...d.data() } as StudySession;
          map[sess.seatId] = sess;
        });
        setActiveSessions(map);
      },
      (err) => console.error('Error fetching active sessions:', err)
    );
    return () => unsubSess();
  }, []);

  // Derive Effective States for all Seats
  const derivedStates = useMemo(() => {
    const map: Record<string, DerivedSeatState> = {};
    const nowIso = new Date().toISOString();
    seats.forEach((seat) => {
      map[seat.id] = resolveSeatState(
        seat,
        hardwareStates[seat.id],
        activeReservations[seat.id],
        activeSessions[seat.id],
        nowIso
      );
    });
    return map;
  }, [seats, hardwareStates, activeReservations, activeSessions]);

  // Filtered Seats
  const filteredSeats = useMemo(() => {
    return seats.filter((seat) => {
      if (zoneFilter && seat.zone !== zoneFilter) return false;
      if (featureFilter && !seat.features.includes(featureFilter)) return false;
      return true;
    });
  }, [seats, zoneFilter, featureFilter]);

  const activeFloor = floors.find((f) => f.id === selectedFloorId) || floors[0];

  const handleSelectFloor = (floorId: string) => {
    setSelectedFloorId(floorId);
    setLoading(true);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#263244] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7FA] tracking-tight">Live Interactive Seat Map</h1>
          <p className="text-xs text-[#9AA7B8] mt-1">Data-driven spatial seat matrix with derived telemetry states</p>
        </div>

        {/* Smart Seat Matcher CTA */}
        <button
          type="button"
          onClick={() => setIsMatcherOpen(true)}
          className="bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-semibold px-4 py-2.5 rounded-xl transition flex items-center justify-center space-x-2 text-xs shadow-lg shadow-[#4F8CFF]/20 self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4 text-[#38D9C5]" />
          <span>Smart Seat Matcher</span>
        </button>
      </div>

      {/* Control Bar: Floor Selector & Filters */}
      <div className="bg-[#101621] border border-[#263244] p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        {/* Floor Selection Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          <span className="text-xs text-[#9AA7B8] font-medium flex items-center space-x-1 shrink-0 mr-1">
            <Layers className="w-4 h-4 text-[#4F8CFF]" />
            <span>Select Floor:</span>
          </span>
          {floors.map((fl) => (
            <button
              key={fl.id}
              type="button"
              onClick={() => handleSelectFloor(fl.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition shrink-0 border ${
                selectedFloorId === fl.id
                  ? 'bg-[#4F8CFF] text-[#F5F7FA] border-[#4F8CFF] shadow-md shadow-[#4F8CFF]/20'
                  : 'bg-[#151D2B] text-[#9AA7B8] border-[#263244] hover:text-[#F5F7FA]'
              }`}
            >
              {fl.name}
            </button>
          ))}
        </div>

        {/* Zone & Feature Filters */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-[#9AA7B8] shrink-0" />
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value as SeatZone | '')}
            className="bg-[#151D2B] border border-[#263244] rounded-xl px-3 py-1.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
          >
            <option value="">All Zones</option>
            <option value="Quiet Zone">Quiet Zone</option>
            <option value="Collaborative">Collaborative</option>
            <option value="Window">Window Workstations</option>
            <option value="Group Study">Group Study</option>
          </select>

          <select
            value={featureFilter}
            onChange={(e) => setFeatureFilter(e.target.value as SeatFeature | '')}
            className="bg-[#151D2B] border border-[#263244] rounded-xl px-3 py-1.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
          >
            <option value="">All Features</option>
            <option value="Power Outlet">Power Outlet</option>
            <option value="Monitor">Monitor</option>
            <option value="Standing Desk">Standing Desk</option>
            <option value="Ergonomic Chair">Ergonomic Chair</option>
          </select>
        </div>
      </div>

      {/* Legend Header */}
      <div className="bg-[#101621] border border-[#263244] p-3 rounded-xl flex flex-wrap items-center gap-3 text-xs text-[#9AA7B8]">
        <span className="font-semibold text-[#F5F7FA] mr-1">Legend:</span>
        <SeatStateBadge state="AVAILABLE" />
        <SeatStateBadge state="RESERVED" />
        <SeatStateBadge state="OCCUPIED_VALID" />
        <SeatStateBadge state="OCCUPIED_UNAUTHORIZED" />
        <SeatStateBadge state="MAINTENANCE" />
      </div>

      {/* Error Boundary / Loading State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-16 text-center text-[#9AA7B8] flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#4F8CFF]" />
          <p className="text-xs">Loading spatial floor map and live seat states...</p>
        </div>
      ) : activeFloor ? (
        <FloorMapSvg
          floor={activeFloor}
          seats={filteredSeats}
          derivedStates={derivedStates}
          selectedSeatId={selectedSeat?.id || null}
          onSelectSeat={(seat) => setSelectedSeat(seat)}
        />
      ) : (
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-12 text-center text-xs text-[#9AA7B8]">
          No floor data available.
        </div>
      )}

      {/* Selected Seat Drawer */}
      <SeatDetailDrawer
        seat={selectedSeat}
        derivedState={selectedSeat ? derivedStates[selectedSeat.id] || 'AVAILABLE' : 'AVAILABLE'}
        onClose={() => setSelectedSeat(null)}
      />

      {/* Smart Seat Matcher Modal */}
      <BestSeatMatcherModal
        isOpen={isMatcherOpen}
        onClose={() => setIsMatcherOpen(false)}
        seats={seats}
        derivedStates={derivedStates}
        onSelectMatchedSeat={(seat) => setSelectedSeat(seat)}
      />
    </div>
  );
}
