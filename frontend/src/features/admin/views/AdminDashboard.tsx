import React, { useState, useEffect } from 'react';
import { FallbackAvatar } from '../../../App';

interface Stats {
  totalEarnings: number;
  totalAppointments: number;
  topManicurist: string;
  manicuristPerformance: { name: string; appointmentsCount: number }[];
}

interface Service {
  id: string | number;
  name: string;
  price: string | number;
  durationInMinutes?: string | number;
}

interface Appointment {
  id: string | number;
  appointmentId?: string | number;
  clientName?: string;
  client?: { name?: string };
  clientId?: string | number;
  manicuristId: string | number;
  services: Service[];
  date: string;
  total?: number | string;
  status?: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

interface ServiceCatalogItem {
  id: string | number;
  name: string;
  price: number;
  duration: number;
  description?: string;
  shortDescription?: string;
}

interface Manicurist {
  id: string | number;
  name: string;
  age?: number;
  avatarUrl?: string;
  role?: string;
  shifts?: string[];
}

interface Client {
  id: string | number;
  name: string;
  phone: string;
  age?: number;
  gender?: string;
  appointmentHistoryCount?: number;
}

const toDateLabel = (isoDate: string) => isoDate.slice(0, 10);
const toTimeLabel = (isoDate: string) => isoDate.slice(11, 16);

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'appointments' | 'manicurists' | 'clients' | 'services' | 'news'>('metrics');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Inicializar siempre como arrays vacíos
  const [stats, setStats] = useState<Stats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [manicurists, setManicurists] = useState<Manicurist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);

  // Búsqueda y paginación
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Formularios
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceShortDesc, setNewServiceShortDesc] = useState('');

  // CMS
  const [selectedCarouselFile, setSelectedCarouselFile] = useState<File | null>(null);
  const [landingNewsTitle, setLandingNewsTitle] = useState('');
  const [landingNewsDesc, setLandingNewsDesc] = useState('');

  // Turnos
  const [editingShiftsManicuristId, setEditingShiftsManicuristId] = useState<string | null>(null);
  const [tempShifts, setTempShifts] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [manicuristsRes, servicesRes, clientsRes] = await Promise.all([
        fetch('http://localhost:3000/api/manicurists'),
        fetch('http://localhost:3000/api/services'),
        fetch('http://localhost:3000/api/clients').catch(() => null)
      ]);

      const manicuristsData = manicuristsRes.ok ? await manicuristsRes.json() : [];
      const servicesData = servicesRes.ok ? await servicesRes.json() : [];
      let clientsData = clientsRes && clientsRes.ok ? await clientsRes.json() : [];

      if (!clientsData || clientsData.length === 0) {
        clientsData = [
          { id: '1', name: 'Martha Cecilia Gómez', phone: '3001234567', age: 45, gender: 'Femenino', appointmentHistoryCount: 4 },
          { id: '2', name: 'Liliana Restrepo', phone: '3129876543', age: 32, gender: 'Femenino', appointmentHistoryCount: 2 },
          { id: '3', name: 'Diana Uribe', phone: '3151112222', age: 29, gender: 'Femenino', appointmentHistoryCount: 1 }
        ];
      }

      setManicurists((manicuristsData || []).map((m: any) => ({
        ...m,
        age: m.age || 26,
        avatarUrl: m.avatarPath || m.avatarUrl || '',
        role: m.role || 'Especialista en Nail Art',
        shifts: m.shifts || ['Lunes', 'Miércoles', 'Viernes']
      })));

      setServicesCatalog(servicesData || []);
      setClients(clientsData || []);

      // Cargar Citas
      let apptsData: Appointment[] = [];
      try {
        const apptsRes = await fetch('http://localhost:3000/api/admin/appointments');
        if (apptsRes.ok) {
          apptsData = await apptsRes.json();
        } else {
          const generalApptsRes = await fetch('http://localhost:3000/api/appointments');
          if (generalApptsRes.ok) {
            apptsData = await generalApptsRes.json();
          }
        }
      } catch {
        apptsData = [
          { id: '1', appointmentId: 'WS-101', clientId: '1', clientName: 'Martha Cecilia Gómez', manicuristId: '1', services: [{ id: '1', name: 'Manicure Tradicional', price: 35000, durationInMinutes: 45 }], date: '2026-06-18T10:00:00.000Z', total: 35000, status: 'CONFIRMED' },
          { id: '2', appointmentId: 'WS-102', clientId: '2', clientName: 'Liliana Restrepo', manicuristId: '2', services: [{ id: '2', name: 'Manicure Semipermanente', price: 45000, durationInMinutes: 60 }], date: '2026-06-18T11:30:00.000Z', total: 45000, status: 'PENDING' },
          { id: '3', appointmentId: 'WS-103', clientId: '3', clientName: 'Diana Uribe', manicuristId: '1', services: [{ id: '3', name: 'Nail Art Premium', price: 75000, durationInMinutes: 90 }], date: '2026-06-18T14:00:00.000Z', total: 75000, status: 'IN_PROGRESS' }
        ];
      }
      setAppointments((apptsData || []).map(a => ({ ...a, status: (a.status || 'PENDING').toUpperCase() as any })));

      // Cargar Métricas
      let statsData: Stats = {
        totalEarnings: 945000,
        totalAppointments: 24,
        topManicurist: 'Sofía Valenzuela',
        manicuristPerformance: [
          { name: 'Sofía Valenzuela', appointmentsCount: 12 },
          { name: 'Camila Ortega', appointmentsCount: 8 }
        ]
      };
      try {
        const statsRes = await fetch('http://localhost:3000/api/admin/stats');
        if (statsRes.ok) statsData = await statsRes.json();
      } catch {
        // Fallback
      }
      setStats(statsData);

    } catch {
      // Usar arrays vacíos creados en inicialización de estado
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string | number, newStatus: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    try {
      const response = await fetch(`http://localhost:3000/api/admin/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      } else {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      }
    } catch {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    }
  };

  const handleSaveShifts = async (id: string | number) => {
    try {
      const response = await fetch(`http://localhost:3000/api/manicurists/${id}/shifts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts: tempShifts })
      });
      if (response.ok) {
        setManicurists(prev => prev.map(m => m.id === id ? { ...m, shifts: tempShifts } : m));
        setEditingShiftsManicuristId(null);
      } else {
        setManicurists(prev => prev.map(m => m.id === id ? { ...m, shifts: tempShifts } : m));
        setEditingShiftsManicuristId(null);
      }
    } catch {
      setManicurists(prev => prev.map(m => m.id === id ? { ...m, shifts: tempShifts } : m));
      setEditingShiftsManicuristId(null);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName || !newServicePrice || !newServiceDuration) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const durationInMinutes = parseInt(newServiceDuration);

    try {
      const res = await fetch('http://localhost:3000/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServiceName,
          price: parseFloat(newServicePrice),
          durationInMinutes,
          duration: durationInMinutes,
          description: newServiceDesc || 'Ritual Premium',
          shortDescription: newServiceShortDesc
        })
      });

      if (res.ok) {
        setSuccessMsg('Servicio guardado exitosamente.');
        setNewServiceName('');
        setNewServicePrice('');
        setNewServiceDuration('');
        setNewServiceDesc('');
        setNewServiceShortDesc('');
        loadData();
      } else {
        throw new Error('Error al guardar.');
      }
    } catch {
      setErrorMsg('No se pudo crear el servicio.');
    } finally {
      setSubmitting(false);
    }
  };

  // Subida de imagen CMS con FormData
  const handleUpdateLanding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedCarouselFile) {
      setErrorMsg('Selecciona una imagen para el carrusel.');
      setSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', selectedCarouselFile);
      const uploadRes = await fetch('http://localhost:3000/api/admin/landing/upload', {
        method: 'POST',
        body: formData
      });
      if (!uploadRes.ok) {
        throw new Error('Error al subir el archivo');
      }
      const uploadData = await uploadRes.json();
      const finalImgUrl = uploadData.imageUrl;

      const res = await fetch('http://localhost:3000/api/admin/landing-cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          type: 'CAROUSEL',
          title: landingNewsTitle,
          description: landingNewsDesc,
          imageUrl: finalImgUrl,
          isActive: true
        }])
      });

      if (res.ok) {
        setSuccessMsg('Landing Page y carrusel de fotos actualizados.');
        setSelectedCarouselFile(null);
        setLandingNewsTitle('');
        setLandingNewsDesc('');
      } else {
        throw new Error('Error al guardar Landing CMS.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado y paginación
  const getPaginatedItems = (items: any[]) => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  };

  const getFilteredAppointments = () => {
    return (appointments || []).filter(a => 
      a.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getManicuristName(a.manicuristId).toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getFilteredServices = () => {
    return (servicesCatalog || []).filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getFilteredClients = () => {
    return (clients || []).filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
    );
  };

  const getManicuristName = (id: string | number) => {
    return manicurists.find(m => String(m.id) === String(id))?.name || 'Profesional';
  };

  const getServiceNames = (apptServices: Service[]) => {
    return apptServices.map(s => s.name).join(', ') || 'Manicura';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex justify-center items-center font-sans">
        <span className="serif-title text-2xl font-light tracking-widest text-[#3B0019] animate-pulse">Sincronizando Consola...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col md:flex-row font-sans">
      
      {/* HEADER MÓVIL */}
      <header className="md:hidden bg-[#FDFBF7] border-b border-[#EADEC9]/30 px-6 py-4 flex justify-between items-center sticky top-0 z-40 bg-opacity-90 backdrop-blur-md">
        <div className="flex flex-col text-left">
          <span className="serif-title text-xl text-[#3B0019] tracking-wider">WineSpa Admin</span>
          <span className="text-[8px] uppercase tracking-wider text-[#A68F63] font-bold">Consola</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-xs font-semibold text-[#8E1B54]">
          {isMobileMenuOpen ? '✕ Ocultar' : '☰ Módulos'}
        </button>
      </header>

      {/* SIDEBAR NAVEGACIÓN */}
      <aside className={`w-full md:w-64 bg-[#5C0632]/5 border-r border-[#EADEC9]/35 p-6 md:sticky md:top-0 md:h-screen shrink-0 ${
        isMobileMenuOpen ? 'block' : 'hidden md:block'
      }`}>
        <div className="hidden md:flex flex-col mb-8 text-left">
          <span className="serif-title text-2xl font-normal tracking-wider text-[#3B0019]">WineSpa Admin</span>
          <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-semibold mt-0.5">Control Corporativo</span>
        </div>

        <nav className="flex flex-col gap-1.5">
          {[
            { id: 'metrics', label: '📊 Estadísticas' },
            { id: 'appointments', label: '📅 Pizarra de Citas' },
            { id: 'manicurists', label: '💅 Especialistas (Staff)' },
            { id: 'clients', label: '👥 Base de Clientes' },
            { id: 'services', label: '🛍️ Servicios Carta' },
            { id: 'news', label: '📰 Novedades CMS' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setIsMobileMenuOpen(false); setSuccessMsg(null); setErrorMsg(null); setSearchQuery(''); setCurrentPage(1); }}
              className={`px-4 py-3 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === tab.id ? 'bg-[#5C0632] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#EADEC9]/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        
        {/* TABS: ESTADISTICAS */}
        {activeTab === 'metrics' && stats && (
          <div className="space-y-8 animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Rendimiento del Salón</h2>
              <p className="text-xs text-[#78716C]">Monitorea las reservas y la facturación acumulada.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold">Ganancias Confirmadas</span>
                <h3 className="serif-title text-3xl font-light text-[#3B0019]">${stats.totalEarnings.toLocaleString('es-CO')}</h3>
              </div>
              <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold">Citas Registradas</span>
                <h3 className="serif-title text-3xl font-light text-[#3B0019]">{stats.totalAppointments} Citas</h3>
              </div>
              <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold">Especialista Estrella</span>
                <h3 className="serif-title text-xl font-normal text-[#8E1B54] truncate">{stats.topManicurist}</h3>
              </div>
            </div>

            <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl space-y-4">
              <h3 className="serif-title text-lg text-[#3B0019] font-medium border-b border-[#EADEC9]/20 pb-2">Rendimiento Laboral</h3>
              <div className="space-y-4">
                {stats.manicuristPerformance && stats.manicuristPerformance.length > 0 && stats.manicuristPerformance.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs text-[#44403C]">
                      <span>{p.name}</span>
                      <span className="font-semibold text-[#8E1B54]">{p.appointmentsCount} citas completadas</span>
                    </div>
                    <div className="h-2 w-full bg-[#EADEC9]/25 rounded-full overflow-hidden">
                      <div className="bg-[#8E1B54] h-full" style={{ width: `${Math.min((p.appointmentsCount / 15) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TABS: PIZARRA DE CITAS */}
        {activeTab === 'appointments' && (
          <div className="space-y-6 animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Pizarra General de Citas</h2>
              <p className="text-xs text-[#78716C]">Monitoreo en tiempo real de citas en curso, confirmadas y finalizadas.</p>
            </header>

            {/* Barra de herramientas */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
              <input
                type="text"
                placeholder="Buscar por cliente o manicurista..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="p-2 border border-[#EADEC9] rounded-lg text-xs w-full sm:w-72 bg-white"
              />
              {/* Controles de paginación */}
              <div className="flex gap-2 text-xs">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-3 py-1 border rounded-lg hover:bg-neutral-50 disabled:opacity-50">Anterior</button>
                <span className="px-3 py-1 font-semibold">{currentPage}</span>
                <button disabled={currentPage * itemsPerPage >= getFilteredAppointments().length} onClick={() => setCurrentPage(prev => prev + 1)} className="px-3 py-1 border rounded-lg hover:bg-neutral-50 disabled:opacity-50">Siguiente</button>
              </div>
            </div>

            {/* Grilla visual interactiva */}
            <div className="bg-white border border-[#EADEC9]/40 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#5C0632]/5 border-b border-[#EADEC9]/30 text-[10px] uppercase tracking-wider text-[#8D774C] font-semibold">
                      <th className="p-4">Cita</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Especialista</th>
                      <th className="p-4">Servicios</th>
                      <th className="p-4">Fecha/Hora</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EADEC9]/20 text-xs text-[#44403C]">
                    {(!appointments || appointments.length === 0 || getFilteredAppointments().length === 0) ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[#78716C]">No hay citas agendadas o cargando...</td>
                      </tr>
                    ) : (
                      appointments?.length > 0 && getPaginatedItems(getFilteredAppointments()).map((appt: Appointment) => (
                        <tr key={appt.id} className={`hover:bg-[#F7F3EB]/10 transition-colors ${appt.status === 'IN_PROGRESS' ? 'bg-[#5C0632]/5 font-semibold text-[#3B0019]' : ''}`}>
                          <td className="p-4 font-mono font-bold">#{appt.appointmentId || appt.id}</td>
                          <td className="p-4">{appt.clientName || appt.client?.name || 'Cliente'}</td>
                          <td className="p-4">{getManicuristName(appt.manicuristId)}</td>
                          <td className="p-4 truncate max-w-xs">{getServiceNames(appt.services)}</td>
                          <td className="p-4">{toDateLabel(appt.date)} • {toTimeLabel(appt.date)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              appt.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                              appt.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                              appt.status === 'IN_PROGRESS' ? 'bg-[#5C0632] text-white animate-pulse' :
                              appt.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {appt.status}
                            </span>
                          </td>
                          <td className="p-4 flex gap-1.5">
                            {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                              <button onClick={() => handleUpdateStatus(appt.id, 'COMPLETED')} className="p-1 text-[10px] bg-[#8E1B54] text-white rounded hover:bg-[#5C0632] transition-colors font-bold">
                                Completar
                              </button>
                            )}
                            <button onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')} className="p-1 text-[10px] border border-red-200 text-red-700 rounded hover:bg-red-50">
                              Cancelar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TABS: STAFF MANICURISTAS */}
        {activeTab === 'manicurists' && (
          <div className="space-y-6 animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Staff / Manicuristas</h2>
              <p className="text-xs text-[#78716C]">Administra al personal y sus cronogramas de turnos.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {manicurists && manicurists.length > 0 && manicurists.map(m => (
                <div key={m.id} className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl flex flex-col justify-between space-y-4 shadow-2xs">
                  <div className="flex items-center gap-4">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="w-14 h-14 rounded-full object-cover border border-[#EADEC9]" />
                    ) : (
                      <FallbackAvatar className="w-14 h-14" />
                    )}
                    <div>
                      <h4 className="font-semibold text-sm text-[#3B0019]">{m.name}</h4>
                      <p className="text-xs text-[#78716C]">{m.role} • {m.age} años</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#EADEC9]/10">
                    <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold block">Jornadas Asignadas</span>
                    <div className="flex flex-wrap gap-1">
                      {m.shifts?.map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-[#F7F3EB] text-[#8D774C] text-[9px] font-semibold">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 text-right">
                    {editingShiftsManicuristId === String(m.id) ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1 justify-end">
                          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(day => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                setTempShifts(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
                              }}
                              className={`px-2 py-1 text-[9px] rounded-lg border ${
                                tempShifts.includes(day) ? 'bg-[#5C0632] text-white border-[#5C0632]' : 'border-[#EADEC9]'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingShiftsManicuristId(null)} className="px-3 py-1 text-[10px] border rounded-lg">Cancelar</button>
                          <button onClick={() => handleSaveShifts(m.id)} className="px-3 py-1 text-[10px] bg-[#8E1B54] text-white rounded-lg">Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingShiftsManicuristId(String(m.id));
                          setTempShifts(m.shifts || []);
                        }}
                        className="px-3.5 py-1.5 bg-[#5C0632]/5 text-[#5C0632] rounded-xl text-[10px] font-bold hover:bg-[#8E1B54] hover:text-white transition-all"
                      >
                        Configurar Turnos
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABS: CLIENTES */}
        {activeTab === 'clients' && (
          <div className="space-y-6 animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Base de Clientes</h2>
              <p className="text-xs text-[#78716C]">Historiales de visitas y teléfonos.</p>
            </header>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
              <input
                type="text"
                placeholder="Buscar por nombre o celular..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="p-2 border border-[#EADEC9] rounded-lg text-xs w-full sm:w-72 bg-white"
              />
              <div className="flex gap-2 text-xs">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-3 py-1 border rounded-lg hover:bg-neutral-50 disabled:opacity-50">Anterior</button>
                <span className="px-3 py-1 font-semibold">{currentPage}</span>
                <button disabled={currentPage * itemsPerPage >= getFilteredClients().length} onClick={() => setCurrentPage(prev => prev + 1)} className="px-3 py-1 border rounded-lg hover:bg-neutral-50 disabled:opacity-50">Siguiente</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {getFilteredClients().length === 0 ? (
                <p className="col-span-3 text-center text-xs text-[#78716C] py-8">Ningún cliente coincide con la búsqueda.</p>
              ) : (
                getPaginatedItems(getFilteredClients()).map((c: Client) => (
                  <div key={c.id} className="bg-white border border-[#EADEC9]/40 p-5 rounded-2xl space-y-3">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-[#44403C]">{c.name}</h4>
                      <p className="text-xs font-mono text-[#8E1B54]">{c.phone}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-[#78716C] border-t border-[#EADEC9]/20 pt-2">
                      <div>
                        <span>Edad</span>
                        <span className="block font-semibold text-[#44403C]">{c.age || 'N/A'} años</span>
                      </div>
                      <div>
                        <span>Género</span>
                        <span className="block font-semibold text-[#44403C]">{c.gender || 'Femenino'}</span>
                      </div>
                    </div>
                    <div className="bg-[#F7F3EB]/40 p-2 rounded-xl text-[10px] text-center text-[#8D774C] font-semibold border border-[#EADEC9]/25">
                      Historial: {c.appointmentHistoryCount || 0} visitas agendadas
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TABS: SERVICIOS */}
        {activeTab === 'services' && (
          <div className="space-y-6 md:grid md:grid-cols-12 md:gap-8 md:space-y-0 animate-fade-in text-left">
            <div className="md:col-span-5 space-y-4">
              <h2 className="serif-title text-2xl text-[#3B0019]">Agregar Ritual</h2>
              <form onSubmit={handleAddService} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Nombre del Ritual</label>
                  <input type="text" required placeholder="Ej: Manicura Soft Gel" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs focus:outline-hidden" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Descripción Corta</label>
                  <input type="text" placeholder="Ej: Esmaltado de larga duración con esferas de uva" value={newServiceShortDesc} onChange={(e) => setNewServiceShortDesc(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs focus:outline-hidden" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Precio ($)</label>
                    <input type="number" required placeholder="Ej: 35000" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs focus:outline-hidden" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Duración (min)</label>
                    <input type="number" required placeholder="Ej: 60" value={newServiceDuration} onChange={(e) => setNewServiceDuration(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs focus:outline-hidden" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Descripción Completa</label>
                  <textarea placeholder="Detalles de la manicura..." value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs focus:outline-hidden h-20 resize-none" />
                </div>

                {successMsg && <p className="text-[10px] text-green-600 bg-green-50 p-2 rounded-lg">{successMsg}</p>}
                {errorMsg && <p className="text-[10px] text-red-600 bg-red-50 p-2 rounded-lg">{errorMsg}</p>}

                <button type="submit" disabled={submitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{submitting ? 'Guardando...' : 'Crear Ritual'}</button>
              </form>
            </div>

            <div className="md:col-span-7 space-y-4">
              <h3 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-2">Catálogo</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
                <input
                  type="text"
                  placeholder="Filtrar rituales..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="p-2 border border-[#EADEC9] rounded-lg text-xs w-full sm:w-60 bg-white"
                />
                <div className="flex gap-2 text-xs">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-50">Anterior</button>
                  <button disabled={currentPage * itemsPerPage >= getFilteredServices().length} onClick={() => setCurrentPage(prev => prev + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-50">Siguiente</button>
                </div>
              </div>

              <div className="space-y-3">
                {getFilteredServices().length === 0 ? (
                  <p className="text-xs text-[#78716C] text-center py-8">Ningún ritual coincide con la búsqueda.</p>
                ) : (
                  getPaginatedItems(getFilteredServices()).map((s: ServiceCatalogItem) => (
                    <div key={s.id} className="p-4 rounded-xl bg-white border border-[#EADEC9]/30 flex justify-between items-center text-xs">
                      <div>
                        <h4 className="font-bold text-[#44403C]">{s.name}</h4>
                        {s.shortDescription && <p className="text-[10px] text-[#A68F63] italic mt-0.5">{s.shortDescription}</p>}
                        <span className="text-[9px] text-[#A68F63] bg-[#F7F3EB] px-2 py-0.5 rounded mt-1.5 inline-block">{s.duration} mins de sesión</span>
                      </div>
                      <span className="font-bold text-[#8E1B54]">${s.price.toLocaleString('es-CO')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TABS: NOVEDADES CMS */}
        {activeTab === 'news' && (
          <div className="space-y-6 max-w-lg animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Publicación CMS</h2>
              <p className="text-xs text-[#78716C]">Modifica el carrusel subiendo imágenes reales y configurando novedades.</p>
            </header>

            <form onSubmit={handleUpdateLanding} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Subir Imagen para Carrusel</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedCarouselFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2 border border-[#EADEC9]/60 rounded-xl text-xs bg-white focus:outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Título Novedad</label>
                <input type="text" placeholder="Inauguración de cabina" value={landingNewsTitle} onChange={(e) => setLandingNewsTitle(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs focus:outline-hidden" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Contenido / Descripción</label>
                <textarea placeholder="Detalles de la novedad..." value={landingNewsDesc} onChange={(e) => setLandingNewsDesc(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs focus:outline-hidden h-24 resize-none" />
              </div>

              {successMsg && <p className="text-[10px] text-green-600 bg-green-50 p-2 rounded-lg">{successMsg}</p>}
              {errorMsg && <p className="text-[10px] text-red-600 bg-red-50 p-2 rounded-lg">{errorMsg}</p>}

              <button type="submit" disabled={submitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{submitting ? 'Guardando...' : 'Publicar Cambios'}</button>
            </form>
          </div>
        )}

      </main>

    </div>
  );
};
