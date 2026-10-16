import React from 'react';

interface GateHeaderProps {
  terminalContext: 'student' | 'faculty';
  onTerminalContextChange: (mode: 'student' | 'faculty') => void;
}

export function GateHeader({ terminalContext, onTerminalContextChange }: GateHeaderProps) {
  const isFaculty = terminalContext === 'faculty';

  return (
    <header className="flex shrink-0 items-center justify-between border-b-2 border-amber-400 bg-slate-900 px-5 py-3 md:px-6">
      <div className="flex items-center gap-4">
        <img src="/school_seal.png" alt="School Seal" className="h-10 w-10 object-contain md:h-12 md:w-12 lg:h-14 lg:w-14" />
        <div className="flex flex-col justify-center">
          <h1 className="text-lg font-semibold tracking-normal text-white md:text-xl lg:text-2xl leading-tight">
            CALULUT INTEGRATED SCHOOL
          </h1>
          <div className="text-[10px] font-bold tracking-wider uppercase text-amber-400">
            {isFaculty ? 'FACULTY GATE TERMINAL — FACULTY ONLY' : 'STUDENT GATE TERMINAL — STUDENTS ONLY'}
          </div>
        </div>
      </div>

      {/* Operator Scanner Context Switcher */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
          Scanner Station Mode:
        </span>
        <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1 border border-slate-700 shadow-inner">
          <button
            type="button"
            onClick={() => onTerminalContextChange('student')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              !isFaculty
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Student Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => onTerminalContextChange('faculty')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              isFaculty
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Faculty Scanner</span>
          </button>
        </div>
      </div>
    </header>
  );
}
