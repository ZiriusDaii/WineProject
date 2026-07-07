import React from 'react';

export const BusinessOverview: React.FC = () => {
  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h2 className="serif-title text-2xl text-[#3B0019]">WineSpa Business</h2>
        <p className="text-xs text-[#78716C]">Reportes ejecutivos globales y sucursales</p>
      </header>

      <div className="p-5 rounded-2xl bg-white border border-[#EADEC9]/40 space-y-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#A68F63] font-semibold">Ingresos Mensuales</span>
          <span className="block text-3xl font-extrabold text-[#3B0019] mt-1">$4.850.000</span>
        </div>
        
        <div className="h-2 w-full bg-[#EADEC9]/30 rounded-full overflow-hidden">
          <div className="bg-[#8E1B54] h-full w-[78%]"></div>
        </div>
        
        <div className="flex justify-between text-xs text-[#78716C]">
          <span>Meta: $6.000.000</span>
          <span className="font-semibold text-[#8E1B54]">78% completado</span>
        </div>
      </div>
    </div>
  );
};
