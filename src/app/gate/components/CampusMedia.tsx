import React from 'react';

export function CampusMedia() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-100">
      <div 
        className="absolute -inset-10 z-0 bg-cover bg-center opacity-40 blur-2xl filter"
        style={{ backgroundImage: 'url(/calulut_campus_media.jpg)' }} 
      />
      <img
        src="/calulut_campus_media.jpg"
        alt="Campus Media"
        className="relative z-10 h-full w-full object-contain drop-shadow-xl"
      />
    </div>
  );
}
