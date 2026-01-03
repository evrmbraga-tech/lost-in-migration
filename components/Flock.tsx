
import React from 'react';
import { Direction } from '../types';
import { DIRECTION_ROTATION, ArrowIcon } from '../constants';

interface FlockProps {
  center: Direction;
  others: Direction;
}

const Flock: React.FC<FlockProps> = ({ center, others }) => {
  // Pattern: 5 arrows in a cross
  //   O
  // O C O
  //   O
  // We use transition-none and duration-0 to ensure the change is visually instant.
  return (
    <div className="relative w-64 h-64 flex items-center justify-center transition-none duration-0">
      {/* Top */}
      <div className={`absolute top-0 transition-none duration-0 ${DIRECTION_ROTATION[others]} text-slate-500 opacity-40`}>
        <ArrowIcon />
      </div>
      
      {/* Bottom */}
      <div className={`absolute bottom-0 transition-none duration-0 ${DIRECTION_ROTATION[others]} text-slate-500 opacity-40`}>
        <ArrowIcon />
      </div>

      {/* Left */}
      <div className={`absolute left-0 transition-none duration-0 ${DIRECTION_ROTATION[others]} text-slate-500 opacity-40`}>
        <ArrowIcon />
      </div>

      {/* Right */}
      <div className={`absolute right-0 transition-none duration-0 ${DIRECTION_ROTATION[others]} text-slate-500 opacity-40`}>
        <ArrowIcon />
      </div>

      {/* Center - The Target */}
      <div className={`relative transition-none duration-0 ${DIRECTION_ROTATION[center]} text-cyan-400 scale-125 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]`}>
        <ArrowIcon />
      </div>
    </div>
  );
};

export default Flock;
