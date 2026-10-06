'use client';

import React from 'react';
import { Floor, Seat, DerivedSeatState } from '@/types';

interface FloorMapSvgProps {
  floor: Floor;
  seats: Seat[];
  derivedStates: Record<string, DerivedSeatState>;
  selectedSeatId: string | null;
  onSelectSeat: (seat: Seat) => void;
}

export default function FloorMapSvg({
  floor,
  seats,
  derivedStates,
  selectedSeatId,
  onSelectSeat,
}: FloorMapSvgProps) {
  const { viewBox, boundaryPolygon, walkwayPaths, zoneLabels } = floor.layoutData;

  const getStateColor = (state: DerivedSeatState) => {
    switch (state) {
      case 'AVAILABLE':
        return '#38D9C5';
      case 'RESERVED':
      case 'NO_SHOW_PENDING':
        return '#F5B942';
      case 'OCCUPIED_VALID':
        return '#FF647C';
      case 'OCCUPIED_UNAUTHORIZED':
        return '#FF4D4D';
      case 'MAINTENANCE':
        return '#8B95A7';
      default:
        return '#38D9C5';
    }
  };

  return (
    <div className="w-full h-auto bg-[#080B12] border border-[#263244] rounded-2xl p-4 overflow-hidden relative shadow-2xl">
      <svg
        viewBox={viewBox || '0 0 1000 600'}
        className="w-full h-full min-h-[400px] select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle grid pattern background */}
          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#151D2B" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        {/* Outer Boundary Polygon */}
        {boundaryPolygon && (
          <polygon
            points={boundaryPolygon}
            fill="#101621"
            stroke="#263244"
            strokeWidth="3"
            rx="12"
          />
        )}

        {/* Walkway Paths */}
        {walkwayPaths?.map((dPath, idx) => (
          <path
            key={`walkway-${idx}`}
            d={dPath}
            fill="none"
            stroke="#151D2B"
            strokeWidth="24"
            strokeLinecap="round"
            strokeDasharray="8 8"
          />
        ))}

        {/* Zone Labels */}
        {zoneLabels?.map((lbl, idx) => (
          <text
            key={`zone-${idx}`}
            x={lbl.x}
            y={lbl.y}
            fill="#9AA7B8"
            fontSize="14"
            fontWeight="600"
            textAnchor="middle"
            className="uppercase tracking-widest opacity-60 pointer-events-none"
          >
            {lbl.name}
          </text>
        ))}

        {/* Interactive Spatial Seat SVG Nodes */}
        {seats.map((seat) => {
          const { x, y, width, height, rotation } = seat.coordinates;
          const state = derivedStates[seat.id] || (seat.isMaintenance ? 'MAINTENANCE' : 'AVAILABLE');
          const color = getStateColor(state);
          const isSelected = selectedSeatId === seat.id;
          const transform = `rotate(${rotation || 0}, ${x + width / 2}, ${y + height / 2})`;

          return (
            <g
              key={seat.id}
              role="button"
              tabIndex={0}
              aria-label={`Seat ${seat.seatNumber}, Status: ${state.replace(/_/g, ' ')}, Zone: ${seat.zone}`}
              transform={transform}
              onClick={() => onSelectSeat(seat)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectSeat(seat);
                }
              }}
              className="cursor-pointer transition-transform duration-200 hover:scale-105 focus:outline-none"
            >
              {/* Seat Container Box */}
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx="10"
                fill="#101621"
                stroke={isSelected ? '#4F8CFF' : color}
                strokeWidth={isSelected ? '4' : '2'}
                className="transition-all duration-300"
              />

              {/* Status Header Color Indicator Bar */}
              <rect
                x={x}
                y={y}
                width={width}
                height="8"
                rx="4"
                fill={color}
              />

              {/* Seat Number Label */}
              <text
                x={x + width / 2}
                y={y + height / 2 - 2}
                fill="#F5F7FA"
                fontSize="14"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {seat.seatNumber}
              </text>

              {/* State Accessibility Text Label */}
              <text
                x={x + width / 2}
                y={y + height / 2 + 18}
                fill={color}
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {state.replace('_', ' ')}
              </text>

              {/* Selection Ring Indicator */}
              {isSelected && (
                <rect
                  x={x - 4}
                  y={y - 4}
                  width={width + 8}
                  height={height + 8}
                  rx="14"
                  fill="none"
                  stroke="#4F8CFF"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
