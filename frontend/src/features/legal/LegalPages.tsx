import React from 'react';

interface LegalSection {
  heading: string;
  body: string;
}

const DISCLAIMER = 'Este es un texto de referencia (placeholder) y no constituye asesoría legal. Debe ser revisado y aprobado por un abogado antes de su publicación definitiva.';

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

const LegalPageLayout: React.FC<{ title: string; updated: string; sections: LegalSection[]; onBack: () => void }> = ({ title, updated, sections, onBack }) => (
  <div className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full animate-fade-in text-left">
    <button onClick={onBack} className="mb-8 text-xs font-semibold text-[#8E1B54] hover:underline">‹ Volver</button>
    <h1 className="serif-title text-3xl text-[#3B0019] mb-1">{title}</h1>
    <p className="text-[10px] text-[#A68F63] uppercase tracking-wider font-semibold mb-6">Última actualización: {updated}</p>
    <p className="text-xs text-[#78716C] italic bg-[#F7F3EB]/70 border border-[#EADEC9]/40 rounded-xl p-4 mb-8">{DISCLAIMER}</p>
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.heading}>
          <h2 className="serif-title text-lg text-[#5C0632] mb-2">{s.heading}</h2>
          <p className="text-sm text-[#57534E] leading-relaxed">{s.body}</p>
        </section>
      ))}
    </div>
  </div>
);

export const TerminosCondiciones: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LegalPageLayout
    title="Términos y Condiciones"
    updated="Julio 2026"
    onBack={onBack}
    sections={[
      { heading: '1. Objeto', body: LOREM },
      { heading: '2. Uso del Servicio', body: LOREM },
      { heading: '3. Reservas y Pagos', body: LOREM },
      { heading: '4. Responsabilidad', body: LOREM },
      { heading: '5. Modificaciones', body: LOREM },
    ]}
  />
);

export const PoliticaPrivacidad: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LegalPageLayout
    title="Política de Privacidad"
    updated="Julio 2026"
    onBack={onBack}
    sections={[
      { heading: '1. Datos que Recopilamos', body: LOREM },
      { heading: '2. Uso de la Información', body: LOREM },
      { heading: '3. Almacenamiento y Seguridad', body: LOREM },
      { heading: '4. Derechos del Titular', body: LOREM },
      { heading: '5. Contacto', body: LOREM },
    ]}
  />
);

export const PoliticaCancelacion: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LegalPageLayout
    title="Política de Cancelación"
    updated="Julio 2026"
    onBack={onBack}
    sections={[
      { heading: '1. Cancelación por el Cliente', body: LOREM },
      { heading: '2. Reprogramación', body: LOREM },
      { heading: '3. Cancelación por el Spa', body: LOREM },
      { heading: '4. No Presentación (No-Show)', body: LOREM },
    ]}
  />
);
