import React, { useState, useEffect } from 'react';
import { FallbackAvatar } from '../../../App';

const API = 'http://localhost:3000';

interface Stats {
  totalEarnings: number;
  totalAppointments: number;
  topManicurist: string;
  manicuristPerformance: { name: string; completedAppointments: number }[];
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
  durationInMinutes?: number;
  shortDescription?: string;
  includesDescription?: string;
  category?: string;
}

interface Manicurist {
  id: string | number;
  name: string;
  age?: number;
  avatarUrl?: string;
  avatarPath?: string;
  role?: string;
  sedeId?: string;
  schedules?: { shiftTemplate?: { name: string; startTime: string; endTime: string } }[];
}

interface Client {
  id: string | number;
  name: string;
  phone: string;
  age?: number;
  gender?: string;
  appointmentHistoryCount?: number;
}

interface Offer {
  id: string;
  title: string;
  description?: string;
  discountPercentage: number;
  code: string;
  isActive: boolean;
  createdAt: string;
}

const toDateLabel = (isoDate: string) => isoDate.slice(0, 10);
const toTimeLabel = (isoDate: string) => isoDate.slice(11, 16);

type Tab = 'metrics' | 'appointments' | 'manicurists' | 'clients' | 'services' | 'offers' | 'news';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [manicurists, setManicurists] = useState<Manicurist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sedes, setSedes] = useState<{ id: string; name: string }[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Service form
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [newServiceShortDesc, setNewServiceShortDesc] = useState('');
  const [newServiceIncludesDesc, setNewServiceIncludesDesc] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Offer form
  const [newOfferTitle, setNewOfferTitle] = useState('');
  const [newOfferDesc, setNewOfferDesc] = useState('');
  const [newOfferDiscount, setNewOfferDiscount] = useState('');
  const [newOfferCode, setNewOfferCode] = useState('');
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);

  // CMS
  const [selectedCarouselFile, setSelectedCarouselFile] = useState<File | null>(null);
  const [landingNewsTitle, setLandingNewsTitle] = useState('');
  const [landingNewsDesc, setLandingNewsDesc] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [manicuristsRes, servicesRes, clientsRes, sedesRes, offersRes] = await Promise.all([
        fetch(`${API}/api/admin/manicurists`),
        fetch(`${API}/api/services`),
        fetch(`${API}/api/admin/clients`).catch(() => null),
        fetch(`${API}/api/sedes`).catch(() => null),
        fetch(`${API}/api/admin/offers`).catch(() => null),
      ]);

      const manicuristsData = manicuristsRes.ok ? await manicuristsRes.json() : [];
      const servicesData = servicesRes.ok ? await servicesRes.json() : [];
      const clientsPayload = clientsRes && clientsRes.ok ? await clientsRes.json() : null;
      const sedesData = sedesRes && sedesRes.ok ? await sedesRes.json() : [];
      const offersData = offersRes && offersRes.ok ? await offersRes.json() : [];

      const clientsData: Client[] = clientsPayload?.data ?? (Array.isArray(clientsPayload) ? clientsPayload : []);

      setManicurists((manicuristsData || []).map((m: any) => ({
        ...m,
        age: m.age ?? null,
        avatarUrl: m.avatarPath ? `${API}${m.avatarPath}` : (m.avatarUrl || ''),
        role: m.role || 'Manicurista',
        sedeId: m.sedeId || null,
        schedules: m.schedules || [],
      })));

      setServicesCatalog(servicesData || []);
      setClients(clientsData);
      setSedes(sedesData);
      setOffers(offersData);

      // Cargar Citas
      let apptsData: Appointment[] = [];
      try {
        const apptsRes = await fetch(`${API}/api/admin/appointments`);
        if (apptsRes.ok) {
          const payload = await apptsRes.json();
          apptsData = payload?.data ?? (Array.isArray(payload) ? payload : []);
        }
      } catch {
        // fallback vacio
      }
      setAppointments((apptsData || []).map(a => ({ ...a, status: (a.status || 'PENDING').toUpperCase() as any })));

      // Métricas
      let statsData: Stats = { totalEarnings: 0, totalAppointments: 0, topManicurist: '-', manicuristPerformance: [] };
      try {
        const statsRes = await fetch(`${API}/api/admin/stats`);
        if (statsRes.ok) {
          const raw = await statsRes.json();
          const perf = (raw.manicuristPerformance || []).map((p: any) => ({
            name: p.name,
            completedAppointments: p.completedAppointments ?? p.appointmentsCount ?? 0,
          }));
          const totalAppts = raw.appointmentsByStatus?.reduce((sum: number, s: any) => sum + s.count, 0) ?? 0;
          statsData = {
            totalEarnings: raw.totalEarnings ?? 0,
            totalAppointments: totalAppts,
            topManicurist: perf.length > 0 ? perf[0].name : '-',
            manicuristPerformance: perf,
          };
        }
      } catch { /* fallback */ }
      setStats(statsData);

    } catch { /* arrays vacios */ }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async (id: string | number, newStatus: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    try {
      const response = await fetch(`${API}/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      }
    } catch { /* silencioso */ }
  };

  // --- Services ---
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName || !newServicePrice || !newServiceDuration) return;
    setSubmitting(true); setErrorMsg(null); setSuccessMsg(null);

    const body: any = {
      name: newServiceName,
      price: parseFloat(newServicePrice),
      durationInMinutes: parseInt(newServiceDuration),
      shortDescription: newServiceShortDesc || undefined,
      includesDescription: newServiceIncludesDesc || undefined,
      category: newServiceCategory || undefined,
    };

    try {
      const url = editingServiceId
        ? `${API}/api/admin/services/${editingServiceId}`
        : `${API}/api/admin/services`;
      const res = await fetch(url, {
        method: editingServiceId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSuccessMsg(editingServiceId ? 'Servicio actualizado.' : 'Servicio creado.');
        resetServiceForm();
        loadData();
      } else { throw new Error(); }
    } catch { setErrorMsg('Error al guardar el servicio.'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteService = async (id: string | number) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    try {
      const res = await fetch(`${API}/api/admin/services/${id}`, { method: 'DELETE' });
      if (res.ok) { setSuccessMsg('Servicio eliminado.'); loadData(); }
      else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || 'No se pudo eliminar.');
      }
    } catch { setErrorMsg('Error al eliminar.'); }
  };

  const startEditService = (s: ServiceCatalogItem) => {
    setEditingServiceId(String(s.id));
    setNewServiceName(s.name);
    setNewServicePrice(String(s.price));
    setNewServiceDuration(String(s.durationInMinutes || 60));
    setNewServiceShortDesc(s.shortDescription || '');
    setNewServiceIncludesDesc(s.includesDescription || '');
    setNewServiceCategory(s.category || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setNewServiceName(''); setNewServicePrice(''); setNewServiceDuration('');
    setNewServiceShortDesc(''); setNewServiceIncludesDesc(''); setNewServiceCategory('');
  };

  // --- Offers ---
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfferTitle || !newOfferDiscount || !newOfferCode) return;
    setSubmitting(true); setErrorMsg(null); setSuccessMsg(null);

    const body: any = {
      title: newOfferTitle,
      discountPercentage: parseInt(newOfferDiscount),
      code: newOfferCode,
      description: newOfferDesc || undefined,
    };

    try {
      const url = editingOfferId
        ? `${API}/api/admin/offers/${editingOfferId}`
        : `${API}/api/admin/offers`;
      const res = await fetch(url, {
        method: editingOfferId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSuccessMsg(editingOfferId ? 'Oferta actualizada.' : 'Oferta creada.');
        resetOfferForm();
        loadData();
      } else { throw new Error(); }
    } catch { setErrorMsg('Error al guardar la oferta.'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!confirm('¿Eliminar esta oferta?')) return;
    try {
      const res = await fetch(`${API}/api/admin/offers/${id}`, { method: 'DELETE' });
      if (res.ok) { setSuccessMsg('Oferta eliminada.'); loadData(); }
      else { setErrorMsg('No se pudo eliminar.'); }
    } catch { setErrorMsg('Error al eliminar.'); }
  };

  const handleToggleOffer = async (offer: Offer) => {
    try {
      const res = await fetch(`${API}/api/admin/offers/${offer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      if (res.ok) {
        setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, isActive: !offer.isActive } : o));
      }
    } catch { /* silencioso */ }
  };

  const startEditOffer = (o: Offer) => {
    setEditingOfferId(o.id);
    setNewOfferTitle(o.title);
    setNewOfferDesc(o.description || '');
    setNewOfferDiscount(String(o.discountPercentage));
    setNewOfferCode(o.code);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetOfferForm = () => {
    setEditingOfferId(null);
    setNewOfferTitle(''); setNewOfferDesc(''); setNewOfferDiscount(''); setNewOfferCode('');
  };

  // --- CMS ---
  const handleUpdateLanding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setErrorMsg(null); setSuccessMsg(null);
    if (!selectedCarouselFile) { setErrorMsg('Selecciona una imagen.'); setSubmitting(false); return; }
    try {
      const formData = new FormData();
      formData.append('image', selectedCarouselFile);
      const uploadRes = await fetch(`${API}/api/admin/landing/upload`, { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error();
      const uploadData = await uploadRes.json();
      const res = await fetch(`${API}/api/admin/landing-cms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ type: 'CAROUSEL', title: landingNewsTitle, description: landingNewsDesc, imageUrl: uploadData.imageUrl, isActive: true }]),
      });
      if (res.ok) {
        setSuccessMsg('Landing actualizado.');
        setSelectedCarouselFile(null); setLandingNewsTitle(''); setLandingNewsDesc('');
      } else { throw new Error(); }
    } catch { setErrorMsg('Error al publicar.'); }
    finally { setSubmitting(false); }
  };

  // --- Pagination & filtering ---
  const getPaginatedItems = (items: any[]) => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  };

  const getFilteredAppointments = () =>
    (appointments || []).filter(a =>
      (a.clientName || a.client?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      getManicuristName(a.manicuristId).toLowerCase().includes(searchQuery.toLowerCase())
    );

  const getFilteredServices = () =>
    (servicesCatalog || []).filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getFilteredClients = () =>
    (clients || []).filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery));

  const getFilteredOffers = () =>
    (offers || []).filter(o => o.title.toLowerCase().includes(searchQuery.toLowerCase()) || o.code.toLowerCase().includes(searchQuery.toLowerCase()));

  const getManicuristName = (id: string | number) => manicurists.find(m => String(m.id) === String(id))?.name || 'Profesional';
  const getSedeName = (sedeId?: string) => sedes.find(s => s.id === sedeId)?.name || '';
  const getServiceNames = (apptServices: Service[]) => apptServices.map(s => s.name).join(', ') || 'Manicura';

  const clearMessages = () => { setSuccessMsg(null); setErrorMsg(null); setSearchQuery(''); setCurrentPage(1); };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex justify-center items-center font-sans">
        <span className="serif-title text-2xl font-light tracking-widest text-[#3B0019] animate-pulse">Sincronizando Consola...</span>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'metrics', label: '📊 Estadísticas' },
    { id: 'appointments', label: '📅 Pizarra de Citas' },
    { id: 'manicurists', label: '💅 Especialistas (Staff)' },
    { id: 'clients', label: '👥 Base de Clientes' },
    { id: 'services', label: '🛍️ Servicios' },
    { id: 'offers', label: '🏷️ Ofertas / Descuentos' },
    { id: 'news', label: '📰 Novedades CMS' },
  ];

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

      {/* SIDEBAR */}
      <aside className={`w-full md:w-64 bg-[#5C0632]/5 border-r border-[#EADEC9]/35 p-6 md:sticky md:top-0 md:h-screen shrink-0 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
        <div className="hidden md:flex flex-col mb-8 text-left">
          <span className="serif-title text-2xl font-normal tracking-wider text-[#3B0019]">WineSpa Admin</span>
          <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-semibold mt-0.5">Control Corporativo</span>
        </div>
        <nav className="flex flex-col gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); clearMessages(); }}
              className={`px-4 py-3 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === tab.id ? 'bg-[#5C0632] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#EADEC9]/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* CONTENT */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-xl border border-green-200">{successMsg}</div>}
        {errorMsg && <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{errorMsg}</div>}

        {/* METRICS */}
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
            {stats.manicuristPerformance.length > 0 && (
              <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl space-y-4">
                <h3 className="serif-title text-lg text-[#3B0019] font-medium border-b border-[#EADEC9]/20 pb-2">Rendimiento Laboral</h3>
                <div className="space-y-4">
                  {stats.manicuristPerformance.map((p, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs text-[#44403C]">
                        <span>{p.name}</span>
                        <span className="font-semibold text-[#8E1B54]">{p.completedAppointments} citas completadas</span>
                      </div>
                      <div className="h-2 w-full bg-[#EADEC9]/25 rounded-full overflow-hidden">
                        <div className="bg-[#8E1B54] h-full" style={{ width: `${Math.min((p.completedAppointments / 15) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-6 animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Pizarra General de Citas</h2>
              <p className="text-xs text-[#78716C]">Monitoreo en tiempo real de citas en curso, confirmadas y finalizadas.</p>
            </header>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
              <input type="text" placeholder="Buscar por cliente o manicurista..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border border-[#EADEC9] rounded-lg text-xs w-full sm:w-72 bg-white" />
              <div className="flex gap-2 text-xs">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-3 py-1 border rounded-lg hover:bg-neutral-50 disabled:opacity-50">Anterior</button>
                <span className="px-3 py-1 font-semibold">{currentPage}</span>
                <button disabled={currentPage * itemsPerPage >= getFilteredAppointments().length} onClick={() => setCurrentPage(prev => prev + 1)} className="px-3 py-1 border rounded-lg hover:bg-neutral-50 disabled:opacity-50">Siguiente</button>
              </div>
            </div>
            <div className="bg-white border border-[#EADEC9]/40 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#5C0632]/5 border-b border-[#EADEC9]/30 text-[10px] uppercase tracking-wider text-[#8D774C] font-semibold">
                      <th className="p-4">Cita</th><th className="p-4">Cliente</th><th className="p-4">Especialista</th><th className="p-4">Servicios</th><th className="p-4">Fecha/Hora</th><th className="p-4">Estado</th><th className="p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EADEC9]/20 text-xs text-[#44403C]">
                    {(!appointments || appointments.length === 0 || getFilteredAppointments().length === 0) ? (
                      <tr><td colSpan={7} className="p-8 text-center text-[#78716C]">No hay citas agendadas o cargando...</td></tr>
                    ) : (
                      getPaginatedItems(getFilteredAppointments()).map((appt: Appointment) => (
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
                            }`}>{appt.status}</span>
                          </td>
                          <td className="p-4 flex gap-1.5">
                            {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && appt.status !== 'IN_PROGRESS' && (
                              <button onClick={() => handleUpdateStatus(appt.id, 'IN_PROGRESS')} className="p-1 text-[10px] bg-amber-100 text-amber-800 rounded hover:bg-amber-200 font-bold">Iniciar</button>
                            )}
                            {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                              <button onClick={() => handleUpdateStatus(appt.id, 'COMPLETED')} className="p-1 text-[10px] bg-[#8E1B54] text-white rounded hover:bg-[#5C0632] transition-colors font-bold">Completar</button>
                            )}
                            {appt.status !== 'CANCELLED' && (
                              <button onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')} className="p-1 text-[10px] border border-red-200 text-red-700 rounded hover:bg-red-50">Cancelar</button>
                            )}
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

        {/* STAFF */}
        {activeTab === 'manicurists' && (
          <div className="space-y-6 animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Especialistas</h2>
              <p className="text-xs text-[#78716C]">Personal del salón y sus jornadas asignadas.</p>
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
                      <p className="text-xs text-[#78716C]">{m.role} {m.age ? `• ${m.age} años` : ''}</p>
                      {m.sedeId && <p className="text-[9px] text-[#A68F63] mt-0.5">📍 {getSedeName(m.sedeId)}</p>}
                    </div>
                  </div>
                  {m.schedules && m.schedules.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#EADEC9]/10">
                      <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold block">Jornadas</span>
                      <div className="flex flex-wrap gap-1">
                        {m.schedules.map((sch, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-[#F7F3EB] text-[#8D774C] text-[9px] font-semibold">
                            {sch.shiftTemplate?.name || 'Turno'} ({sch.shiftTemplate?.startTime}-{sch.shiftTemplate?.endTime})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {activeTab === 'clients' && (
          <div className="space-y-6 animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Base de Clientes</h2>
              <p className="text-xs text-[#78716C]">Historiales de visitas y teléfonos.</p>
            </header>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
              <input type="text" placeholder="Buscar por nombre o celular..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border border-[#EADEC9] rounded-lg text-xs w-full sm:w-72 bg-white" />
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
                      <div><span>Edad</span><span className="block font-semibold text-[#44403C]">{c.age || 'N/A'} años</span></div>
                      <div><span>Género</span><span className="block font-semibold text-[#44403C]">{c.gender || 'Femenino'}</span></div>
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

        {/* SERVICES */}
        {activeTab === 'services' && (
          <div className="space-y-6 md:grid md:grid-cols-12 md:gap-8 md:space-y-0 animate-fade-in text-left">
            <div className="md:col-span-5 space-y-4">
              <h2 className="serif-title text-2xl text-[#3B0019]">{editingServiceId ? 'Editar Ritual' : 'Agregar Ritual'}</h2>
              <form onSubmit={handleAddService} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Nombre</label>
                  <input type="text" required placeholder="Ej: Manicura Soft Gel" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Descripción Corta</label>
                  <input type="text" placeholder="Ej: Esmaltado de larga duración" value={newServiceShortDesc} onChange={(e) => setNewServiceShortDesc(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Descripción Detallada (Incluye)</label>
                  <textarea placeholder="Qué incluye el servicio..." value={newServiceIncludesDesc} onChange={(e) => setNewServiceIncludesDesc(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs h-16 resize-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Categoría</label>
                  <select value={newServiceCategory} onChange={(e) => setNewServiceCategory(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs bg-white">
                    <option value="">Sin categoría</option>
                    <option value="MANICURE">Manicure</option>
                    <option value="PEDICURE">Pedicure</option>
                    <option value="NAIL_ART">Nail Art</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Precio ($)</label>
                    <input type="number" required placeholder="Ej: 35000" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Duración (min)</label>
                    <input type="number" required placeholder="Ej: 60" value={newServiceDuration} onChange={(e) => setNewServiceDuration(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="flex-1 py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{submitting ? 'Guardando...' : editingServiceId ? 'Actualizar' : 'Crear Ritual'}</button>
                  {editingServiceId && (
                    <button type="button" onClick={resetServiceForm} className="px-4 py-3 border border-[#EADEC9] text-xs rounded-xl">Cancelar</button>
                  )}
                </div>
              </form>
            </div>
            <div className="md:col-span-7 space-y-4">
              <h3 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-2">Catálogo</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
                <input type="text" placeholder="Filtrar rituales..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border border-[#EADEC9] rounded-lg text-xs w-full sm:w-60 bg-white" />
                <div className="flex gap-2 text-xs">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-50">Anterior</button>
                  <button disabled={currentPage * itemsPerPage >= getFilteredServices().length} onClick={() => setCurrentPage(prev => prev + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-50">Siguiente</button>
                </div>
              </div>
              <div className="space-y-3">
                {getFilteredServices().length === 0 ? (
                  <p className="text-xs text-[#78716C] text-center py-8">Ningún ritual coincide.</p>
                ) : (
                  getPaginatedItems(getFilteredServices()).map((s: ServiceCatalogItem) => (
                    <div key={s.id} className="p-4 rounded-xl bg-white border border-[#EADEC9]/30 flex justify-between items-center text-xs">
                      <div className="flex-1">
                        <h4 className="font-bold text-[#44403C]">{s.name}</h4>
                        {s.shortDescription && <p className="text-[10px] text-[#A68F63] italic mt-0.5">{s.shortDescription}</p>}
                        <div className="flex gap-2 mt-1.5">
                          <span className="text-[9px] text-[#A68F63] bg-[#F7F3EB] px-2 py-0.5 rounded">{s.durationInMinutes || '?'} mins</span>
                          {s.category && <span className="text-[9px] text-[#A68F63] bg-[#F7F3EB] px-2 py-0.5 rounded">{s.category}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#8E1B54]">${typeof s.price === 'number' ? s.price.toLocaleString('es-CO') : s.price}</span>
                        <button onClick={() => startEditService(s)} className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold">Editar</button>
                        <button onClick={() => handleDeleteService(s.id)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">Eliminar</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* OFFERS */}
        {activeTab === 'offers' && (
          <div className="space-y-6 md:grid md:grid-cols-12 md:gap-8 md:space-y-0 animate-fade-in text-left">
            <div className="md:col-span-5 space-y-4">
              <h2 className="serif-title text-2xl text-[#3B0019]">{editingOfferId ? 'Editar Oferta' : 'Nueva Oferta'}</h2>
              <form onSubmit={handleSaveOffer} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Título</label>
                  <input type="text" required placeholder="Ej: Descuento de Verano" value={newOfferTitle} onChange={(e) => setNewOfferTitle(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Descripción</label>
                  <input type="text" placeholder="Ej: 30% off en manicure" value={newOfferDesc} onChange={(e) => setNewOfferDesc(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Descuento (%)</label>
                    <input type="number" required min="1" max="100" placeholder="25" value={newOfferDiscount} onChange={(e) => setNewOfferDiscount(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Código</label>
                    <input type="text" required placeholder="VERANO25" value={newOfferCode} onChange={(e) => setNewOfferCode(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs uppercase" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="flex-1 py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{submitting ? 'Guardando...' : editingOfferId ? 'Actualizar' : 'Crear Oferta'}</button>
                  {editingOfferId && (
                    <button type="button" onClick={resetOfferForm} className="px-4 py-3 border border-[#EADEC9] text-xs rounded-xl">Cancelar</button>
                  )}
                </div>
              </form>
            </div>
            <div className="md:col-span-7 space-y-4">
              <h3 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-2">Ofertas ({offers.length})</h3>
              <input type="text" placeholder="Filtrar por título o código..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border border-[#EADEC9] rounded-lg text-xs w-full bg-white" />
              <div className="space-y-3">
                {getFilteredOffers().length === 0 ? (
                  <p className="text-xs text-[#78716C] text-center py-8">Sin ofertas aún.</p>
                ) : (
                  getPaginatedItems(getFilteredOffers()).map((o: Offer) => (
                    <div key={o.id} className={`p-4 rounded-xl border text-xs flex justify-between items-center ${o.isActive ? 'bg-white border-[#EADEC9]/30' : 'bg-neutral-50 border-neutral-200 opacity-70'}`}>
                      <div>
                        <h4 className="font-bold text-[#44403C]">{o.title} <span className="text-[9px] text-[#A68F63]">({o.code})</span></h4>
                        <p className="text-[10px] text-[#78716C]">{o.discountPercentage}% desc. {o.description ? `— ${o.description}` : ''}</p>
                        <span className={`text-[9px] font-semibold ${o.isActive ? 'text-green-600' : 'text-red-400'}`}>{o.isActive ? 'Activa' : 'Inactiva'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleOffer(o)} className={`text-[10px] font-semibold px-2 py-1 rounded ${o.isActive ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{o.isActive ? 'Desactivar' : 'Activar'}</button>
                        <button onClick={() => startEditOffer(o)} className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold">Editar</button>
                        <button onClick={() => handleDeleteOffer(o.id)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">Eliminar</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* CMS */}
        {activeTab === 'news' && (
          <div className="space-y-6 max-w-lg animate-fade-in text-left">
            <header className="space-y-1">
              <h2 className="serif-title text-3xl text-[#3B0019]">Publicación CMS</h2>
              <p className="text-xs text-[#78716C]">Modifica el carrusel subiendo imágenes reales y configurando novedades.</p>
            </header>
            <form onSubmit={handleUpdateLanding} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Subir Imagen para Carrusel</label>
                <input type="file" accept="image/*" onChange={(e) => setSelectedCarouselFile(e.target.files ? e.target.files[0] : null)} className="w-full p-2 border border-[#EADEC9]/60 rounded-xl text-xs bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Título Novedad</label>
                <input type="text" placeholder="Inauguración de cabina" value={landingNewsTitle} onChange={(e) => setLandingNewsTitle(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Contenido / Descripción</label>
                <textarea placeholder="Detalles de la novedad..." value={landingNewsDesc} onChange={(e) => setLandingNewsDesc(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EADEC9]/60 text-xs h-24 resize-none" />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{submitting ? 'Guardando...' : 'Publicar Cambios'}</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
