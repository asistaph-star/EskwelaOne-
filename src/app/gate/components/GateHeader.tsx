import React from 'react';

export function GateHeader() {
  return (
    <header className="flex shrink-0 items-center gap-4 border-b-2 border-amber-400 bg-slate-900 px-5 py-3 md:px-6">
      <img src="/school_seal.png" alt="School Seal" className="h-10 w-10 object-contain md:h-12 md:w-12 lg:h-14 lg:w-14" />
      <div className="flex flex-col justify-center">
        <h1 className="text-lg font-semibold tracking-normal text-white md:text-xl lg:text-2xl">
          CALULUT NATIONAL HIGH SCHOOL
        </h1>
      </div>
    </header>
  );
}
