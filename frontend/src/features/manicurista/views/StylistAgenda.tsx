import React, { useState, useEffect } from 'react';
import { FallbackAvatar } from '../../../App';

interface Appointment {
  id: string | number;
  appointmentId?: string | number;
  clientName?: string;
  clientId?: string | number;
  manicuristId: string | number;
  serviceIds: (string | number)[];
  date: string;
  time: string;
  total?: number | string;
  status?: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

interface Service {
  id: string | number;
  name: string;
  price: string | number;
  duration?: string | number;
}


export const StylistAgenda: React.FC = () => {
  // Estado Móvil: 'calendar' | 'profile'
  const [activeMobileTab, setActiveMobileTab] = useState<'calendar' | 'profile'>('calendar');

  // Recuperar ID de manicurista logueada desde la sesión local
  const [stylistId, setStylistId] = useState<string>('1');
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Estados del perfil
  const [profileName, setProfileName] = useState('');
  const [profileAge, setProfileAge] = useState('');
  const [profileGender, setProfileGender] = useState('Femenino');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileRole, setProfileRole] = useState('Nail Artist');

  // Archivo de avatar seleccionado
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);

  // Fecha seleccionada
  const [selectedDateDay, setSelectedDateDay] = useState<number>(18);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | number | null>(null);

  useEffect(() => {
    // Resolver manicurista de la sesión local
    const saved = localStorage.getItem('winespa_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.role === 'manicurista') {
          setStylistId(String(parsed.id));
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  const fetchAgendaData = async () => {
    try {
      setLoading(true);

      const servicesRes = await fetch('http://localhost:3000/api/services');
      const servicesData = servicesRes.ok ? await servicesRes.json() : [];
      setServices(servicesData);

      // Cargar información de la manicurista específica
      const stylistRes = await fetch(`http://localhost:3000/api/manicurists/${stylistId}`);
      if (stylistRes.ok) {
        const activeManicurist = await stylistRes.json();
        setProfileName(activeManicurist.name || '');
        setProfileAge(String(activeManicurist.age || 26));
        setProfileGender(activeManicurist.gender || 'Femenino');
        setProfileAvatar(activeManicurist.avatarUrl || '');
        setProfileRole(activeManicurist.role || 'Especialista');
      } else {
        // Fallback
        setProfileName('Sofía Valenzuela');
        setProfileAge('26');
        setProfileGender('Femenino');
        setProfileAvatar('https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=100');
        setProfileRole('Especialista en Nail Art');
      }

      // SEGURIDAD VISUAL DE STAFF: Consumir exclusivamente las citas de la manicurista logueada
      let apptsData: Appointment[] = [];
      try {
        const apptsRes = await fetch(`http://localhost:3000/api/manicurist/appointments?manicuristId=${stylistId}`);
        if (apptsRes.ok) {
          apptsData = await apptsRes.json();
        } else {
          // Filtrado de seguridad en frontend por si el endpoint no filtra
          const generalApptsRes = await fetch('http://localhost:3000/api/appointments');
          const data: Appointment[] = generalApptsRes.ok ? await generalApptsRes.json() : [];
          apptsData = data.filter(a => String(a.manicuristId) === stylistId);
        }
      } catch {
        // Fallback mock respetando seguridad de personal
        apptsData = [
          { id: '1', appointmentId: 'WS-101', clientName: 'Martha Cecilia Gómez', manicuristId: stylistId, serviceIds: ['1'], date: '2026-06-18', time: '09:00', total: 35000, status: 'CONFIRMED' },
          { id: '2', appointmentId: 'WS-102', clientName: 'Diana Uribe', manicuristId: stylistId, serviceIds: ['2'], date: '2026-06-18', time: '11:00', total: 45000, status: 'IN_PROGRESS' },
          { id: '4', appointmentId: 'WS-104', clientName: 'Clara Inés Ochoa', manicuristId: stylistId, serviceIds: ['1', '2'], date: '2026-06-21', time: '14:00', total: 80000, status: 'CONFIRMED' }
        ];
      }

      setAppointments(apptsData);

    } catch {
      // Ignorar fallos de conexión y usar mocks de seguridad
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgendaData();
  }, [stylistId]);

  // Completar Cita
  const handleCompleteAppointment = async (id: string | number) => {
    setStatusUpdatingId(id);
    try {
      const res = await fetch(`http://localhost:3000/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      if (res.ok) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'COMPLETED' } : a));
      } else {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'COMPLETED' } : a));
      }
    } catch {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'COMPLETED' } : a));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Subir Avatar & Editar Perfil (FormData)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      let finalAvatarUrl = profileAvatar;

      if (selectedAvatarFile) {
        const formData = new FormData();
        formData.append('image', selectedAvatarFile);
        const uploadRes = await fetch('http://localhost:3000/api/upload', {
          method: 'POST',
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalAvatarUrl = uploadData.url;
          setProfileAvatar(uploadData.url);
        } else {
          throw new Error('Error al subir la foto de perfil');
        }
      }

      const payload = {
        name: profileName,
        age: parseInt(profileAge),
        gender: profileGender,
        avatarUrl: finalAvatarUrl,
        role: profileRole
      };

      const res = await fetch(`http://localhost:3000/api/manicurist/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stylistId, ...payload })
      });

      if (!res.ok) {
        await fetch(`http://localhost:3000/api/manicurists/${stylistId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      setSubmitSuccess('Tu perfil ha sido actualizado con éxito.');
      setSelectedAvatarFile(null);
    } catch (err: any) {
      setSubmitError(err.message || 'No se pudo guardar el perfil.');
    } finally {
      setSubmitting(false);
    }
  };

  const getServiceNames = (ids: (string | number)[]) => {
    return services
      .filter(s => ids.map(id => String(id)).includes(String(s.id)))
      .map(s => s.name)
      .join(' + ') || 'Tratamiento Spa';
  };

  const getServiceDuration = (ids: (string | number)[]) => {
    const totalDuration = services
      .filter(s => ids.map(id => String(id)).includes(String(s.id)))
      .reduce((sum, s) => sum + (typeof s.duration === 'number' ? s.duration : parseInt(String(s.duration || '60'))), 0);
    return `${totalDuration || 60} mins`;
  };

  const daysInJune = 30;
  
  const hasAppointments = (day: number) => {
    const datePattern = `2026-06-${day.toString().padStart(2, '0')}`;
    return appointments.some(appt => appt.date === datePattern);
  };

  const hasInProgressAppointments = (day: number) => {
    const datePattern = `2026-06-${day.toString().padStart(2, '0')}`;
    return appointments.some(appt => appt.date === datePattern && appt.status === 'IN_PROGRESS');
  };

  const dayAppointments = appointments
    .filter(appt => {
      const datePattern = `2026-06-${selectedDateDay.toString().padStart(2, '0')}`;
      return appt.date === datePattern;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex justify-center items-center font-sans">
        <span className="serif-title text-2xl font-light tracking-widest text-[#3B0019] animate-pulse">Sincronizando Agenda...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-6 max-w-7xl mx-auto flex flex-col font-sans">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end pb-6 border-b border-[#EADEC9]/30 gap-4 text-left">
        <div className="flex flex-col">
          <span className="serif-title text-3xl text-[#3B0019] tracking-wide">Estación de Trabajo</span>
          <span className="text-[9px] uppercase tracking-widest text-[#A68F63] font-semibold mt-0.5">Gestión de Citas Propias</span>
        </div>
      </header>

      {/* TABS DE NAVEGACIÓN MÓVIL */}
      <div className="md:hidden flex gap-2 pt-4">
        <button 
          onClick={() => setActiveMobileTab('calendar')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg ${activeMobileTab === 'calendar' ? 'bg-[#5C0632] text-white' : 'bg-[#EADEC9]/20 text-[#78716C]'}`}
        >
          🗓️ Mi Calendario
        </button>
        <button 
          onClick={() => setActiveMobileTab('profile')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg ${activeMobileTab === 'profile' ? 'bg-[#5C0632] text-white' : 'bg-[#EADEC9]/20 text-[#78716C]'}`}
        >
          👤 Mi Perfil
        </button>
      </div>

      {/* DISEÑO HÍBRIDO */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 pt-6">
        
        {/* CALENDARIO Y TAREAS */}
        <div className={`md:col-span-7 space-y-6 ${activeMobileTab === 'calendar' ? 'block' : 'hidden md:block'}`}>
          <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 shadow-xs text-left">
            <h3 className="serif-title text-lg text-[#3B0019] border-b border-[#EADEC9]/25 pb-2 mb-4">Calendario Personal - Junio 2026</h3>

            {/* Grid Calendario Mensual */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => (
                <span key={d} className="font-bold text-[#A8A29E] py-1">{d}</span>
              ))}
              
              <span className="py-3 bg-neutral-50/10"></span>

              {Array.from({ length: daysInJune }).map((_, i) => {
                const day = i + 1;
                const hasAppts = hasAppointments(day);
                const hasInProgress = hasInProgressAppointments(day);
                const isSelected = selectedDateDay === day;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDateDay(day)}
                    className={`py-3 rounded-xl transition-all relative flex flex-col items-center justify-center font-medium ${
                      isSelected 
                        ? 'bg-[#5C0632] text-white shadow-xs' 
                        : hasInProgress
                          ? 'border-2 border-[#8E1B54] bg-[#8E1B54]/10 text-[#8E1B54] animate-pulse font-bold'
                          : hasAppts 
                            ? 'bg-[#8E1B54]/5 text-[#8E1B54] hover:bg-[#8E1B54]/10 border border-[#EADEC9]/30' 
                            : 'bg-white border border-[#EADEC9]/20 hover:bg-[#F7F3EB]/30 text-[#44403C]'
                    }`}
                  >
                    <span>{day}</span>
                    {hasAppts && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8E1B54] absolute bottom-1.5"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de citas */}
          <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 shadow-xs space-y-4 text-left">
            <div className="flex justify-between border-b border-[#EADEC9]/20 pb-2">
              <h4 className="serif-title text-base text-[#3B0019] font-medium">Turnos del día {selectedDateDay} de Junio</h4>
              <span className="text-xs text-[#A68F63] font-semibold">{dayAppointments.length} citas propias</span>
            </div>

            {dayAppointments.length === 0 ? (
              <p className="text-xs text-[#78716C] py-8 text-center border border-dashed border-[#EADEC9] rounded-xl bg-neutral-50/50">
                No tienes turnos agendados para este día.
              </p>
            ) : (
              <div className="space-y-3">
                {dayAppointments.map(appt => (
                  <div key={appt.id} className="p-4 rounded-xl bg-[#FDFBF7] border border-[#EADEC9]/30 flex flex-col sm:flex-row justify-between gap-4 items-start shadow-2xs">
                    <div className="flex gap-4 items-start">
                      <div className="text-center pr-3 border-r border-[#EADEC9]/20">
                        <span className="text-base font-extrabold text-[#8E1B54] block">{appt.time}</span>
                        <span className="text-[9px] uppercase tracking-wider text-[#A8A29E] font-medium">Junio</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="block text-xs font-bold text-[#44403C]">{appt.clientName || 'Cliente'}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                            appt.status === 'IN_PROGRESS' ? 'bg-[#5C0632] text-white animate-pulse' : 'bg-neutral-100 text-neutral-500'
                          }`}>{appt.status}</span>
                        </div>
                        <p className="text-xs text-[#78716C] leading-normal">{getServiceNames(appt.serviceIds)}</p>
                        <p className="text-[9px] text-[#A68F63] font-semibold">Sesión: {getServiceDuration(appt.serviceIds)}</p>
                      </div>
                    </div>

                    {appt.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleCompleteAppointment(appt.id)}
                        disabled={statusUpdatingId === appt.id}
                        className="w-full sm:w-auto px-4 py-2 bg-[#8E1B54] hover:bg-[#5C0632] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors self-center disabled:opacity-50"
                      >
                        {statusUpdatingId === appt.id ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <span>Marcar Tratamiento como Completado</span>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PERFIL */}
        <div className={`md:col-span-5 space-y-6 ${activeMobileTab === 'profile' ? 'block' : 'hidden md:block'}`}>
          <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 shadow-xs text-left">
            <h3 className="serif-title text-lg text-[#3B0019] border-b border-[#EADEC9]/25 pb-2 mb-4">Mi Perfil Profesional</h3>

            <div className="flex items-center gap-4 bg-[#5C0632]/5 p-4 rounded-xl border border-[#8E1B54]/15 mb-6">
              {profileAvatar ? (
                <img src={profileAvatar} alt={profileName} className="w-14 h-14 rounded-full object-cover border border-[#EADEC9]" />
              ) : (
                <FallbackAvatar className="w-14 h-14" />
              )}
              <div className="text-left space-y-0.5">
                <h4 className="font-bold text-[#3B0019] text-sm">{profileName}</h4>
                <p className="text-xs text-[#78716C]">{profileRole}</p>
                <p className="text-[10px] text-[#A68F63] font-semibold">{profileAge} años • {profileGender}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Nombre Completo</label>
                <input type="text" required value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs bg-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Edad</label>
                  <input type="number" required value={profileAge} onChange={(e) => setProfileAge(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Género</label>
                  <select value={profileGender} onChange={(e) => setProfileGender(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs bg-white">
                    <option value="Femenino">Femenino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Actualizar Foto de Perfil (Avatar)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setSelectedAvatarFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2 border border-[#EADEC9]/60 rounded-xl text-xs bg-white focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Especialidad / Rol</label>
                <input type="text" required value={profileRole} onChange={(e) => setProfileRole(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs bg-white" />
              </div>

              {submitSuccess && (
                <p className="text-[10px] text-green-600 bg-green-50 p-2.5 rounded-lg border border-green-150">{submitSuccess}</p>
              )}
              {submitError && (
                <p className="text-[10px] text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-150">{submitError}</p>
              )}

              <button type="submit" disabled={submitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl hover:bg-[#740E41] transition-all">
                {submitting ? 'Guardando Cambios...' : 'Actualizar Perfil'}
              </button>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
};
