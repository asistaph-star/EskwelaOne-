import React, { useState, useEffect } from 'react';
import type { ScannerState, GateScanPayload } from '../shared/hooks/useHardwareScanner';
import { GateHeader } from './components/GateHeader';
import { CampusMediaPlayback } from './components/CampusMediaPlayback';

export interface RecentScan extends GateScanPayload {}

interface GateTerminalScreenProps {
  scannerState: ScannerState;
  hasFocus: boolean;
  recentScans: RecentScan[];
}

const GATE_IDLE_MEDIA_DELAY_MS = 60_000;

export function GateTerminalScreen({ scannerState, hasFocus, recentScans }: GateTerminalScreenProps) {
  const [isIdleMedia, setIsIdleMedia] = useState(false);

  // Idle Timer Logic
  useEffect(() => {
    if (scannerState.status !== 'idle' || !hasFocus) {
      setIsIdleMedia(false);
      return;
    }
    
    // Start idle timer
    const timer = setTimeout(() => {
      setIsIdleMedia(true);
    }, GATE_IDLE_MEDIA_DELAY_MS);
    
    return () => clearTimeout(timer);
  }, [scannerState.status, hasFocus]);

  // Determine the two "featured" latest scans for the bottom panels.
  const featuredScans: RecentScan[] = [];
  
  if (scannerState.status === 'success' && scannerState.payload) {
     featuredScans.push(scannerState.payload);
     if (recentScans.length > 0) {
       if (recentScans[0].time === scannerState.payload.time) {
          if (recentScans.length > 1) featuredScans.push(recentScans[1]);
       } else {
          featuredScans.push(recentScans[0]);
       }
     }
  } else {
     if (recentScans.length > 0) featuredScans.push(recentScans[0]);
     if (recentScans.length > 1) featuredScans.push(recentScans[1]);
  }

  const leftScan = featuredScans[0] || null;
  const rightScan = featuredScans[1] || null;

  return (
    <div className="relative flex h-screen w-full flex-col bg-gradient-to-b from-slate-100 to-white font-sans text-slate-800">
      
      {/* Huge Background Watermark */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.06] overflow-hidden">
         <img src="/school_seal.png" alt="Watermark" className="w-[250%] max-w-none md:w-[150%] lg:w-[130%] object-contain" />
      </div>

      {/* 1. Header Section */}
      <div className="relative z-20">
        <GateHeader />
      </div>

      {/* Campus Media Layer (Takes up main and bottom sections when idle) */}
      {isIdleMedia ? (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
          <CampusMediaPlayback onAllFailed={() => setIsIdleMedia(false)} />
        </div>
      ) : (
        <>
          {/* 2. Central Content Area (Attendance Grid) */}
          <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-8">


        {/* Large Multi-Column List (Flows vertically first) */}
        <div 
          className="relative z-10 h-full w-full columns-1 lg:columns-2 xl:columns-3 gap-6 space-y-3 overflow-hidden" 
          style={{ columnFill: 'auto' }}
        >
          {recentScans.slice(0, 32).map((scan, i) => (
            <div key={i} className="flex h-[4.5rem] break-inside-avoid items-center gap-3 border-b border-slate-200 bg-white/50 px-3 transition-colors hover:bg-white rounded-lg">
               <img src="/student_photo.png" alt="" className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5" />
               <div className="flex min-w-0 flex-col overflow-hidden justify-center space-y-0.5">
                 <div className="truncate text-xs font-bold uppercase tracking-tight text-slate-800 leading-none">
                    {scan.studentName}
                 </div>
                 <div className="truncate text-[9px] font-semibold tracking-wider text-slate-500 uppercase leading-none">
                    GRADE 10 • RIZAL
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 leading-none">
                   <span className={scan.action === 'Time In' ? 'text-green-600' : 'text-blue-600'}>
                     {scan.action === 'Time In' ? 'IN' : 'OUT'}
                   </span>
                   <span>{new Date(scan.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                 </div>
               </div>
            </div>
          ))}
        </div>
        
        {/* State Overlays */}
        {scannerState.status === 'submitting' && (
           <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm">
             <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-6 py-4 shadow-xl">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <span className="text-sm font-semibold tracking-widest text-slate-700 uppercase">Processing</span>
             </div>
           </div>
        )}
        {scannerState.status === 'error' && (
           <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm">
             <div className="flex flex-col items-center rounded-lg border border-red-100 bg-red-50/80 px-8 py-6 shadow-2xl max-w-sm text-center">
               <div className="text-sm font-bold tracking-widest text-red-600 uppercase">Scan Failed</div>
               <div className="mt-2 text-base font-medium text-slate-800">{scannerState.errorMessage}</div>
             </div>
           </div>
        )}
        {!hasFocus && (
           <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm">
             <div className="flex flex-col items-center rounded-lg border border-amber-100 bg-amber-50/80 px-8 py-6 shadow-2xl max-w-sm text-center">
               <div className="text-sm font-bold tracking-widest text-amber-600 uppercase">Scanner Paused</div>
               <div className="mt-2 text-base font-medium text-slate-800">Please click anywhere on this window to resume scanning.</div>
             </div>
           </div>
        )}
        {scannerState.status === 'expired' && (
           <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 backdrop-blur-md">
             <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-white px-8 py-6 shadow-2xl max-w-sm text-center">
               <div className="text-sm font-bold tracking-widest text-slate-500 uppercase">Session Expired</div>
               <div className="mt-2 text-base font-medium text-slate-800">Gate operator login is required to continue.</div>
             </div>
           </div>
        )}
      </main>

      {/* 3. Bottom Detailed Profile Section (Two side-by-side panels) */}
      <section className="relative z-10 flex h-72 shrink-0 justify-center gap-4 bg-transparent p-4 md:h-80 md:gap-8 md:p-6 lg:h-[26rem]">
         <div className="w-full max-w-md lg:max-w-lg">
           <ProfileCard scan={leftScan} />
         </div>
         <div className="w-full max-w-md lg:max-w-lg">
           <ProfileCard scan={rightScan} />
         </div>
      </section>
      </>
      )}

      {/* 4. Footer Section (Status Bar) */}
      <footer className="relative z-10 flex shrink-0 items-center justify-end gap-6 bg-slate-900 px-6 py-2.5 text-xs font-bold tracking-widest text-white shadow-inner">
        <div className="text-[10px] text-slate-500">
           BIOMETRIC SYSTEM - STATUS: ONLINE
        </div>
        <div className="flex items-center gap-3">
           <span className="text-slate-400">SCANNER READY</span>
           <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
        </div>
      </footer>
    </div>
  );
}

function ProfileCard({ scan }: { scan: RecentScan | null }) {
  if (!scan) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/50">
        <span className="text-sm font-bold tracking-widest text-slate-400 uppercase">Awaiting Scan</span>
      </div>
    );
  }

  const isIn = scan.action === 'Time In';
  const statusColor = isIn ? 'text-red-600' : 'text-blue-600'; // Using red/green styling as requested in spec ("clear red or green IN stamp")
  
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      
      {/* Top Status & Time Stamp */}
      <div className="absolute left-5 top-4 z-10 flex flex-col items-center">
         <span className={`text-4xl md:text-5xl lg:text-7xl font-black leading-none tracking-tighter ${isIn ? 'text-red-600' : 'text-emerald-600'}`}>
           {isIn ? 'IN' : 'OUT'}
         </span>
         <span className={`text-[10px] md:text-xs font-extrabold uppercase tracking-widest ${isIn ? 'text-red-700' : 'text-emerald-700'} -mt-1`}>
           CHECKED
         </span>
      </div>

      <div className="absolute right-5 top-5 z-10">
         <span className="text-xl md:text-2xl font-black tracking-tight text-slate-800">
           {new Date(scan.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
         </span>
      </div>

      {/* Large Profile Picture */}
      <div className="flex min-h-0 flex-1 w-full items-end justify-center bg-white pt-6">
        <img 
          src="/student_photo.png" 
          alt={scan.studentName} 
          className="h-full object-contain mix-blend-multiply" 
        />
      </div>

      {/* Colored Label Bar */}
      <div className="flex w-full shrink-0 flex-col items-center bg-slate-600 py-3.5 text-white md:py-4">
        <h2 className="text-lg font-bold uppercase tracking-wider md:text-xl lg:text-2xl">
          {scan.studentName}
        </h2>
        <div className="mt-0.5 text-xs font-semibold tracking-widest text-slate-300 md:text-sm">
          GRADE 10 • RIZAL
        </div>
      </div>
    </div>
  );
}
