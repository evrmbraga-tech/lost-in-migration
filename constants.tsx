
import React from 'react';

export const GAME_DURATION = 30; // 30 seconds

export const DIRECTION_ROTATION: Record<string, string> = {
  ArrowUp: 'rotate-0',
  ArrowDown: 'rotate-180',
  ArrowLeft: '-rotate-90',
  ArrowRight: 'rotate-90',
};

export const ArrowIcon = ({ className = "w-12 h-12" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
