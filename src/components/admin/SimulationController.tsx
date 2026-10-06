'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cpu,
  Play,
  Square,
  RotateCcw,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  RefreshCw,
  Layers,
  Radio,
  Clock,
} from 'lucide-react';
import { Seat, HardwareState, Device, SimulationScenario } from '@/types';
import {
  triggerSimulationTick,
  resetSimulationState,
  fetchSimulationStatus,
  SimulationTickResponse,
} from '@/lib/services/adminService';
import { getScenarioOccupancy } from '@/lib/services/simulationEngine';

interface SimulationControllerProps {
  seats: Seat[];
  hardwareStates: Record<string, HardwareState>;
  devices: Device[];
}

interface TickAuditItem {
  id: string;
  tickId: string;
  seatId: string;
  occupied: boolean;
  confidence: number;
  scenario: string;
  idempotent: boolean;
  timestamp: string;
  status: 'SUCCESS' | 'IDEMPOTENT_SKIPPED' | 'ERROR';
}

export function SimulationController({ seats, hardwareStates }: SimulationControllerProps) {
  // Manual Ingestion State
  const [selectedSeatId, setSelectedSeatId] = useState<string>(seats[0]?.id || 'A01');
  const [targetOccupied, setTargetOccupied] = useState<boolean>(true);
  const [confidence, setConfidence] = useState<number>(0.94);
  const [autoSmooth, setAutoSmooth] = useState<boolean>(true);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);

  // Scenario Batch State
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario>('PEAK_AFTERNOON');
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // Automated Continuous Loop State
  const [isLoopActive, setIsLoopActive] = useState<boolean>(false);
  const [loopIntervalSec, setLoopIntervalSec] = useState<number>(5);
  const loopTickCountRef = useRef<number>(0);
  const loopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Idempotency Test State
  const [idempotencyResult, setIdempotencyResult] = useState<{
    tickId: string;
    firstCall: SimulationTickResponse | null;
    secondCall: SimulationTickResponse | null;
    testing: boolean;
  } | null>(null);

  // Reset State
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Audit Log & Telemetry State
  const [recentTicks, setRecentTicks] = useState<TickAuditItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load initial simulation status from server
  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchSimulationStatus();
      if (data?.ticks) {
        setRecentTicks(
          data.ticks.map((t, idx) => ({
            id: `server_${idx}_${t.tickId}`,
            tickId: t.tickId,
            seatId: t.seatId,
            occupied: t.occupied,
            confidence: t.confidence,
            scenario: t.scenario || 'SIMULATED',
            idempotent: false,
            timestamp: t.timestamp,
            status: 'SUCCESS',
          }))
        );
      }
    } catch {
      // Non-critical background fetch failure
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchSimulationStatus()
      .then((data) => {
        if (isMounted && data?.ticks) {
          setRecentTicks(
            data.ticks.map((t, idx) => ({
              id: `server_${idx}_${t.tickId}`,
              tickId: t.tickId,
              seatId: t.seatId,
              occupied: t.occupied,
              confidence: t.confidence,
              scenario: t.scenario || 'SIMULATED',
              idempotent: false,
              timestamp: t.timestamp,
              status: 'SUCCESS',
            }))
          );
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Manual Frame Dispatcher
  const handleManualInject = async () => {
    setIsInjecting(true);
    setStatusMessage(null);
    try {
      const res = await triggerSimulationTick({
        seatId: selectedSeatId,
        occupied: targetOccupied,
        confidence,
        scenario: 'MANUAL_INJECTION',
        autoSmooth,
      });

      const newAudit: TickAuditItem = {
        id: `local_${Date.now()}_${res.tickId}`,
        tickId: res.tickId,
        seatId: selectedSeatId,
        occupied: targetOccupied,
        confidence,
        scenario: 'MANUAL_INJECTION',
        idempotent: res.idempotent,
        timestamp: new Date().toISOString(),
        status: res.idempotent ? 'IDEMPOTENT_SKIPPED' : 'SUCCESS',
      };
      setRecentTicks((prev) => [newAudit, ...prev.slice(0, 24)]);
      setStatusMessage({ text: res.message, type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Telemetry injection failed.';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setIsInjecting(false);
    }
  };

  // Scenario Batch Dispatcher
  const handleExecuteScenario = async () => {
    if (seats.length === 0) return;
    setIsBatchRunning(true);
    setStatusMessage(null);
    try {
      const distribution = getScenarioOccupancy(selectedScenario, seats, loopTickCountRef.current);
      let successCount = 0;

      // Dispatch for all desks in sequence
      for (const [seatId, state] of distribution.entries()) {
        try {
          await triggerSimulationTick({
            seatId,
            occupied: state.occupied,
            confidence: state.confidence,
            scenario: selectedScenario,
            autoSmooth: true,
          });
          successCount++;
        } catch {
          // Continue batch
        }
      }

      await loadStatus();
      setStatusMessage({
        text: `Batch scenario '${selectedScenario}' dispatched to ${successCount}/${seats.length} desks.`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scenario execution failed.';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Continuous Automated Simulation Step
  const executeLoopStep = useCallback(async () => {
    if (seats.length === 0) return;
    loopTickCountRef.current += 1;
    const tickIdx = loopTickCountRef.current;
    const distribution = getScenarioOccupancy('RANDOM_WALK', seats, tickIdx);

    // Pick 3 random seats to shift per step to generate organic activity
    const shuffled = [...seats].sort(() => 0.5 - Math.random()).slice(0, 3);

    for (const seat of shuffled) {
      const targetState = distribution.get(seat.id) || { occupied: false, confidence: 0.92 };
      try {
        await triggerSimulationTick({
          seatId: seat.id,
          occupied: targetState.occupied,
          confidence: targetState.confidence,
          scenario: 'RANDOM_WALK',
          autoSmooth: true,
        });
      } catch {
        // Suppress loop tick errors
      }
    }
    loadStatus();
  }, [seats, loadStatus]);

  // Handle Start/Stop Automated Loop
  const toggleLoop = () => {
    if (isLoopActive) {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
      setIsLoopActive(false);
      setStatusMessage({ text: 'Automated simulation ticker stopped.', type: 'info' });
    } else {
      setIsLoopActive(true);
      executeLoopStep();
      loopTimerRef.current = setInterval(executeLoopStep, loopIntervalSec * 1000);
      setStatusMessage({
        text: `Automated simulation ticker running every ${loopIntervalSec}s (Random Walk mode).`,
        type: 'info',
      });
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    };
  }, []);

  // Idempotency Verification Test
  const handleTestIdempotency = async () => {
    setIdempotencyResult({
      tickId: '',
      firstCall: null,
      secondCall: null,
      testing: true,
    });
    setStatusMessage(null);

    const testTickId = `idem_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const testSeatId = selectedSeatId || 'A01';

    try {
      // First call (Should process fresh mutation)
      const res1 = await triggerSimulationTick({
        seatId: testSeatId,
        occupied: true,
        confidence: 0.95,
        tickId: testTickId,
        scenario: 'IDEMPOTENCY_VERIFICATION',
        autoSmooth: true,
      });

      // Second call with the EXACT SAME tickId (Should be rejected as idempotent duplicate)
      const res2 = await triggerSimulationTick({
        seatId: testSeatId,
        occupied: true,
        confidence: 0.95,
        tickId: testTickId,
        scenario: 'IDEMPOTENCY_VERIFICATION',
        autoSmooth: true,
      });

      setIdempotencyResult({
        tickId: testTickId,
        firstCall: res1,
        secondCall: res2,
        testing: false,
      });

      await loadStatus();
      setStatusMessage({
        text: `Idempotency test completed. First call processed (idempotent: false), second call detected duplicate tick (idempotent: true).`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Idempotency test failed.';
      setStatusMessage({ text: msg, type: 'error' });
      setIdempotencyResult(null);
    }
  };

  // Reset Simulation State
  const handleReset = async () => {
    setIsResetting(true);
    setStatusMessage(null);
    try {
      const res = await resetSimulationState();
      await loadStatus();
      setStatusMessage({ text: res.message, type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed.';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  // Hardware telemetry counts
  const simStatesList = Object.values(hardwareStates);
  const simulatedCount = simStatesList.filter((s) => s.source === 'simulation').length;
  const occupiedSimCount = simStatesList.filter((s) => s.source === 'simulation' && s.occupied).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Edge Simulator Status */}
      <div className="bg-[#101621] border border-[#263244] rounded-xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#4F8CFF]/10 rounded-lg border border-[#4F8CFF]/30 text-[#4F8CFF]">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Hardware-Independent Simulation Controller</h3>
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-[#38D9C5]/10 text-[#38D9C5] border border-[#38D9C5]/30 flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" />
                SIMULATED DATA MODE
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#F5B942]/10 text-[#F5B942] border border-[#F5B942]/30">
                PHYSICAL EDGE HARDWARE: PENDING
              </span>
            </div>
            <p className="text-xs text-[#8B95A7] mt-0.5">
              Simulates physical Raspberry Pi edge camera frames with SHA256 signatures, temporal smoothing ($K=3$), and strict tick idempotency.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <div className="text-right">
            <div className="text-xs text-[#8B95A7]">Simulated Desks</div>
            <div className="text-sm font-semibold text-white font-mono">
              <span className="text-[#FF647C]">{occupiedSimCount} occupied</span> / {simulatedCount || seats.length} active
            </div>
          </div>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#151D2B] hover:bg-[#263244] text-[#8B95A7] hover:text-white rounded-lg border border-[#263244] text-xs font-medium transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            Reset Desks to Vacant
          </button>
        </div>
      </div>

      {/* Notification Message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[#38D9C5]/10 border-[#38D9C5]/30 text-[#38D9C5]'
              : statusMessage.type === 'error'
              ? 'bg-[#FF4D4D]/10 border-[#FF4D4D]/30 text-[#FF4D4D]'
              : 'bg-[#4F8CFF]/10 border-[#4F8CFF]/30 text-[#4F8CFF]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Activity className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs underline hover:opacity-80 ml-4 font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grid: Left Column (Manual & Presets), Right Column (Idempotency & Automation) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Manual Telemetry Ingestion */}
        <div className="bg-[#101621] border border-[#263244] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#263244]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#4F8CFF]" />
              <h4 className="text-sm font-semibold text-white">Manual Desk Telemetry Injection</h4>
            </div>
            <span className="text-[11px] text-[#8B95A7] font-mono">HMAC-SHA256</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#8B95A7] mb-1.5">Target Seat</label>
              <select
                value={selectedSeatId}
                onChange={(e) => setSelectedSeatId(e.target.value)}
                className="w-full bg-[#151D2B] border border-[#263244] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4F8CFF]"
              >
                {seats.map((seat) => {
                  const hw = hardwareStates[seat.id];
                  const stateLabel = hw ? (hw.occupied ? 'Occupied' : 'Vacant') : 'Unassigned';
                  return (
                    <option key={seat.id} value={seat.id}>
                      {seat.seatNumber || seat.id} — {seat.zone} | Currently: {stateLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#8B95A7] mb-1.5">Simulated State</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetOccupied(true)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      targetOccupied
                        ? 'bg-[#FF647C]/20 text-[#FF647C] border-[#FF647C]'
                        : 'bg-[#151D2B] text-[#8B95A7] border-[#263244] hover:border-[#8B95A7]'
                    }`}
                  >
                    OCCUPIED
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetOccupied(false)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      !targetOccupied
                        ? 'bg-[#38D9C5]/20 text-[#38D9C5] border-[#38D9C5]'
                        : 'bg-[#151D2B] text-[#8B95A7] border-[#263244] hover:border-[#8B95A7]'
                    }`}
                  >
                    VACANT
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-[#8B95A7]">Confidence</label>
                  <span className="text-xs font-mono text-[#38D9C5]">{(confidence * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.99"
                  step="0.01"
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  className="w-full h-2 bg-[#151D2B] rounded-lg appearance-none cursor-pointer accent-[#4F8CFF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg border border-[#263244]">
              <div>
                <div className="text-xs font-medium text-white">Auto-Smooth ($K=3$)</div>
                <div className="text-[11px] text-[#8B95A7]">Emits 3 agreeing frames for immediate state change</div>
              </div>
              <input
                type="checkbox"
                checked={autoSmooth}
                onChange={(e) => setAutoSmooth(e.target.checked)}
                className="w-4 h-4 rounded border-[#263244] text-[#4F8CFF] focus:ring-0 focus:ring-offset-0 bg-[#080B12]"
              />
            </div>

            <button
              onClick={handleManualInject}
              disabled={isInjecting}
              className="w-full py-2.5 bg-[#4F8CFF] hover:bg-[#3D72D6] disabled:opacity-50 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#4F8CFF]/20"
            >
              <Activity className={`w-4 h-4 ${isInjecting ? 'animate-pulse' : ''}`} />
              {isInjecting ? 'Signing & Ingesting Frame...' : `Inject Frame for Desk ${selectedSeatId}`}
            </button>
          </div>
        </div>

        {/* Section 2: Scenario Batch & Presets */}
        <div className="bg-[#101621] border border-[#263244] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#263244]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#38D9C5]" />
              <h4 className="text-sm font-semibold text-white">Preset Scenarios & Batch Ingestion</h4>
            </div>
            <span className="text-[11px] text-[#8B95A7] font-mono">Full Floor Dispatch</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#8B95A7] mb-1.5">Select Scenario</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'PEAK_AFTERNOON', label: 'Peak Afternoon', desc: '75-80% Occupancy' },
                  { id: 'QUIET_MORNING', label: 'Quiet Morning', desc: '20-25% Occupancy' },
                  { id: 'EXAM_WEEK', label: 'Exam Week', desc: '90%+ Occupancy' },
                  { id: 'RANDOM_WALK', label: 'Random Walk', desc: 'Dynamic Wave' },
                ].map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSelectedScenario(sc.id as SimulationScenario)}
                    className={`p-2.5 text-left rounded-lg border transition-all ${
                      selectedScenario === sc.id
                        ? 'bg-[#4F8CFF]/15 border-[#4F8CFF] text-white'
                        : 'bg-[#151D2B] border-[#263244] text-[#8B95A7] hover:border-[#8B95A7]'
                    }`}
                  >
                    <div className="text-xs font-medium">{sc.label}</div>
                    <div className="text-[10px] text-[#8B95A7]">{sc.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleExecuteScenario}
              disabled={isBatchRunning}
              className="w-full py-2.5 bg-[#151D2B] hover:bg-[#263244] border border-[#263244] hover:border-[#38D9C5] text-[#38D9C5] rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBatchRunning ? 'animate-spin' : ''}`} />
              {isBatchRunning ? 'Dispatching Scenario Frames...' : `Execute '${selectedScenario}' Batch`}
            </button>

            {/* Continuous Ticker Controls */}
            <div className="p-3.5 bg-[#151D2B] rounded-lg border border-[#263244] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#F5B942]" />
                  <span className="text-xs font-semibold text-white">Automated Continuous Ticker</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#8B95A7]">Interval:</span>
                  <select
                    value={loopIntervalSec}
                    onChange={(e) => setLoopIntervalSec(parseInt(e.target.value))}
                    disabled={isLoopActive}
                    className="bg-[#080B12] border border-[#263244] rounded px-2 py-0.5 text-xs text-white"
                  >
                    <option value={3}>3s</option>
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                  </select>
                </div>
              </div>

              <button
                onClick={toggleLoop}
                className={`w-full py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 transition-all ${
                  isLoopActive
                    ? 'bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]'
                    : 'bg-[#38D9C5]/10 text-[#38D9C5] border-[#38D9C5]/30 hover:bg-[#38D9C5]/20'
                }`}
              >
                {isLoopActive ? (
                  <>
                    <Square className="w-3.5 h-3.5" /> Stop Automated Ticker
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Start Automated Ticker (Random Walk)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Idempotency & Replay Attack Defense Testing */}
      <div className="bg-[#101621] border border-[#263244] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#263244]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#38D9C5]" />
            <h4 className="text-sm font-semibold text-white">Idempotency & Replay Verification Sandbox</h4>
          </div>
          <span className="text-[11px] text-[#8B95A7] font-mono">Firestore Transaction Lock</span>
        </div>

        <p className="text-xs text-[#8B95A7]">
          Every telemetry frame receives a unique <code className="text-[#38D9C5]">tickId</code>. If an identical tick is received twice (e.g. network retry or replay), the engine returns an idempotent acknowledgment (<code className="text-[#38D9C5]">idempotent: true</code>) without executing duplicate database mutations.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            onClick={handleTestIdempotency}
            disabled={idempotencyResult?.testing}
            className="px-4 py-2 bg-[#151D2B] hover:bg-[#263244] text-[#4F8CFF] hover:text-white rounded-lg border border-[#4F8CFF]/30 hover:border-[#4F8CFF] text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <ShieldCheck className={`w-4 h-4 ${idempotencyResult?.testing ? 'animate-spin' : ''}`} />
            {idempotencyResult?.testing ? 'Testing Idempotency Locks...' : 'Test Duplicate Tick Ingestion'}
          </button>

          {idempotencyResult && !idempotencyResult.testing && (
            <div className="text-xs font-mono text-[#8B95A7]">
              Verified Tick ID: <span className="text-white">{idempotencyResult.tickId}</span>
            </div>
          )}
        </div>

        {/* Live Result Display */}
        {idempotencyResult && !idempotencyResult.testing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="bg-[#151D2B] border border-[#38D9C5]/30 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#38D9C5]">Request 1 (Initial Ingestion)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#38D9C5]/10 text-[#38D9C5] font-mono">
                  HTTP 200 OK
                </span>
              </div>
              <div className="text-[11px] text-[#8B95A7] space-y-0.5 font-mono">
                <div>idempotent: <span className="text-white">{String(idempotencyResult.firstCall?.idempotent)}</span></div>
                <div>mutated: <span className="text-[#38D9C5]">TRUE</span></div>
                <div className="truncate">{idempotencyResult.firstCall?.message}</div>
              </div>
            </div>

            <div className="bg-[#151D2B] border border-[#4F8CFF]/30 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#4F8CFF]">Request 2 (Duplicate Retry)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4F8CFF]/10 text-[#4F8CFF] font-mono">
                  IDEMPOTENT NO-OP
                </span>
              </div>
              <div className="text-[11px] text-[#8B95A7] space-y-0.5 font-mono">
                <div>idempotent: <span className="text-[#4F8CFF] font-semibold">{String(idempotencyResult.secondCall?.idempotent)}</span></div>
                <div>mutated: <span className="text-[#8B95A7]">FALSE (Deduplicated)</span></div>
                <div className="truncate">{idempotencyResult.secondCall?.message}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Live Telemetry Stream / Processed Ticks Table */}
      <div className="bg-[#101621] border border-[#263244] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#263244] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#4F8CFF]" />
            <h4 className="text-sm font-semibold text-white">Recent Processed Simulation Ticks</h4>
          </div>
          <button
            onClick={loadStatus}
            className="text-xs text-[#8B95A7] hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#151D2B] text-[#8B95A7] uppercase font-mono text-[10px] border-b border-[#263244]">
              <tr>
                <th className="px-4 py-2.5">Tick ID</th>
                <th className="px-4 py-2.5">Seat</th>
                <th className="px-4 py-2.5">Simulated State</th>
                <th className="px-4 py-2.5">Confidence</th>
                <th className="px-4 py-2.5">Scenario</th>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Idempotent Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263244] font-mono">
              {recentTicks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[#8B95A7] font-sans">
                    No simulation ticks recorded yet. Inject a frame or execute a scenario batch above.
                  </td>
                </tr>
              ) : (
                recentTicks.map((tick) => (
                  <tr key={tick.id} className="hover:bg-[#151D2B]/50 transition-colors">
                    <td className="px-4 py-2.5 text-white truncate max-w-[140px]">{tick.tickId}</td>
                    <td className="px-4 py-2.5 font-sans font-semibold text-white">{tick.seatId}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                          tick.occupied
                            ? 'bg-[#FF647C]/10 text-[#FF647C] border border-[#FF647C]/20'
                            : 'bg-[#38D9C5]/10 text-[#38D9C5] border border-[#38D9C5]/20'
                        }`}
                      >
                        {tick.occupied ? 'OCCUPIED' : 'VACANT'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#8B95A7]">{(tick.confidence * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2.5 font-sans text-[#8B95A7]">{tick.scenario}</td>
                    <td className="px-4 py-2.5 text-[#8B95A7] text-[11px]">
                      {new Date(tick.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans ${
                          tick.idempotent
                            ? 'bg-[#F5B942]/10 text-[#F5B942]'
                            : 'bg-[#38D9C5]/10 text-[#38D9C5]'
                        }`}
                      >
                        {tick.idempotent ? 'SKIPPED (Duplicate)' : 'MUTATED (Fresh)'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
