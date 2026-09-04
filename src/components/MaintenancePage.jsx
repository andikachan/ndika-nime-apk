import React from 'react';

const MaintenancePage = ({ message }) => {
  return (
    <div className="min-h-screen bg-[#0b0b10] flex flex-col items-center justify-center px-6 text-center">
      <img
        src="/img/nefora.webp"
        alt="Ndichan"
        width="80"
        height="80"
        className="w-16 md:w-20 object-contain mb-6 opacity-80"
      />
      <div className="w-12 h-12 border-2 border-[#d4a73c]/20 border-t-[#d4a73c] rounded-full animate-spin mb-6"></div>
      <h1 className="text-white font-black text-2xl md:text-3xl mb-3">Sedang Maintenance</h1>
      <p className="text-white/50 text-sm md:text-base max-w-md leading-relaxed">
        {message || 'Ndichan sedang dalam perbaikan. Balik lagi sebentar lagi, ya!'}
      </p>
    </div>
  );
};

export default MaintenancePage;
