import React, { useState, useEffect } from 'react';
import { FallbackAvatar } from '../../../App';
import { DatePicker } from '../../../components/DatePicker';

const API = 'http://localhost:3000';
const authHeaders = () => {
  const token = localStorage.getItem('winespa_token');
  return token ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } as Record<string,string> : { 'Content-Type': 'application/json' };
};
const authHeadersNoJson = () => {
  const token = localStorage.getItem('winespa_token');
  return token ? { 'Authorization': `Bearer ${token}` } as Record<string,string> : {} as Record<string,string>;
};

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
  imageUrl?: string;
  trending?: boolean;
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
  validFrom?: string;
  validUntil?: string;
  newUsersOnly?: boolean;
}

const toDateLabel = (isoDate: string) => isoDate ? isoDate.slice(0, 10) : '';
const toTimeLabel = (isoDate: string) => isoDate ? isoDate.slice(11, 16) : '';

type Tab = 'metrics' | 'appointments' | 'calendar' | 'manicurists' | 'clients' | 'services' | 'offers' | 'news';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Curso', COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};

const perPage = 5;

interface Category {
  id: string;
  name: string;
}

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [manicurists, setManicurists] = useState<Manicurist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catName, setCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);
  const [showManForm, setShowManForm] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().slice(0, 10));
  const itemsPerPage = 5;

  // Service form
  const [svcId, setSvcId] = useState<string | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDuration, setSvcDuration] = useState('');
  const [svcShort, setSvcShort] = useState('');
  const [svcIncludes, setSvcIncludes] = useState('');
  const [svcCat, setSvcCat] = useState('');
  const [svcImageUrl, setSvcImageUrl] = useState('');
  const [svcImageFile, setSvcImageFile] = useState<File | null>(null);
  const [svcTrending, setSvcTrending] = useState(false);

  // Offer form
  const [offId, setOffId] = useState<string | null>(null);
  const [offTitle, setOffTitle] = useState('');
  const [offDesc, setOffDesc] = useState('');
  const [offDiscount, setOffDiscount] = useState('');
  const [offCode, setOffCode] = useState('');
  const [offValidFrom, setOffValidFrom] = useState('');
  const [offValidUntil, setOffValidUntil] = useState('');
  const [offNewUsersOnly, setOffNewUsersOnly] = useState(false);

  // Manicurist form
  const [manId, setManId] = useState<string | null>(null);
  const [manPhone, setManPhone] = useState('');
  const [manUser, setManUser] = useState('');
  const [manName, setManName] = useState('');
  const [manPass, setManPass] = useState('');
  const [manAge, setManAge] = useState('');
  const [manGender, setManGender] = useState('Femenino');
  const [manAvatarFile, setManAvatarFile] = useState<File | null>(null);

  // Client detail modal
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAppts, setClientAppts] = useState<Appointment[]>([]);

  // CMS
  const [cmsFile, setCmsFile] = useState<File | null>(null);
  const [cmsTitle, setCmsTitle] = useState('');
  const [cmsDesc, setCmsDesc] = useState('');
  const [cmsItems, setCmsItems] = useState<any[]>([]);
  const [editingCmsId, setEditingCmsId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [unauthorized, setUnauthorized] = useState(false);
  const [adminLoginUser, setAdminLoginUser] = useState('');
  const [adminLoginPass, setAdminLoginPass] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'news') fetchCMS(); }, [activeTab]);

  const doLogin = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminLoginUser, password: adminLoginPass }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('winespa_token', data.token);
        setUnauthorized(false);
        setAdminLoginUser(''); setAdminLoginPass('');
        loadData();
      } else { setErrorMsg('Credenciales invalidas.'); }
    } catch { setErrorMsg('Error de conexion.'); }
    finally { setSubmitting(false); }
  };

  const loadData = async () => {
    setLoading(true);
    const h = authHeaders();
    try {
      const [mRes, sRes, cRes, oRes] = await Promise.all([
        fetch(`${API}/api/admin/manicurists`, { headers: h }),
        fetch(`${API}/api/services`),
        fetch(`${API}/api/admin/clients`, { headers: h }).catch(() => null),
        fetch(`${API}/api/admin/offers`, { headers: h }).catch(() => null),
      ]);

      if (mRes.status === 401 || cRes?.status === 401 || oRes?.status === 401) {
        setUnauthorized(true); setLoading(false); return;
      }
      const mData = mRes.ok ? await mRes.json() : [];
      const sData = sRes.ok ? await sRes.json() : [];
      const cPayload = cRes?.ok ? await cRes.json() : null;
      const oData = oRes?.ok ? await oRes.json() : [];

      setManicurists((mData || []).map((m: any) => ({ ...m, avatarUrl: m.avatarPath ? `${API}${m.avatarPath}` : (m.avatarUrl || '') })));
      setServicesCatalog(sData || []);
      setClients(cPayload?.data ?? (Array.isArray(cPayload) ? cPayload : []));
      setOffers(oData);

      try {
        const catRes = await fetch(`${API}/api/admin/categories`, { headers: h });
        if (catRes.ok) setCategories(await catRes.json());
      } catch { /* */ }

      let appts: Appointment[] = [];
      try {
        const aRes = await fetch(`${API}/api/admin/appointments`, { headers: h });
        if (aRes.ok) { const p = await aRes.json(); appts = p?.data ?? (Array.isArray(p) ? p : []); }
      } catch { /* */ }
      setAppointments(appts.map((a: any) => ({ ...a, status: a.status || 'PENDING' })));

      let sData2: Stats = { totalEarnings: 0, totalAppointments: 0, topManicurist: '-', manicuristPerformance: [], appointmentsByStatus: [] };
      try {
        const stRes = await fetch(`${API}/api/admin/stats`, { headers: h });
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
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }),
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

    let finalImageUrl = svcImageUrl || undefined;
    if (svcImageFile) {
      try {
        const fd = new FormData(); fd.append('image', svcImageFile);
        const uRes = await fetch(`${API}/api/admin/landing/upload`, { method: 'POST', headers: authHeadersNoJson(), body: fd });
        if (uRes.ok) { const d = await uRes.json(); finalImageUrl = d.imageUrl; }
      } catch { /* */ }
    }

    const body: any = { name: svcName, price: parseFloat(svcPrice), durationInMinutes: parseInt(svcDuration), shortDescription: svcShort || undefined, includesDescription: svcIncludes || undefined, category: svcCat || undefined, trending: svcTrending, ...(finalImageUrl && { imageUrl: finalImageUrl }) };
    try {
      const url = svcId ? `${API}/api/admin/services/${svcId}` : `${API}/api/admin/services`;
      const res = await fetch(url, { method: svcId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      if (res.ok) { setSuccessMsg(svcId ? 'Actualizado.' : 'Creado.'); resetSvc(); loadData(); } else throw new Error();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const handleDeleteService = async (id: string | number) => {
    if (!confirm('Eliminar?')) return;
    try { const r = await fetch(`${API}/api/admin/services/${id}`, { method: 'DELETE', headers: authHeaders() }); if (r.ok) { setSuccessMsg('Eliminado.'); loadData(); } else { const e = await r.json().catch(() => ({})); setErrorMsg(e.error || 'No se pudo.'); } } catch { setErrorMsg('Error.'); }
  };
  const editSvc = (s: ServiceCatalogItem) => { setSvcId(String(s.id)); setSvcName(s.name); setSvcPrice(String(s.price)); setSvcDuration(String(s.durationInMinutes || 60)); setSvcShort(s.shortDescription || ''); setSvcIncludes(s.includesDescription || ''); setSvcCat(s.category || ''); setSvcImageUrl(s.imageUrl || ''); setSvcImageFile(null); setSvcTrending(s.trending || false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resetSvc = () => { setSvcId(null); setSvcName(''); setSvcPrice(''); setSvcDuration(''); setSvcShort(''); setSvcIncludes(''); setSvcCat(''); setSvcImageUrl(''); setSvcImageFile(null); setSvcTrending(false); };

  // --- Offers ---
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offTitle || !offDiscount || !offCode) return;
    setSubmitting(true);
    const body: any = { title: offTitle, discountPercentage: parseInt(offDiscount), code: offCode, description: offDesc || undefined, validFrom: offValidFrom || null, validUntil: offValidUntil || null, newUsersOnly: offNewUsersOnly };
    try {
      const url = offId ? `${API}/api/admin/offers/${offId}` : `${API}/api/admin/offers`;
      const res = await fetch(url, { method: offId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      if (res.ok) { setSuccessMsg(offId ? 'Actualizada.' : 'Creada.'); resetOff(); loadData(); } else throw new Error();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const handleDeleteOffer = async (id: string) => { if (!confirm('Eliminar?')) return; try { const r = await fetch(`${API}/api/admin/offers/${id}`, { method: 'DELETE', headers: authHeaders() }); if (r.ok) { setSuccessMsg('Eliminada.'); loadData(); } else setErrorMsg('No se pudo.'); } catch { setErrorMsg('Error.'); } };
  const handleToggleOffer = async (o: Offer) => { try { const r = await fetch(`${API}/api/admin/offers/${o.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ isActive: !o.isActive }) }); if (r.ok) setOffers(prev => prev.map(x => x.id === o.id ? { ...x, isActive: !o.isActive } : x)); } catch { /* */ } };
  const editOff = (o: Offer) => { setOffId(o.id); setOffTitle(o.title); setOffDesc(o.description || ''); setOffDiscount(String(o.discountPercentage)); setOffCode(o.code); setOffValidFrom(o.validFrom ? o.validFrom.slice(0, 10) : ''); setOffValidUntil(o.validUntil ? o.validUntil.slice(0, 10) : ''); setOffNewUsersOnly(o.newUsersOnly || false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resetOff = () => { setOffId(null); setOffTitle(''); setOffDesc(''); setOffDiscount(''); setOffCode(''); setOffValidFrom(''); setOffValidUntil(''); setOffNewUsersOnly(false); };

  // --- Categories ---
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSubmitting(true);
    try {
      const url = editingCatId ? `${API}/api/admin/categories/${editingCatId}` : `${API}/api/admin/categories`;
      const res = await fetch(url, {
        method: editingCatId ? 'PATCH' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: catName.trim() }),
      });
      if (res.ok) {
        setSuccessMsg(editingCatId ? 'Categoria actualizada.' : 'Categoria creada.');
        setCatName(''); setEditingCatId(null);
        loadData();
      } else {
        const err = await res.json().catch(() => null);
        setErrorMsg(err?.error || 'Error.');
      }
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Eliminar esta categoria? Los servicios en ella quedaran sin categoria.')) return;
    try {
      const r = await fetch(`${API}/api/admin/categories/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (r.ok) { setSuccessMsg('Eliminada.'); loadData(); } else setErrorMsg('No se pudo.');
    } catch { setErrorMsg('Error.'); }
  };
  const editCat = (c: Category) => { setEditingCatId(c.id); setCatName(c.name); setShowCategoriesPanel(true); };

  // --- Manicurists ---
  const handleSaveManicurist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manPhone || !manUser || !manName) return;
    setSubmitting(true);
    const body: any = { phone: manPhone, username: manUser, name: manName, age: manAge ? parseInt(manAge) : null, gender: manGender || null };
    if (manId) { if (manPass) body.password = manPass; } else { if (!manPass) { setErrorMsg('Contraseña requerida para nueva manicurista.'); setSubmitting(false); return; } body.password = manPass; }
    try {
      const url = manId ? `${API}/api/admin/manicurists/${manId}` : `${API}/api/admin/manicurists`;
      const res = await fetch(url, { method: manId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      const targetId = saved.id || manId;
      if (manAvatarFile && targetId) {
        const fd = new FormData();
        fd.append('image', manAvatarFile);
        fd.append('manicuristId', String(targetId));
        await fetch(`${API}/api/admin/manicurists/upload-avatar`, { method: 'POST', headers: authHeadersNoJson(), body: fd });
      }
      setSuccessMsg(manId ? 'Actualizada.' : 'Creada.');
      resetMan(); loadData();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const editMan = (m: Manicurist) => { setManId(String(m.id)); setManPhone(m.phone); setManUser(m.username); setManName(m.name); setManPass(''); setManAge(m.age ? String(m.age) : ''); setManGender(m.gender || 'Femenino'); setManAvatarFile(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resetMan = () => { setManId(null); setManPhone(''); setManUser(''); setManName(''); setManPass(''); setManAge(''); setManGender('Femenino'); setManAvatarFile(null); };

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
      const r = await fetch(`${API}/api/admin/landing-cms/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (r.ok) { setSuccessMsg('Eliminado.'); fetchCMS(); } else setErrorMsg('No se pudo eliminar.');
    } catch { setErrorMsg('Error.'); }
  };
  const editCms = (item: any) => {
    setEditingCmsId(item.id);
    setCmsTitle(item.title || '');
    setCmsDesc(item.description || '');
    setCmsFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const resetCms = () => {
    setEditingCmsId(null);
    setCmsFile(null);
    setCmsTitle('');
    setCmsDesc('');
  };
  const handleSaveCMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCmsId && !cmsFile) { setErrorMsg('Selecciona una imagen.'); return; }
    if (!cmsTitle) { setErrorMsg('El titulo es requerido.'); return; }
    setSubmitting(true);
    try {
      let imageUrl = '';
      if (cmsFile) {
        const fd = new FormData(); fd.append('image', cmsFile);
        const uRes = await fetch(`${API}/api/admin/landing/upload`, { method: 'POST', headers: authHeadersNoJson(), body: fd });
        if (!uRes.ok) throw new Error();
        const data = await uRes.json();
        imageUrl = data.imageUrl;
      }
      const payload: any = { type: 'CAROUSEL', title: cmsTitle, description: cmsDesc, isActive: true };
      if (imageUrl) payload.imageUrl = imageUrl;
      if (editingCmsId) payload.id = editingCmsId;
      const r = await fetch(`${API}/api/admin/landing-cms`, { method: 'POST', headers: authHeaders(), body: JSON.stringify([payload]) });
      if (r.ok) { setSuccessMsg(editingCmsId ? 'Actualizado.' : 'Publicado.'); resetCms(); fetchCMS(); } else throw new Error();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };

  // --- Helpers ---
  const paginate = (items: any[]) => { const s = (currentPage - 1) * itemsPerPage; return items.slice(s, s + itemsPerPage); };
  const filterApps = () => appointments.filter(a => `${a.clientName || a.client?.name || ''} ${getManName(a.manicuristId)}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const filterClients = () => clients.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const filterOffers = () => offers.filter(o => `${o.title} ${o.code}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const getManName = (id: string | number) => manicurists.find(m => String(m.id) === String(id))?.name || '—';
  const svcNames = (ss: ServiceItem[]) => ss.map(s => s.name).join(', ') || '—';
  const clear = () => { setSuccessMsg(null); setErrorMsg(null); setSearchQuery(''); setCurrentPage(1); };
  const priceFmt = (p: any) => typeof p === 'number' ? `$${p.toLocaleString('es-CO')}` : `$${p}`;

  if (loading) return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center"><span className="serif-title text-2xl text-[#3B0019] animate-pulse">Cargando...</span></div>;
  if (unauthorized) return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
      <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-8 max-w-sm w-full space-y-5 text-center shadow-lg">
        <div>
          <span className="serif-title text-2xl text-[#3B0019]">WineSpa Admin</span>
          <p className="text-xs text-[#78716C] mt-1">Inicia sesion para acceder al panel</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); doLogin(); }} className="space-y-3 text-left">
          <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Usuario</label><input type="text" required value={adminLoginUser} onChange={e => setAdminLoginUser(e.target.value)} className="w-full p-2.5 border rounded-lg text-xs" /></div>
          <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Contrasena</label><input type="password" required value={adminLoginPass} onChange={e => setAdminLoginPass(e.target.value)} className="w-full p-2.5 border rounded-lg text-xs" /></div>
          {errorMsg && <p className="text-[10px] text-red-600 bg-red-50 p-2 rounded-lg">{errorMsg}</p>}
          <button type="submit" disabled={submitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{submitting ? 'Entrando...' : 'Ingresar'}</button>
        </form>
        <p className="text-[9px] text-[#A68F63]">Acceso exclusivo para administradores de WineSpa</p>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'metrics', label: 'Estadisticas' },
    { id: 'appointments', label: 'Pizarra de Citas' },
    { id: 'calendar', label: 'Calendario' },
    { id: 'manicurists', label: 'Manicuristas' },
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
            {/* Desktop: tabla normal */}
            <div className="hidden md:block bg-white border border-[#EADEC9]/40 rounded-2xl overflow-x-auto">
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

            {/* Mobile: cards apiladas */}
            <div className="md:hidden space-y-2">
              {filterApps().length === 0 ? <p className="text-xs text-center py-8 text-[#78716C]">Sin citas.</p> :
                paginate(filterApps()).map(a => (
                  <div key={a.id} className={`p-4 rounded-xl border text-left text-xs ${a.status === 'IN_PROGRESS' ? 'bg-[#5C0632]/5 border-[#8E1B54]/40' : 'bg-white border-[#EADEC9]/40'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-[#3B0019]">#{a.appointmentId || a.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        a.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                        a.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                        a.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                      }`}>{STATUS_LABELS[a.status || 'PENDING']}</span>
                    </div>
                    <div className="space-y-1 mb-3">
                      <p className="text-[#44403C]"><span className="text-[#A68F63] font-medium">Cliente:</span> {a.clientName || a.client?.name || '—'}</p>
                      <p className="text-[#44403C]"><span className="text-[#A68F63] font-medium">Manicurista:</span> {a.manicurist?.name || getManName(a.manicuristId)}</p>
                      <p className="text-[#44403C]"><span className="text-[#A68F63] font-medium">Servicios:</span> {svcNames(a.services)}</p>
                      <p className="text-[#44403C]"><span className="text-[#A68F63] font-medium">Fecha:</span> {toDateLabel(a.date)} · {toTimeLabel(a.date)}</p>
                      <p className="font-semibold text-[#8E1B54]">Total: {priceFmt(a.totalPrice)}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {a.status === 'PENDING' && <button onClick={() => handleUpdateStatus(a.id, 'IN_PROGRESS')} className="flex-1 py-2.5 text-[11px] bg-amber-100 text-amber-800 rounded-xl font-bold">Iniciar</button>}
                      {a.status === 'IN_PROGRESS' && <button onClick={() => handleUpdateStatus(a.id, 'COMPLETED')} className="flex-1 py-2.5 text-[11px] bg-[#8E1B54] text-white rounded-xl font-bold">Completar</button>}
                      {a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && <button onClick={() => handleUpdateStatus(a.id, 'CANCELLED')} className="flex-1 py-2.5 text-[11px] border border-red-200 text-red-700 rounded-xl">Cancelar</button>}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="space-y-6 animate-fade-in text-left max-w-3xl">
            <h2 className="serif-title text-2xl text-[#3B0019]">Vista de Calendario</h2>
            <div className="md:grid md:grid-cols-12 md:gap-8">
              <div className="md:col-span-5">
                <DatePicker
                  selectedDate={calendarDate}
                  onSelectDate={setCalendarDate}
                />
              </div>
              <div className="md:col-span-7 space-y-3">
                <h3 className="text-xs font-bold text-[#3B0019] uppercase border-b border-[#EADEC9]/30 pb-2">
                  Citas del {calendarDate}
                </h3>
                {appointments.filter(a => (a.date || '').slice(0, 10) === calendarDate).length === 0 ? (
                  <p className="text-xs text-[#78716C] py-6 text-center">Sin citas para este día.</p>
                ) : (
                  <div className="space-y-2">
                    {appointments
                      .filter(a => (a.date || '').slice(0, 10) === calendarDate)
                      .sort((a, b) => ((a.date || '') > (b.date || '') ? 1 : -1))
                      .map(a => (
                        <div key={a.id} className="p-3 bg-white border border-[#EADEC9]/40 rounded-xl text-xs flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            a.status === 'COMPLETED' ? 'bg-green-500' :
                            a.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                            a.status === 'CANCELLED' ? 'bg-red-400' : 'bg-amber-400'
                          }`} />
                          <span className="font-bold text-[#44403C] w-12">{(a.date || '').slice(11, 16)}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[#3B0019] font-semibold">{a.clientName || 'Cliente'}</span>
                            <span className="ml-2 text-[#A68F63]">{a.manicurist?.name || '—'}</span>
                            <p className="text-[9px] text-[#78716C] truncate">{a.services?.map(s => s.name).join(', ') || '—'}</p>
                          </div>
                          <span className={`text-[9px] font-semibold ${
                            a.status === 'COMPLETED' ? 'text-green-600' :
                            a.status === 'IN_PROGRESS' ? 'text-blue-600' :
                            a.status === 'CANCELLED' ? 'text-red-400' : 'text-amber-500'
                          }`}>{STATUS_LABELS[a.status || 'PENDING'] || 'Pendiente'}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MANICURISTS */}
        {activeTab === 'manicurists' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="flex items-center justify-between">
              <h2 className="serif-title text-3xl text-[#3B0019]">Manicuristas</h2>
              <button
                onClick={() => { setShowManForm(!showManForm); if (!showManForm) resetMan(); }}
                className="px-4 py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl"
              >
                {showManForm ? 'Cancelar' : '+ Nueva Manicurista'}
              </button>
            </div>

            {showManForm && (
              <div className="bg-white border border-[#8E1B54]/25 rounded-2xl p-5 space-y-3 shadow-xs animate-fade-in">
                <h3 className="text-xs font-bold text-[#3B0019] uppercase">{manId ? 'Editar Manicurista' : 'Nueva Manicurista'}</h3>
                <form onSubmit={handleSaveManicurist} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Telefono</label><input type="tel" required maxLength={10} value={manPhone} onChange={e => setManPhone(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                    <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Usuario</label><input type="text" required maxLength={30} value={manUser} onChange={e => setManUser(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  </div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Nombre Completo</label><input type="text" required maxLength={60} value={manName} onChange={e => setManName(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Contrasena {manId && '(dejar vacio = no cambiar)'}</label><input type="password" maxLength={64} required={!manId} value={manPass} onChange={e => setManPass(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Edad</label><input type="number" min={0} max={120} value={manAge} onChange={e => setManAge(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                    <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Genero</label><select value={manGender} onChange={e => setManGender(e.target.value)} className="w-full p-2 border rounded-lg text-xs bg-white"><option value="Femenino">Femenino</option><option value="Masculino">Masculino</option></select></div>
                  </div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Foto {manId && '(opcional)'}</label><input type="file" accept="image/*" onChange={e => setManAvatarFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{manId ? 'Actualizar' : 'Crear'}</button>
                    {manId && <button type="button" onClick={() => { resetMan(); setShowManForm(false); }} className="px-4 py-2.5 border rounded-xl text-xs">Cancelar</button>}
                  </div>
                </form>
              </div>
            )}

            <div className="flex items-center gap-3 bg-white border border-[#EADEC9]/30 p-3 rounded-xl">
              <input type="text" placeholder="Buscar manicurista..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs flex-1" />
              <span className="text-[10px] text-[#A68F63]">{manicurists.length} en equipo</span>
            </div>

            {(() => {
              const filtered = manicurists
                .filter(m => (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (m.username || '').toLowerCase().includes(searchQuery.toLowerCase()))
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
              if (filtered.length === 0) return <p className="text-xs text-center py-8 text-[#78716C]">Sin coincidencias.</p>;
              const start = (currentPage - 1) * perPage;
              const page = filtered.slice(start, start + perPage);
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {page.map(m => (
                      <div key={m.id} className="bg-white border border-[#EADEC9]/40 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center gap-3">
                          {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover border" /> : <FallbackAvatar className="w-10 h-10" />}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-[#3B0019] truncate">{m.name}</h4>
                            <p className="text-[10px] text-[#78716C]">@{m.username} {m.age ? `· ${m.age} anos` : ''}</p>
                          </div>
                        </div>
                        {m.schedules && m.schedules.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-2 border-t border-[#EADEC9]/10">
                            {m.schedules.map((sch, i) => <span key={i} className="px-2 py-0.5 rounded bg-[#F7F3EB] text-[#8D774C] text-[9px] font-semibold">{sch.shiftTemplate?.name} ({sch.shiftTemplate?.startTime}-{sch.shiftTemplate?.endTime})</span>)}
                          </div>
                        )}
                        <button onClick={() => { editMan(m); setShowManForm(true); }} className="w-full py-1.5 border border-[#EADEC9] rounded-lg text-[10px] text-[#A68F63] font-semibold hover:bg-[#5C0632]/5">Editar</button>
                      </div>
                    ))}
                  </div>
                  {pagination(filtered.length)}
                </div>
              );
            })()}
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
          <div className="space-y-6 animate-fade-in text-left">
            <div className="flex items-center justify-between">
              <h2 className="serif-title text-3xl text-[#3B0019]">Servicios</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowCategoriesPanel(!showCategoriesPanel)} className="px-3 py-2 border border-[#EADEC9] rounded-xl text-[10px] text-[#A68F63] font-semibold hover:bg-[#5C0632]/5">
                  {showCategoriesPanel ? 'Ocultar Categorias' : 'Categorias'}
                </button>
              </div>
            </div>

            {/* Categories Panel */}
            {showCategoriesPanel && (
              <div className="bg-white border border-[#8E1B54]/25 rounded-2xl p-5 space-y-3 animate-fade-in">
                <h3 className="text-xs font-bold text-[#3B0019] uppercase">Gestionar Categorias</h3>
                <form onSubmit={handleSaveCategory} className="flex gap-2">
                  <input type="text" placeholder="Nombre de categoria" value={catName} onChange={e => setCatName(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs" />
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">
                    {editingCatId ? 'Renombrar' : 'Agregar'}
                  </button>
                  {editingCatId && <button type="button" onClick={() => { setEditingCatId(null); setCatName(''); }} className="px-3 py-2 border rounded-xl text-xs">Cancelar</button>}
                </form>
                <div className="space-y-1">
                  {categories.map(c => (
                    <div key={c.id} className="flex justify-between items-center text-xs py-1.5 px-2 rounded-lg bg-[#F7F3EB]/50">
                      <span className="font-medium text-[#44403C]">{c.name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => editCat(c)} className="text-[#A68F63] font-semibold">Renombrar</button>
                        <button onClick={() => handleDeleteCategory(c.id)} className="text-red-400 font-semibold">Eliminar</button>
                      </div>
                    </div>
                  ))}
                  {categories.length === 0 && <p className="text-[10px] text-[#78716C] py-2">Sin categorias creadas.</p>}
                </div>
              </div>
            )}

            {/* Service Form */}
            <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold text-[#3B0019] uppercase">{svcId ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
              <form onSubmit={handleSaveService} className="space-y-3">
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Nombre</label><input type="text" required value={svcName} onChange={e => setSvcName(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Descripcion Corta</label><input type="text" value={svcShort} onChange={e => setSvcShort(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Incluye</label><textarea value={svcIncludes} onChange={e => setSvcIncludes(e.target.value)} className="w-full p-2 border rounded-lg text-xs h-16" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-[#A68F63] font-bold block">Categoria</label>
                    <select value={svcCat} onChange={e => setSvcCat(e.target.value)} className="w-full p-2 border rounded-lg text-xs bg-white">
                      <option value="">Sin categoria</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Duracion (min)</label><input type="number" required value={svcDuration} onChange={e => setSvcDuration(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                </div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Precio ($)</label><input type="number" required value={svcPrice} onChange={e => setSvcPrice(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Imagen {svcId && '(opcional)'}</label><input type="file" accept="image/*" onChange={e => setSvcImageFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded-lg text-xs" /></div>
                <label className="flex items-center gap-2 text-[11px] text-[#44403C] cursor-pointer">
                  <input type="checkbox" checked={svcTrending} onChange={e => setSvcTrending(e.target.checked)} className="rounded" />
                  Servicio en tendencia (aparece primero en el catalogo)
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{svcId ? 'Actualizar' : 'Crear'}</button>
                  {svcId && <button type="button" onClick={resetSvc} className="px-4 py-2.5 border rounded-xl text-xs">Cancelar</button>}
                </div>
              </form>
            </div>

            {/* Service List */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-white border border-[#EADEC9]/30 p-3 rounded-xl">
                <input type="text" placeholder="Buscar servicio..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs flex-1" />
                <span className="text-[10px] text-[#A68F63]">{servicesCatalog.length} servicios</span>
              </div>
              {(() => {
                const sorted = [...servicesCatalog]
                  .sort((a, b) => {
                    if (a.trending && !b.trending) return -1;
                    if (!a.trending && b.trending) return 1;
                    return (a.name || '').localeCompare(b.name || '');
                  })
                  .filter(s => (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.category || '').toLowerCase().includes(searchQuery.toLowerCase()));
                if (sorted.length === 0) return <p className="text-xs text-center py-8 text-[#78716C]">Sin servicios.</p>;
                const start = (currentPage - 1) * perPage;
                const page = sorted.slice(start, start + perPage);
                return (
                  <>
                    <div className="space-y-2">
                      {page.map(s => (
                        <div key={s.id} className="p-3 rounded-xl bg-white border border-[#EADEC9]/30 flex justify-between items-center text-xs">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {s.trending && <span className="text-[8px] px-1.5 py-0.5 bg-[#8E1B54] text-white rounded-full font-bold">TOP</span>}
                              <span className="font-bold text-[#44403C] truncate">{s.name}</span>
                            </div>
                            <div className="flex gap-2 mt-0.5">
                              {s.category && <span className="text-[9px] bg-[#F7F3EB] px-1.5 py-0.5 rounded text-[#A68F63]">{s.category}</span>}
                              <span className="text-[9px] text-[#78716C]">{s.durationInMinutes || '?'} min</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-[#8E1B54]">{priceFmt(s.price)}</span>
                            <button onClick={() => editSvc(s)} className="text-[10px] text-[#A68F63] font-semibold">Editar</button>
                            <button onClick={() => handleDeleteService(s.id)} className="text-[10px] text-red-400 font-semibold">Eliminar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {pagination(sorted.length)}
                  </>
                );
              })()}
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
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Vigencia desde</label><input type="date" value={offValidFrom} onChange={e => setOffValidFrom(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Vigencia hasta</label><input type="date" value={offValidUntil} onChange={e => setOffValidUntil(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-[#44403C] cursor-pointer">
                  <input type="checkbox" checked={offNewUsersOnly} onChange={e => setOffNewUsersOnly(e.target.checked)} className="rounded" />
                  Solo para nuevos clientes (sin citas previas)
                </label>
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
                      <div className="space-y-0.5">
                        <div>
                          <span className="font-bold text-[#44403C]">{o.title}</span>
                          <span className="ml-2 text-[9px] text-[#A68F63]">({o.code})</span>
                          <span className="ml-2 text-[#78716C]">{o.discountPercentage}%</span>
                          <span className={`ml-2 text-[9px] font-semibold ${o.isActive ? 'text-green-600' : 'text-red-400'}`}>{o.isActive ? 'Activo' : 'Inactivo'}</span>
                        </div>
                        {(o.validFrom || o.validUntil) && (
                          <div className="flex gap-2 text-[9px]">
                            {o.validFrom && <span className="text-[#78716C]">Desde: {o.validFrom.slice(0, 10)}</span>}
                            {o.validUntil && <span className="text-[#78716C]">Hasta: {o.validUntil.slice(0, 10)}</span>}
                            {(() => {
                              const now = new Date().toISOString();
                              if (o.validUntil && now > o.validUntil) return <span className="text-red-500 font-semibold">Expirada</span>;
                              if (o.validFrom && now < o.validFrom) return <span className="text-amber-500 font-semibold">Programada</span>;
                              if (o.validFrom || o.validUntil) return <span className="text-green-600 font-semibold">Vigente</span>;
                              return null;
                            })()}
                          </div>
                        )}
                        {o.newUsersOnly && <span className="text-[9px] text-blue-500 font-medium">Solo nuevos clientes</span>}
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => editCms(item)} className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold">Editar</button>
                        <button onClick={() => handleDeleteCMS(item.id)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">Quitar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveCMS} className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#3B0019] uppercase">{editingCmsId ? 'Editar anuncio' : 'Subir nuevo anuncio'}</h3>
              <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Imagen {editingCmsId && '(dejar vacio = no cambiar)'}</label><input type="file" accept="image/*" onChange={e => setCmsFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded-lg text-xs" /></div>
              <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Titulo</label><input type="text" value={cmsTitle} onChange={e => setCmsTitle(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
              <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Descripcion</label><textarea value={cmsDesc} onChange={e => setCmsDesc(e.target.value)} className="w-full p-2 border rounded-lg text-xs h-20" /></div>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{editingCmsId ? 'Actualizar' : 'Publicar'}</button>
                {editingCmsId && <button type="button" onClick={resetCms} className="px-4 py-2.5 border rounded-xl text-xs">Cancelar</button>}
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
