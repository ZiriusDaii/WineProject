import React, { useState, useEffect } from 'react';
import { FallbackAvatar } from '../../../App';

const API = 'http://localhost:3000';

interface Stats {
  totalEarnings: number;
  totalAppointments: number;
  topManicurist: string;
  manicuristPerformance: { name: string; completedAppointments: number }[];
  appointmentsByStatus?: { status: string; count: number }[];
}

interface ServiceItem {
  id: string | number;
  name: string;
  price: string | number;
  durationInMinutes?: string | number;
}

interface Appointment {
  id: string | number;
  appointmentId?: string | number;
  clientName?: string;
  client?: { name?: string; phone?: string };
  clientId?: string | number;
  manicuristId: string | number;
  manicurist?: { name?: string };
  services: ServiceItem[];
  date: string;
  totalDuration?: number;
  totalPrice?: string | number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
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
  phone: string;
  username: string;
  age?: number;
  gender?: string;
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
  createdAt?: string;
}

interface Offer {
  id: string;
  title: string;
  description?: string;
  discountPercentage: number;
  code: string;
  isActive: boolean;
}

interface Sede {
  id: string;
  name: string;
}

const toDateLabel = (isoDate: string) => isoDate ? isoDate.slice(0, 10) : '';
const toTimeLabel = (isoDate: string) => isoDate ? isoDate.slice(11, 16) : '';

type Tab = 'metrics' | 'appointments' | 'manicurists' | 'clients' | 'services' | 'offers' | 'news';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Curso', COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};

const CATEGORIES = ['', 'MANICURE', 'PEDICURE', 'NAIL_ART'];

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [manicurists, setManicurists] = useState<Manicurist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Service form
  const [svcId, setSvcId] = useState<string | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDuration, setSvcDuration] = useState('');
  const [svcShort, setSvcShort] = useState('');
  const [svcIncludes, setSvcIncludes] = useState('');
  const [svcCat, setSvcCat] = useState('');

  // Offer form
  const [offId, setOffId] = useState<string | null>(null);
  const [offTitle, setOffTitle] = useState('');
  const [offDesc, setOffDesc] = useState('');
  const [offDiscount, setOffDiscount] = useState('');
  const [offCode, setOffCode] = useState('');

  // Manicurist form
  const [manId, setManId] = useState<string | null>(null);
  const [manPhone, setManPhone] = useState('');
  const [manUser, setManUser] = useState('');
  const [manName, setManName] = useState('');
  const [manPass, setManPass] = useState('');
  const [manAge, setManAge] = useState('');
  const [manGender, setManGender] = useState('Femenino');
  const [manSede, setManSede] = useState('');
  const [manAvatarFile, setManAvatarFile] = useState<File | null>(null);

  // Client detail modal
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAppts, setClientAppts] = useState<Appointment[]>([]);

  // CMS
  const [cmsFile, setCmsFile] = useState<File | null>(null);
  const [cmsTitle, setCmsTitle] = useState('');
  const [cmsDesc, setCmsDesc] = useState('');
  const [cmsItems, setCmsItems] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'news') fetchCMS(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mRes, sRes, cRes, sedesRes, oRes] = await Promise.all([
        fetch(`${API}/api/admin/manicurists`),
        fetch(`${API}/api/services`),
        fetch(`${API}/api/admin/clients`).catch(() => null),
        fetch(`${API}/api/sedes`).catch(() => null),
        fetch(`${API}/api/admin/offers`).catch(() => null),
      ]);
      const mData = mRes.ok ? await mRes.json() : [];
      const sData = sRes.ok ? await sRes.json() : [];
      const cPayload = cRes?.ok ? await cRes.json() : null;
      const sedesData = sedesRes?.ok ? await sedesRes.json() : [];
      const oData = oRes?.ok ? await oRes.json() : [];

      setManicurists((mData || []).map((m: any) => ({ ...m, avatarUrl: m.avatarPath ? `${API}${m.avatarPath}` : (m.avatarUrl || '') })));
      setServicesCatalog(sData || []);
      setClients(cPayload?.data ?? (Array.isArray(cPayload) ? cPayload : []));
      setSedes(sedesData);
      setOffers(oData);

      let appts: Appointment[] = [];
      try {
        const aRes = await fetch(`${API}/api/admin/appointments`);
        if (aRes.ok) { const p = await aRes.json(); appts = p?.data ?? (Array.isArray(p) ? p : []); }
      } catch { /* */ }
      setAppointments(appts.map((a: any) => ({ ...a, status: a.status || 'PENDING' })));

      let sData2: Stats = { totalEarnings: 0, totalAppointments: 0, topManicurist: '-', manicuristPerformance: [], appointmentsByStatus: [] };
      try {
        const stRes = await fetch(`${API}/api/admin/stats`);
        if (stRes.ok) {
          const r = await stRes.json();
          sData2 = {
            totalEarnings: r.totalEarnings ?? 0,
            totalAppointments: r.appointmentsByStatus?.reduce((sum: number, s: any) => sum + s.count, 0) ?? 0,
            topManicurist: r.manicuristPerformance?.[0]?.name || '-',
            manicuristPerformance: (r.manicuristPerformance || []).map((p: any) => ({
              name: p.name, completedAppointments: p.completedAppointments ?? 0,
            })),
            appointmentsByStatus: r.appointmentsByStatus || [],
          };
        }
      } catch { /* */ }
      setStats(sData2);
    } catch { /* */ }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async (id: string | number, status: string) => {
    try {
      const res = await fetch(`${API}/api/admin/appointments/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: status as any } : a));
        setSuccessMsg(`Cita ${STATUS_LABELS[status]?.toLowerCase() || status}.`);
        setTimeout(() => setSuccessMsg(null), 2000);
      }
    } catch { /* */ }
  };

  // --- Services ---
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!svcName || !svcPrice || !svcDuration) return;
    setSubmitting(true);
    const body: any = { name: svcName, price: parseFloat(svcPrice), durationInMinutes: parseInt(svcDuration), shortDescription: svcShort || undefined, includesDescription: svcIncludes || undefined, category: svcCat || undefined };
    try {
      const url = svcId ? `${API}/api/admin/services/${svcId}` : `${API}/api/admin/services`;
      const res = await fetch(url, { method: svcId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { setSuccessMsg(svcId ? 'Actualizado.' : 'Creado.'); resetSvc(); loadData(); } else throw new Error();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const handleDeleteService = async (id: string | number) => {
    if (!confirm('Eliminar?')) return;
    try { const r = await fetch(`${API}/api/admin/services/${id}`, { method: 'DELETE' }); if (r.ok) { setSuccessMsg('Eliminado.'); loadData(); } else { const e = await r.json().catch(() => ({})); setErrorMsg(e.error || 'No se pudo.'); } } catch { setErrorMsg('Error.'); }
  };
  const editSvc = (s: ServiceCatalogItem) => { setSvcId(String(s.id)); setSvcName(s.name); setSvcPrice(String(s.price)); setSvcDuration(String(s.durationInMinutes || 60)); setSvcShort(s.shortDescription || ''); setSvcIncludes(s.includesDescription || ''); setSvcCat(s.category || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resetSvc = () => { setSvcId(null); setSvcName(''); setSvcPrice(''); setSvcDuration(''); setSvcShort(''); setSvcIncludes(''); setSvcCat(''); };

  // --- Offers ---
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offTitle || !offDiscount || !offCode) return;
    setSubmitting(true);
    const body: any = { title: offTitle, discountPercentage: parseInt(offDiscount), code: offCode, description: offDesc || undefined };
    try {
      const url = offId ? `${API}/api/admin/offers/${offId}` : `${API}/api/admin/offers`;
      const res = await fetch(url, { method: offId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { setSuccessMsg(offId ? 'Actualizada.' : 'Creada.'); resetOff(); loadData(); } else throw new Error();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const handleDeleteOffer = async (id: string) => { if (!confirm('Eliminar?')) return; try { const r = await fetch(`${API}/api/admin/offers/${id}`, { method: 'DELETE' }); if (r.ok) { setSuccessMsg('Eliminada.'); loadData(); } else setErrorMsg('No se pudo.'); } catch { setErrorMsg('Error.'); } };
  const handleToggleOffer = async (o: Offer) => { try { const r = await fetch(`${API}/api/admin/offers/${o.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !o.isActive }) }); if (r.ok) setOffers(prev => prev.map(x => x.id === o.id ? { ...x, isActive: !o.isActive } : x)); } catch { /* */ } };
  const editOff = (o: Offer) => { setOffId(o.id); setOffTitle(o.title); setOffDesc(o.description || ''); setOffDiscount(String(o.discountPercentage)); setOffCode(o.code); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resetOff = () => { setOffId(null); setOffTitle(''); setOffDesc(''); setOffDiscount(''); setOffCode(''); };

  // --- Manicurists ---
  const handleSaveManicurist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manPhone || !manUser || !manName) return;
    setSubmitting(true);
    const body: any = { phone: manPhone, username: manUser, name: manName, age: manAge ? parseInt(manAge) : null, gender: manGender || null, sedeId: manSede || null };
    if (manId) { if (manPass) body.password = manPass; } else { if (!manPass) { setErrorMsg('Contraseña requerida para nueva manicurista.'); setSubmitting(false); return; } body.password = manPass; }
    try {
      const url = manId ? `${API}/api/admin/manicurists/${manId}` : `${API}/api/admin/manicurists`;
      const res = await fetch(url, { method: manId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      const targetId = saved.id || manId;
      if (manAvatarFile && targetId) {
        const fd = new FormData();
        fd.append('image', manAvatarFile);
        fd.append('manicuristId', String(targetId));
        await fetch(`${API}/api/admin/manicurists/upload-avatar`, { method: 'POST', body: fd });
      }
      setSuccessMsg(manId ? 'Actualizada.' : 'Creada.');
      resetMan(); loadData();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const editMan = (m: Manicurist) => { setManId(String(m.id)); setManPhone(m.phone); setManUser(m.username); setManName(m.name); setManPass(''); setManAge(m.age ? String(m.age) : ''); setManGender(m.gender || 'Femenino'); setManSede(m.sedeId || ''); setManAvatarFile(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resetMan = () => { setManId(null); setManPhone(''); setManUser(''); setManName(''); setManPass(''); setManAge(''); setManGender('Femenino'); setManSede(''); setManAvatarFile(null); };

  // --- Client detail ---
  const viewClient = async (c: Client) => {
    setSelectedClient(c);
    try {
      const res = await fetch(`${API}/api/appointments?clientId=${c.id}`);
      if (res.ok) setClientAppts(await res.json());
    } catch { setClientAppts([]); }
  };

  // --- CMS ---
  const fetchCMS = async () => {
    try {
      const res = await fetch(`${API}/api/landing/content`);
      if (res.ok) setCmsItems(await res.json());
    } catch { /* */ }
  };
  const handleDeleteCMS = async (id: string) => {
    if (!confirm('Eliminar este anuncio?')) return;
    try {
      const r = await fetch(`${API}/api/admin/landing-cms/${id}`, { method: 'DELETE' });
      if (r.ok) { setSuccessMsg('Eliminado.'); fetchCMS(); } else setErrorMsg('No se pudo eliminar.');
    } catch { setErrorMsg('Error.'); }
  };
  const handleSaveCMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmsFile) { setErrorMsg('Selecciona una imagen.'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData(); fd.append('image', cmsFile);
      const uRes = await fetch(`${API}/api/admin/landing/upload`, { method: 'POST', body: fd });
      if (!uRes.ok) throw new Error();
      const { imageUrl } = await uRes.json();
      const r = await fetch(`${API}/api/admin/landing-cms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ type: 'CAROUSEL', title: cmsTitle, description: cmsDesc, imageUrl, isActive: true }]) });
      if (r.ok) { setSuccessMsg('Publicado.'); setCmsFile(null); setCmsTitle(''); setCmsDesc(''); fetchCMS(); } else throw new Error();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };

  // --- Helpers ---
  const paginate = (items: any[]) => { const s = (currentPage - 1) * itemsPerPage; return items.slice(s, s + itemsPerPage); };
  const filterApps = () => appointments.filter(a => `${a.clientName || a.client?.name || ''} ${getManName(a.manicuristId)}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const filterSvcs = () => servicesCatalog.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filterClients = () => clients.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const filterOffers = () => offers.filter(o => `${o.title} ${o.code}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const getManName = (id: string | number) => manicurists.find(m => String(m.id) === String(id))?.name || '—';
  const getSedeName = (id?: string) => sedes.find(s => s.id === id)?.name || '';
  const svcNames = (ss: ServiceItem[]) => ss.map(s => s.name).join(', ') || '—';
  const clear = () => { setSuccessMsg(null); setErrorMsg(null); setSearchQuery(''); setCurrentPage(1); };
  const priceFmt = (p: any) => typeof p === 'number' ? `$${p.toLocaleString('es-CO')}` : `$${p}`;

  if (loading) return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center"><span className="serif-title text-2xl text-[#3B0019] animate-pulse">Cargando...</span></div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'metrics', label: 'Estadisticas' },
    { id: 'appointments', label: 'Pizarra de Citas' },
    { id: 'manicurists', label: 'Especialistas' },
    { id: 'clients', label: 'Base de Clientes' },
    { id: 'services', label: 'Servicios' },
    { id: 'offers', label: 'Descuentos' },
    { id: 'news', label: 'CMS / Landing' },
  ];

  const pagination = (total: number) => (
    <div className="flex gap-2 text-xs">
      <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-50">Anterior</button>
      <span className="px-3 py-1 font-semibold">{currentPage}</span>
      <button disabled={currentPage * itemsPerPage >= total} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-50">Siguiente</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col md:flex-row font-sans">
      <header className="md:hidden bg-[#FDFBF7] border-b border-[#EADEC9]/30 px-6 py-4 flex justify-between items-center sticky top-0 z-40 bg-opacity-90 backdrop-blur-md">
        <span className="serif-title text-xl text-[#3B0019]">WineSpa Admin</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-xs font-semibold text-[#8E1B54]">{isMobileMenuOpen ? 'Cerrar' : 'Menu'}</button>
      </header>

      <aside className={`w-full md:w-56 bg-[#5C0632]/5 border-r border-[#EADEC9]/35 p-5 md:sticky md:top-0 md:h-screen shrink-0 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
        <div className="hidden md:block mb-6 text-left">
          <span className="serif-title text-xl text-[#3B0019]">WineSpa</span>
          <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-semibold block">Panel Admin</span>
        </div>
        <nav className="flex flex-col gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); clear(); }} className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${activeTab === t.id ? 'bg-[#5C0632] text-white' : 'text-[#78716C] hover:bg-[#EADEC9]/30'}`}>{t.label}</button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        {successMsg && <div className="mb-3 p-2.5 bg-green-50 text-green-700 text-xs rounded-xl border border-green-200">{successMsg}</div>}
        {errorMsg && <div className="mb-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{errorMsg}</div>}

        {/* METRICS */}
        {activeTab === 'metrics' && stats && (
          <div className="space-y-8 animate-fade-in text-left">
            <h2 className="serif-title text-3xl text-[#3B0019]">Estadisticas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-[#EADEC9]/40 p-5 rounded-2xl"><span className="text-[10px] uppercase text-[#A68F63] font-bold">Ganancias</span><h3 className="serif-title text-2xl text-[#3B0019]">${stats.totalEarnings.toLocaleString('es-CO')}</h3></div>
              <div className="bg-white border border-[#EADEC9]/40 p-5 rounded-2xl"><span className="text-[10px] uppercase text-[#A68F63] font-bold">Citas Totales</span><h3 className="serif-title text-2xl text-[#3B0019]">{stats.totalAppointments}</h3></div>
              <div className="bg-white border border-[#EADEC9]/40 p-5 rounded-2xl"><span className="text-[10px] uppercase text-[#A68F63] font-bold">Top Especialista</span><h3 className="serif-title text-lg text-[#8E1B54] truncate">{stats.topManicurist}</h3></div>
            </div>
            {stats.appointmentsByStatus && stats.appointmentsByStatus.length > 0 && (
              <div className="bg-white border border-[#EADEC9]/40 p-5 rounded-2xl space-y-3">
                <h3 className="serif-title text-lg text-[#3B0019] border-b pb-2">Por Estado</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {stats.appointmentsByStatus.map(s => (
                    <div key={s.status} className="text-center p-3 bg-[#F7F3EB]/30 rounded-xl">
                      <span className="block text-2xl font-bold text-[#8E1B54]">{s.count}</span>
                      <span className="text-[#78716C]">{STATUS_LABELS[s.status] || s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.manicuristPerformance.length > 0 && (
              <div className="bg-white border border-[#EADEC9]/40 p-5 rounded-2xl space-y-3">
                <h3 className="serif-title text-lg text-[#3B0019] border-b pb-2">Rendimiento por Especialista</h3>
                {stats.manicuristPerformance.map((p, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs"><span>{p.name}</span><span className="font-semibold text-[#8E1B54]">{p.completedAppointments} completadas</span></div>
                    <div className="h-2 bg-[#EADEC9]/25 rounded-full"><div className="bg-[#8E1B54] h-full rounded-full" style={{ width: `${Math.min((p.completedAppointments / Math.max(...stats.manicuristPerformance.map(x => x.completedAppointments), 1)) * 100, 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-6 animate-fade-in text-left">
            <h2 className="serif-title text-3xl text-[#3B0019]">Pizarra de Citas</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
              <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs w-full sm:w-64" />
              {pagination(filterApps().length)}
            </div>
            <div className="bg-white border border-[#EADEC9]/40 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="bg-[#5C0632]/5 text-[10px] uppercase text-[#8D774C] font-semibold"><th className="p-3">#</th><th className="p-3">Cliente</th><th className="p-3">Especialista</th><th className="p-3">Servicios</th><th className="p-3">Fecha</th><th className="p-3">Total</th><th className="p-3">Estado</th><th className="p-3">Accion</th></tr></thead>
                <tbody className="divide-y divide-[#EADEC9]/20">
                  {filterApps().length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-[#78716C]">Sin citas.</td></tr> :
                    paginate(filterApps()).map(a => (
                      <tr key={a.id} className={a.status === 'IN_PROGRESS' ? 'bg-[#5C0632]/5' : ''}>
                        <td className="p-3 font-mono font-bold">#{a.appointmentId || a.id}</td>
                        <td className="p-3">{a.clientName || a.client?.name || '—'}</td>
                        <td className="p-3">{a.manicurist?.name || getManName(a.manicuristId)}</td>
                        <td className="p-3 max-w-[150px] truncate">{svcNames(a.services)}</td>
                        <td className="p-3 whitespace-nowrap">{toDateLabel(a.date)} {toTimeLabel(a.date)}</td>
                        <td className="p-3 font-semibold">{priceFmt(a.totalPrice)}</td>
                        <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${a.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' : a.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' : a.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>{STATUS_LABELS[a.status || 'PENDING']}</span></td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {a.status === 'PENDING' && <button onClick={() => handleUpdateStatus(a.id, 'IN_PROGRESS')} className="px-2 py-1 text-[9px] bg-amber-100 text-amber-800 rounded font-bold">Iniciar</button>}
                            {a.status === 'IN_PROGRESS' && <button onClick={() => handleUpdateStatus(a.id, 'COMPLETED')} className="px-2 py-1 text-[9px] bg-[#8E1B54] text-white rounded font-bold">Completar</button>}
                            {a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && <button onClick={() => handleUpdateStatus(a.id, 'CANCELLED')} className="px-2 py-1 text-[9px] border border-red-200 text-red-700 rounded">Cancelar</button>}
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MANICURISTS */}
        {activeTab === 'manicurists' && (
          <div className="space-y-6 md:grid md:grid-cols-12 md:gap-8 md:space-y-0 animate-fade-in text-left">
            <div className="md:col-span-5 space-y-4">
              <h2 className="serif-title text-2xl text-[#3B0019]">{manId ? 'Editar Especialista' : 'Nueva Especialista'}</h2>
              <form onSubmit={handleSaveManicurist} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3 shadow-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Telefono</label><input type="tel" required maxLength={10} value={manPhone} onChange={e => setManPhone(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Usuario</label><input type="text" required maxLength={30} value={manUser} onChange={e => setManUser(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                </div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Nombre Completo</label><input type="text" required maxLength={60} value={manName} onChange={e => setManName(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Contrasena {manId && '(dejar vacio = no cambiar)'}</label><input type="password" maxLength={64} required={!manId} value={manPass} onChange={e => setManPass(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Sede</label><select value={manSede} onChange={e => setManSede(e.target.value)} className="w-full p-2 border rounded-lg text-xs bg-white"><option value="">Sin sede</option>{sedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Edad</label><input type="number" min={0} max={120} value={manAge} onChange={e => setManAge(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Genero</label><select value={manGender} onChange={e => setManGender(e.target.value)} className="w-full p-2 border rounded-lg text-xs bg-white"><option value="Femenino">Femenino</option><option value="Masculino">Masculino</option></select></div>
                </div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Foto {manId && '(opcional)'}</label><input type="file" accept="image/*" onChange={e => setManAvatarFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{manId ? 'Actualizar' : 'Crear'}</button>
                  {manId && <button type="button" onClick={resetMan} className="px-4 py-2.5 border rounded-xl text-xs">Cancelar</button>}
                </div>
              </form>
            </div>
            <div className="md:col-span-7 space-y-4">
              <h3 className="serif-title text-xl text-[#3B0019] border-b pb-2">Equipo ({manicurists.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {manicurists.map(m => (
                  <div key={m.id} className="bg-white border border-[#EADEC9]/40 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center gap-3">
                      {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover border" /> : <FallbackAvatar className="w-10 h-10" />}
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm text-[#3B0019]">{m.name}</h4>
                        <p className="text-[10px] text-[#78716C]">@{m.username} {m.age ? `· ${m.age} anos` : ''}</p>
                        {m.sedeId && <p className="text-[9px] text-[#A68F63]">📍 {getSedeName(m.sedeId)}</p>}
                      </div>
                    </div>
                    {m.schedules && m.schedules.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-[#EADEC9]/10">
                        {m.schedules.map((sch, i) => <span key={i} className="px-2 py-0.5 rounded bg-[#F7F3EB] text-[#8D774C] text-[9px] font-semibold">{sch.shiftTemplate?.name} ({sch.shiftTemplate?.startTime}-{sch.shiftTemplate?.endTime})</span>)}
                      </div>
                    )}
                    <button onClick={() => editMan(m)} className="w-full py-1.5 border border-[#EADEC9] rounded-lg text-[10px] text-[#A68F63] font-semibold hover:bg-[#5C0632]/5">Editar</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {activeTab === 'clients' && (
          <div className="space-y-6 animate-fade-in text-left">
            <h2 className="serif-title text-3xl text-[#3B0019]">Base de Clientes</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
              <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs w-full sm:w-64" />
              {pagination(filterClients().length)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterClients().length === 0 ? <p className="col-span-full text-center text-xs text-[#78716C] py-8">Sin clientes.</p> :
                paginate(filterClients()).map(c => (
                  <div key={c.id} className="bg-white border border-[#EADEC9]/40 p-4 rounded-2xl space-y-2">
                    <h4 className="font-semibold text-sm text-[#44403C]">{c.name}</h4>
                    <p className="text-xs font-mono text-[#8E1B54]">{c.phone}</p>
                    <div className="flex justify-between text-[10px] text-[#78716C] pt-2 border-t border-[#EADEC9]/20">
                      <span>{c.age ? `${c.age} anos` : '—'} · {c.gender || '—'}</span>
                    </div>
                    <button onClick={() => viewClient(c)} className="w-full py-1.5 bg-[#5C0632]/5 text-[#5C0632] rounded-lg text-[10px] font-bold hover:bg-[#8E1B54] hover:text-white">Ver Perfil</button>
                  </div>
                ))
              }
            </div>
            {/* Client detail modal */}
            {selectedClient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedClient(null)}>
                <div className="bg-white w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setSelectedClient(null)} className="absolute top-3 right-3 text-sm text-[#78716C]">✕</button>
                  <h3 className="serif-title text-xl text-[#3B0019]">{selectedClient.name}</h3>
                  <p className="text-xs font-mono text-[#8E1B54]">{selectedClient.phone}</p>
                  <p className="text-xs text-[#78716C]">{selectedClient.age || '—'} anos · {selectedClient.gender || '—'}</p>
                  <div className="border-t pt-3 space-y-2">
                    <h4 className="text-xs font-bold text-[#3B0019] uppercase">Historial de Citas ({clientAppts.length})</h4>
                    {clientAppts.length === 0 ? <p className="text-xs text-[#78716C]">Sin citas registradas.</p> :
                      clientAppts.map(a => (
                        <div key={a.id} className="flex justify-between items-center text-xs p-2 bg-[#F7F3EB]/20 rounded-lg">
                          <div>
                            <span className="font-semibold">{toDateLabel(a.date)} {toTimeLabel(a.date)}</span>
                            <span className="text-[#78716C] ml-2">{svcNames(a.services)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{priceFmt(a.totalPrice)}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${a.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' : a.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{STATUS_LABELS[a.status || 'PENDING']}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SERVICES */}
        {activeTab === 'services' && (
          <div className="space-y-6 md:grid md:grid-cols-12 md:gap-8 md:space-y-0 animate-fade-in text-left">
            <div className="md:col-span-5 space-y-4">
              <h2 className="serif-title text-2xl text-[#3B0019]">{svcId ? 'Editar Servicio' : 'Nuevo Servicio'}</h2>
              <form onSubmit={handleSaveService} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3">
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Nombre</label><input type="text" required value={svcName} onChange={e => setSvcName(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Descripcion Corta</label><input type="text" value={svcShort} onChange={e => setSvcShort(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Incluye</label><textarea value={svcIncludes} onChange={e => setSvcIncludes(e.target.value)} className="w-full p-2 border rounded-lg text-xs h-16" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Categoria</label><select value={svcCat} onChange={e => setSvcCat(e.target.value)} className="w-full p-2 border rounded-lg text-xs bg-white">{CATEGORIES.map(c => <option key={c} value={c}>{c || 'Sin categoria'}</option>)}</select></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Duracion (min)</label><input type="number" required value={svcDuration} onChange={e => setSvcDuration(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                </div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Precio ($)</label><input type="number" required value={svcPrice} onChange={e => setSvcPrice(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{svcId ? 'Actualizar' : 'Crear'}</button>
                  {svcId && <button type="button" onClick={resetSvc} className="px-4 py-2.5 border rounded-xl text-xs">Cancelar</button>}
                </div>
              </form>
            </div>
            <div className="md:col-span-7 space-y-4">
              <h3 className="serif-title text-xl text-[#3B0019] border-b pb-2">Catalogo ({servicesCatalog.length})</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border p-4 rounded-xl">
                <input type="text" placeholder="Filtrar..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs w-full sm:w-48" />
                {pagination(filterSvcs().length)}
              </div>
              <div className="space-y-2">
                {filterSvcs().length === 0 ? <p className="text-xs text-center py-8 text-[#78716C]">Sin servicios.</p> :
                  paginate(filterSvcs()).map(s => (
                    <div key={s.id} className="p-3 rounded-xl bg-white border border-[#EADEC9]/30 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-[#44403C]">{s.name}</span>
                        {s.category && <span className="ml-2 text-[9px] bg-[#F7F3EB] px-1.5 py-0.5 rounded text-[#A68F63]">{s.category}</span>}
                        <span className="ml-2 text-[#78716C]">{s.durationInMinutes || '?'} min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#8E1B54]">{priceFmt(s.price)}</span>
                        <button onClick={() => editSvc(s)} className="text-[10px] text-[#A68F63] font-semibold">Editar</button>
                        <button onClick={() => handleDeleteService(s.id)} className="text-[10px] text-red-400 font-semibold">Eliminar</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* OFFERS */}
        {activeTab === 'offers' && (
          <div className="space-y-6 md:grid md:grid-cols-12 md:gap-8 md:space-y-0 animate-fade-in text-left">
            <div className="md:col-span-5 space-y-4">
              <h2 className="serif-title text-2xl text-[#3B0019]">{offId ? 'Editar Descuento' : 'Nuevo Descuento'}</h2>
              <form onSubmit={handleSaveOffer} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3">
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Titulo</label><input type="text" required value={offTitle} onChange={e => setOffTitle(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Descripcion</label><input type="text" value={offDesc} onChange={e => setOffDesc(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Descuento %</label><input type="number" required min={1} max={100} value={offDiscount} onChange={e => setOffDiscount(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Codigo</label><input type="text" required value={offCode} onChange={e => setOffCode(e.target.value.toUpperCase())} className="w-full p-2 border rounded-lg text-xs uppercase" /></div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{offId ? 'Actualizar' : 'Crear'}</button>
                  {offId && <button type="button" onClick={resetOff} className="px-4 py-2.5 border rounded-xl text-xs">Cancelar</button>}
                </div>
              </form>
            </div>
            <div className="md:col-span-7 space-y-4">
              <h3 className="serif-title text-xl text-[#3B0019] border-b pb-2">Descuentos ({offers.length})</h3>
              <input type="text" placeholder="Filtrar..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs w-full" />
              <div className="space-y-2">
                {filterOffers().length === 0 ? <p className="text-xs text-center py-8 text-[#78716C]">Sin descuentos.</p> :
                  paginate(filterOffers()).map(o => (
                    <div key={o.id} className={`p-3 rounded-xl border text-xs flex justify-between items-center ${o.isActive ? 'bg-white border-[#EADEC9]/30' : 'bg-neutral-50 opacity-70'}`}>
                      <div>
                        <span className="font-bold text-[#44403C]">{o.title}</span>
                        <span className="ml-2 text-[9px] text-[#A68F63]">({o.code})</span>
                        <span className="ml-2 text-[#78716C]">{o.discountPercentage}%</span>
                        <span className={`ml-2 text-[9px] font-semibold ${o.isActive ? 'text-green-600' : 'text-red-400'}`}>{o.isActive ? 'Activo' : 'Inactivo'}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleToggleOffer(o)} className={`px-2 py-1 text-[9px] rounded font-semibold ${o.isActive ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{o.isActive ? 'Desactivar' : 'Activar'}</button>
                        <button onClick={() => editOff(o)} className="px-2 py-1 text-[9px] text-[#A68F63] font-semibold">Editar</button>
                        <button onClick={() => handleDeleteOffer(o.id)} className="px-2 py-1 text-[9px] text-red-400 font-semibold">Eliminar</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* CMS */}
        {activeTab === 'news' && (
          <div className="space-y-6 max-w-2xl animate-fade-in text-left">
            <h2 className="serif-title text-3xl text-[#3B0019]">CMS / Landing</h2>

            {/* Lista de anuncios existentes */}
            {cmsItems.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#3B0019] uppercase">Anuncios publicados ({cmsItems.length})</h3>
                <div className="space-y-2">
                  {cmsItems.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-[#EADEC9]/40 rounded-xl">
                      <img src={item.imageUrl} alt={item.title} className="w-14 h-14 rounded-lg object-cover border shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#44403C] truncate">{item.title || 'Sin titulo'}</p>
                        <p className="text-[9px] text-[#78716C] truncate">{item.description || 'Sin descripcion'}</p>
                        <span className="text-[8px] text-[#A68F63] uppercase">{item.type} {item.isActive ? '· Activo' : '· Inactivo'}</span>
                      </div>
                      <button onClick={() => handleDeleteCMS(item.id)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold shrink-0">Quitar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveCMS} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#3B0019] uppercase">Subir nuevo anuncio</h3>
              <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Imagen</label><input type="file" accept="image/*" onChange={e => setCmsFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded-lg text-xs" /></div>
              <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Titulo</label><input type="text" value={cmsTitle} onChange={e => setCmsTitle(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
              <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Descripcion</label><textarea value={cmsDesc} onChange={e => setCmsDesc(e.target.value)} className="w-full p-2 border rounded-lg text-xs h-20" /></div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">Publicar</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
