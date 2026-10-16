import React from 'react';

interface GateHeaderProps {
  terminalType: 'student' | 'faculty';
}

export function GateHeader({ terminalType }: GateHeaderProps) {
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

      {/* Dedicated Locked Station Badge (No Operator Toggle) */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider ${
          isFaculty
            ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60 shadow-sm'
            : 'bg-blue-950 text-blue-300 border border-blue-700/60 shadow-sm'
        }`}>
          <span className={`h-2.5 w-2.5 rounded-full ${isFaculty ? 'bg-indigo-400 animate-pulse' : 'bg-blue-400 animate-pulse'}`} />
          <span>{isFaculty ? 'FACULTY ONLY' : 'STUDENTS ONLY'}</span>
        </div>
      </div>
    </header>
  );
}
