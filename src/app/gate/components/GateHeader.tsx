import React, { useRef } from 'react';
import { GraduationCap } from 'lucide-react';
import { useSchoolSettings } from '../../shared/context/SchoolSettingsContext';

interface GateHeaderProps {
  terminalType: 'student' | 'faculty';
  terminalName?: string;
  terminalId?: string;
  onOpenAdminConfig?: () => void;
}

export function GateHeader({ terminalType, terminalName, terminalId, onOpenAdminConfig }: GateHeaderProps) {
  const isFaculty = terminalType === 'faculty';
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const { settings } = useSchoolSettings();

  const schoolLogo = settings.logoUrl;
  const schoolNameUpper = (settings.schoolName || 'DigiSkwela Campus Gate').toUpperCase();

  // Industry-standard kiosk secret gesture: 5 taps on school seal opens admin maintenance
  const handleSealTap = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current > 2000) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    lastTapTimeRef.current = now;

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      onOpenAdminConfig?.();
    }
  };

  const displayName = terminalName || (isFaculty ? 'Gate 2 - Faculty Entrance' : 'Gate 1 - Main Entrance');

  return (
    <header className="flex shrink-0 items-center justify-between border-b-2 border-amber-400 bg-slate-900 px-5 py-3 md:px-6 select-none">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSealTap}
          className="focus:outline-none cursor-default bg-transparent p-0 border-0"
          aria-label={`${schoolNameUpper} Logo`}
          tabIndex={-1}
        >
          {schoolLogo ? (
            <img src={schoolLogo} alt="School Logo" className="h-10 w-10 object-contain md:h-12 md:w-12 lg:h-14 lg:w-14" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 md:h-12 md:w-12 lg:h-14 lg:w-14">
              <GraduationCap className="h-6 w-6 text-amber-400 md:h-7 md:w-7" />
            </div>
          )}
        </button>
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-normal text-white md:text-lg lg:text-xl leading-tight">
              {schoolNameUpper}
            </h1>
            <span className="text-slate-500 text-xs hidden sm:inline">•</span>
            <span className="text-xs font-bold text-amber-300 tracking-wide uppercase hidden sm:inline">
              {displayName}
            </span>
          </div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-amber-400 mt-0.5">
            {isFaculty ? 'FACULTY GATE ATTENDANCE TERMINAL' : 'STUDENT GATE ATTENDANCE TERMINAL'}
          </div>
        </div>
      </div>

      {/* Clean, Non-Interactive Station Role Badge & Terminal Identity */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
          <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider ${
            isFaculty
              ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60 shadow-sm'
              : 'bg-blue-950 text-blue-300 border border-blue-700/60 shadow-sm'
          }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${isFaculty ? 'bg-indigo-400 animate-pulse' : 'bg-blue-400 animate-pulse'}`} />
            <span>{isFaculty ? 'FACULTY ONLY' : 'STUDENTS ONLY'}</span>
          </div>
          <div className="text-[9px] font-mono text-slate-400 mt-1 uppercase tracking-wider">
            STATION: {terminalId || (isFaculty ? 'term-gate-2' : 'term-gate-1')}
          </div>
        </div>
      </div>
    </header>
  );
}
