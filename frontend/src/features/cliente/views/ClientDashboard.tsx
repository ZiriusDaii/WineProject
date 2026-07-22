import React from 'react';
import { Button } from '../../../components/ui/Button';

export const ClientDashboard: React.FC = () => {
  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h2 className="serif-title text-2xl text-[#3B0019]">Mis Citas</h2>
        <p className="text-xs text-[#78716C]">Gestiona tu agenda de bienestar y reservas activas</p>
      </header>
      
      {/* Cita Activa Mock */}
      <div className="bg-white border border-[#EADEC9]/40 p-4 rounded-xl space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#A68F63] font-semibold">Próxima Cita</span>
            <h3 className="font-semibold text-sm text-[#44403C] mt-1">Manicura Premium Gel</h3>
            <p className="text-xs text-[#78716C]">Con Sofía Valenzuela</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] bg-[#EADEC9]/30 text-[#5C0632] font-semibold">Confirmada</span>
        </div>
        
        <div className="border-t border-[#EADEC9]/20 pt-3 flex justify-between text-xs text-[#44403C]">
          <div>
            <span className="block text-[#78716C] text-[10px]">Fecha</span>
            <span className="font-medium">18 de Junio, 2026</span>
          </div>
          <div className="text-right">
            <span className="block text-[#78716C] text-[10px]">Hora</span>
            <span className="font-medium">10:00 AM</span>
          </div>
        </div>
      </div>

      <Button variant="outline" className="py-2.5 text-xs">
        Programar Nueva Cita
      </Button>
    </div>
  );
};
