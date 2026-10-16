import React from 'react';

interface GateHeaderProps {
  terminalType: 'student' | 'faculty';
  onOpenAdminConfig?: () => void;
}

export function GateHeader({ terminalType, onOpenAdminConfig }: GateHeaderProps) {
  const isFaculty = terminalType === 'faculty';

  return (
    <header className="flex shrink-0 items-center justify-between border-b-2 border-amber-400 bg-slate-900 px-5 py-3 md:px-6">
      <div className="flex items-center gap-4">
        <img src="/school_seal.png" alt="School Seal" className="h-10 w-10 object-contain md:h-12 md:w-12 lg:h-14 lg:w-14" />
        <div className="flex flex-col justify-center">
          <h1 className="text-lg font-semibold tracking-normal text-white md:text-xl lg:text-2xl leading-tight">
            CALULUT INTEGRATED SCHOOL
          </h1>
          <div className="text-[10px] font-bold tracking-wider uppercase text-amber-400">
            {isFaculty ? 'FACULTY GATE ATTENDANCE — FACULTY ONLY' : 'STUDENT GATE ATTENDANCE — STUDENTS ONLY'}
          </div>
        </div>
      </div>

      {/* Dedicated Locked Station Badge (Clickable for Admin Reconfiguration Challenge) */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenAdminConfig}
          title="Click to authorize station role reconfiguration (Admin / ITAdmin credentials required)"
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition hover:opacity-90 active:scale-95 cursor-pointer ${
            isFaculty
              ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60 shadow-sm hover:bg-indigo-900'
              : 'bg-blue-950 text-blue-300 border border-blue-700/60 shadow-sm hover:bg-blue-900'
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${isFaculty ? 'bg-indigo-400 animate-pulse' : 'bg-blue-400 animate-pulse'}`} />
          <span>{isFaculty ? 'FACULTY ONLY' : 'STUDENTS ONLY'}</span>
          <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-1.5 ml-0.5">⚙ Setup</span>
        </button>
      </div>
    </header>
  );
}
