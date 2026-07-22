import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { FallbackAvatar } from '../../../App';
import { DatePicker } from '../../../components/DatePicker';
import { WhatsAppChat } from '../components/WhatsAppChat';
import { WhatsAppConfig } from '../components/WhatsAppConfig';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
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
  isActive?: boolean;
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
  isActive?: boolean;
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

// Fecha del negocio (Colombia, UTC-5 fijo, sin horario de verano) -- ni
// `toISOString()` real (cruza de dia entre ~19:00 y medianoche hora Colombia)
// ni la hora local del NAVEGADOR (un admin viajando o conectandose desde otro
// huso daria un dia distinto) sirven aca. Restamos el offset fijo sobre el
// timestamp real y leemos los componentes en UTC, para que de el mismo
// resultado sin importar en que zona horaria este el navegador.
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;
const toLocalDateKey = (d: Date) => {
  const co = new Date(d.getTime() - COLOMBIA_OFFSET_MS);
  return `${co.getUTCFullYear()}-${String(co.getUTCMonth() + 1).padStart(2, '0')}-${String(co.getUTCDate()).padStart(2, '0')}`;
};

// Misma semana ISO 8601 que backend/src/lib/week.ts -- necesaria para saber
// que semana/anio corresponde al turno que se esta editando.
function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return { week, year: d.getUTCFullYear() };
}

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Inversa de getISOWeek: dado semana+anio ISO, calcula el lunes de esa semana
// (el 4 de enero siempre cae en la semana 1 del estandar ISO 8601).
function formatWeekRange(week: number, year: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime() - jan4Day * 86400000);
  const start = new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = sameMonth ? `${start.getUTCDate()}` : `${start.getUTCDate()} ${MONTH_ABBR[start.getUTCMonth()]}`;
  return `${startLabel} - ${end.getUTCDate()} ${MONTH_ABBR[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

type Tab = 'metrics' | 'appointments' | 'calendar' | 'manicurists' | 'clients' | 'services' | 'offers' | 'news' | 'schedule' | 'chats' | 'whatsapp_config';

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
  const [apptDateFilter, setApptDateFilter] = useState<'all' | 'today' | 'tomorrow'>('all');
  const [apptManicuristFilter, setApptManicuristFilter] = useState('all');
  const [apptStatusFilter, setApptStatusFilter] = useState('all');
  const [animateBars, setAnimateBars] = useState(false);
  const [metricsOffsetDays, setMetricsOffsetDays] = useState(0);
  const [metricsType, setMetricsType] = useState<'earnings' | 'appointments'>('earnings');

  const [stats, setStats] = useState<Stats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsTruncated, setAppointmentsTruncated] = useState(false);
  const [manicurists, setManicurists] = useState<Manicurist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catName, setCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);
  const [showManForm, setShowManForm] = useState(false);
  const [showSvcForm, setShowSvcForm] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [calendarDate, setCalendarDate] = useState(toLocalDateKey(new Date()));
  const itemsPerPage = 5;

  // Custom modal de confirmacion elegante
  interface ConfirmModalState {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  // Turnos
  const [shiftTemplates, setShiftTemplates] = useState<{ id: string; name: string; startTime: string; endTime: string }[]>([]);
  const [weekSchedule, setWeekSchedule] = useState<{ manicuristId: string; shiftTemplateId: string }[]>([]);
  const initialWeek = getISOWeek(new Date());
  const [scheduleWeek, setScheduleWeek] = useState(initialWeek.week);
  const [scheduleYear, setScheduleYear] = useState(initialWeek.year);
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

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
  // Si fetchCMS falla, cmsItems queda vacio o stale -- los editores de Hero/
  // Experience usan `cmsItems.find(...)?.id` para decidir si actualizan el
  // registro existente o crean uno nuevo. Sin este flag, subir una imagen en
  // ese momento crearia un HERO/EXPERIENCE duplicado en vez de actualizar.
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsError, setCmsError] = useState(false);
  const [editingCmsId, setEditingCmsId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [unauthorized, setUnauthorized] = useState(false);
  // Antes, si manicuristas/servicios fallaban al cargar, el dashboard
  // simplemente se veia vacio -- indistinguible de "no hay datos", cuando en
  // realidad el fetch fallo. Esto lo hace visible con un banner y reintento.
  const [loadError, setLoadError] = useState(false);
  const [adminLoginUser, setAdminLoginUser] = useState('');
  const [adminLoginPass, setAdminLoginPass] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'news') fetchCMS(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'schedule') fetchWeekSchedule(); }, [activeTab, scheduleWeek, scheduleYear]);
  useEffect(() => {
    if (activeTab === 'metrics') {
      setAnimateBars(false);
      const timer = setTimeout(() => setAnimateBars(true), 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, metricsOffsetDays, metricsType]);

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

  // Si el fetch falla, dejamos las stats actuales tal como estan en vez de
  // pisarlas con el objeto en cero -- eso se veia como si de golpe no hubiera
  // ganancias/citas, cuando en realidad solo fallo la actualizacion.
  const fetchStats = async (): Promise<void> => {
    try {
      const stRes = await fetch(`${API}/api/admin/stats`, { headers: authHeaders() });
      if (!stRes.ok) { setLoadError(true); return; }
      const r = await stRes.json();
      setStats({
        totalEarnings: r.totalEarnings ?? 0,
        totalAppointments: r.appointmentsByStatus?.reduce((sum: number, s: any) => sum + s.count, 0) ?? 0,
        topManicurist: r.manicuristPerformance?.[0]?.name || '-',
        manicuristPerformance: (r.manicuristPerformance || []).map((p: any) => ({
          name: p.name, completedAppointments: p.completedAppointments ?? 0,
        })),
        appointmentsByStatus: r.appointmentsByStatus || [],
      });
    } catch { setLoadError(true); /* dejamos las stats actuales, ver comentario arriba */ }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    const h = authHeaders();
    try {
      const [mRes, sRes, cRes, oRes] = await Promise.all([
        fetch(`${API}/api/admin/manicurists`, { headers: h }),
        fetch(`${API}/api/services`, { headers: h }),
        fetch(`${API}/api/admin/clients`, { headers: h }).catch(() => null),
        fetch(`${API}/api/admin/offers`, { headers: h }).catch(() => null),
      ]);

      if (mRes.status === 401 || cRes?.status === 401 || oRes?.status === 401) {
        setUnauthorized(true); setLoading(false); return;
      }
      if (!mRes.ok || !sRes.ok) setLoadError(true);
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

      try {
        const shiftRes = await fetch(`${API}/api/admin/shift-templates`, { headers: h });
        if (shiftRes.ok) setShiftTemplates(await shiftRes.json());
      } catch { /* */ }

      let appts: Appointment[] = [];
      try {
        const aRes = await fetch(`${API}/api/admin/appointments?limit=1000`, { headers: h });
        if (aRes.ok) {
          const p = await aRes.json();
          appts = p?.data ?? (Array.isArray(p) ? p : []);
          // El fetch tiene un tope de 1000: si el total real lo supera, la
          // Pizarra de Citas y el Panel de Metricas quedarian truncados en
          // silencio. Mejor avisar que el dato esta incompleto que fingir
          // que es todo lo que hay.
          setAppointmentsTruncated(typeof p?.totalCount === 'number' && p.totalCount > appts.length);
        } else {
          // Antes esto dejaba `appts` en [] en silencio -- la Pizarra de
          // Citas mostraba "Sin citas" (dato falso), indistinguible de que
          // de verdad no hubiera ninguna.
          setLoadError(true);
        }
      } catch { setLoadError(true); }
      setAppointments(appts.map((a: any) => ({ ...a, status: a.status || 'PENDING' })));

      await fetchStats();
      if (activeTab === 'metrics') {
        setAnimateBars(false);
        setTimeout(() => setAnimateBars(true), 150);
      }
    } catch { setLoadError(true); }
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
        fetchStats();
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
      if (res.ok) { setSuccessMsg(svcId ? 'Actualizado.' : 'Creado.'); resetSvc(); setShowSvcForm(false); loadData(); } else throw new Error();
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const handleDeleteService = (id: string | number) => {
    const s = servicesCatalog.find(x => String(x.id) === String(id));
    setConfirmModal({
      title: 'Eliminar Servicio',
      message: `¿Seguro que deseas eliminar "${s?.name || 'este servicio'}"?`,
      confirmText: 'Eliminar Servicio',
      isDanger: true,
      onConfirm: async () => {
        try {
          const r = await fetch(`${API}/api/admin/services/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (r.ok) {
            setSuccessMsg('Servicio eliminado.');
            loadData();
          } else {
            const e = await r.json().catch(() => ({}));
            if (r.status === 409 && s) {
              setConfirmModal({
                title: 'Servicio con Citas Registradas',
                message: `${e.error || 'No se puede eliminar porque tiene citas asociadas'}. ¿Deseas deshabilitarlo en su lugar para ocultarlo de la carta pública sin borrar su historial?`,
                confirmText: 'Deshabilitar Servicio',
                isDanger: false,
                onConfirm: () => handleToggleServiceActive(s)
              });
            } else {
              setErrorMsg(e.error || 'No se pudo eliminar.');
            }
          }
        } catch { setErrorMsg('Error al conectar.'); }
      }
    });
  };
  const handleToggleServiceActive = async (s: ServiceCatalogItem) => {
    try {
      const nextActive = s.isActive === false;
      const r = await fetch(`${API}/api/admin/services/${s.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ isActive: nextActive }) });
      if (r.ok) { setSuccessMsg(nextActive ? 'Servicio reactivado.' : 'Servicio deshabilitado.'); loadData(); } else setErrorMsg('No se pudo modificar el servicio.');
    } catch { setErrorMsg('Error al conectar.'); }
  };
  const editSvc = (s: ServiceCatalogItem) => { setSvcId(String(s.id)); setSvcName(s.name); setSvcPrice(String(s.price)); setSvcDuration(String(s.durationInMinutes || 60)); setSvcShort(s.shortDescription || ''); setSvcIncludes(s.includesDescription || ''); setSvcCat(s.category || ''); setSvcImageUrl(s.imageUrl || ''); setSvcImageFile(null); setSvcTrending(s.trending || false); setShowSvcForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
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
  const handleDeleteOffer = (id: string) => {
    setConfirmModal({
      title: 'Eliminar Descuento',
      message: '¿Seguro que deseas eliminar esta oferta o código de descuento?',
      confirmText: 'Eliminar',
      isDanger: true,
      onConfirm: async () => {
        try {
          const r = await fetch(`${API}/api/admin/offers/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (r.ok) { setSuccessMsg('Eliminada.'); loadData(); } else setErrorMsg('No se pudo eliminar.');
        } catch { setErrorMsg('Error al conectar.'); }
      }
    });
  };
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
  const handleDeleteCategory = (id: string) => {
    setConfirmModal({
      title: 'Eliminar Categoría',
      message: '¿Eliminar esta categoría? Los servicios en ella quedarán sin categoría.',
      confirmText: 'Eliminar',
      isDanger: true,
      onConfirm: async () => {
        try {
          const r = await fetch(`${API}/api/admin/categories/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (r.ok) { setSuccessMsg('Eliminada.'); loadData(); } else setErrorMsg('No se pudo eliminar.');
        } catch { setErrorMsg('Error.'); }
      }
    });
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
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const editMan = (m: Manicurist) => { setManId(String(m.id)); setManPhone(m.phone); setManUser(m.username); setManName(m.name); setManPass(''); setManAge(m.age ? String(m.age) : ''); setManGender(m.gender || 'Femenino'); setManAvatarFile(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resetMan = () => { setManId(null); setManPhone(''); setManUser(''); setManName(''); setManPass(''); setManAge(''); setManGender('Femenino'); setManAvatarFile(null); };
  // Deshabilitar bloquea su login y la oculta del selector de especialista
  // en el booking, sin borrar su historial de citas.
  const handleToggleManicuristActive = (m: Manicurist) => {
    const nextActive = m.isActive === false;
    if (!nextActive) {
      setConfirmModal({
        title: 'Deshabilitar Manicurista',
        message: `¿Deseas deshabilitar a ${m.name}? No podrá recibir nuevas citas en el agendamiento público, pero su historial y turnos guardados se mantendrán intactos.`,
        confirmText: 'Deshabilitar',
        isDanger: true,
        onConfirm: async () => {
          try {
            const r = await fetch(`${API}/api/admin/manicurists/${m.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ isActive: false }) });
            if (r.ok) { setSuccessMsg('Manicurista deshabilitada.'); loadData(); } else setErrorMsg('No se pudo deshabilitar.');
          } catch { setErrorMsg('Error al conectar.'); }
        }
      });
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API}/api/admin/manicurists/${m.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ isActive: true }) });
        if (r.ok) { setSuccessMsg('Manicurista reactivada.'); loadData(); } else setErrorMsg('No se pudo reactivar.');
      } catch { setErrorMsg('Error.'); }
    })();
  };

  // --- Turnos ---
  const fetchWeekSchedule = async () => {
    try {
      const res = await fetch(`${API}/api/admin/manicurist-schedule?week=${scheduleWeek}&year=${scheduleYear}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWeekSchedule(data.map((s: any) => ({ manicuristId: s.manicuristId, shiftTemplateId: s.shiftTemplateId })));
      }
    } catch { /* */ }
  };
  const handleSaveShiftTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim() || !shiftStart || !shiftEnd) return;
    setSubmitting(true);
    try {
      const url = editingShiftId ? `${API}/api/admin/shift-templates/${editingShiftId}` : `${API}/api/admin/shift-templates`;
      const res = await fetch(url, {
        method: editingShiftId ? 'PATCH' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: shiftName.trim(), startTime: shiftStart, endTime: shiftEnd }),
      });
      if (res.ok) {
        setSuccessMsg(editingShiftId ? 'Turno actualizado.' : 'Turno creado.');
        resetShiftForm();
        loadData();
      } else {
        const err = await res.json().catch(() => null);
        setErrorMsg(err?.error || 'Error.');
      }
    } catch { setErrorMsg('Error.'); }
    finally { setSubmitting(false); }
  };
  const handleDeleteShiftTemplate = (id: string) => {
    setConfirmModal({
      title: 'Eliminar Turno',
      message: '¿Eliminar este turno? Las manicuristas que lo tengan asignado quedarán sin turno esa semana.',
      confirmText: 'Eliminar Turno',
      isDanger: true,
      onConfirm: async () => {
        try {
          const r = await fetch(`${API}/api/admin/shift-templates/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (r.ok) { setSuccessMsg('Eliminado.'); loadData(); } else {
            const err = await r.json().catch(() => null);
            setErrorMsg(err?.error || 'No se pudo eliminar.');
          }
        } catch { setErrorMsg('Error.'); }
      }
    });
  };
  const editShiftTemplate = (s: { id: string; name: string; startTime: string; endTime: string }) => {
    setEditingShiftId(s.id); setShiftName(s.name); setShiftStart(s.startTime); setShiftEnd(s.endTime);
  };
  const resetShiftForm = () => { setEditingShiftId(null); setShiftName(''); setShiftStart(''); setShiftEnd(''); };
  const handleAssignShift = async (manicuristId: string, shiftTemplateId: string) => {
    try {
      const res = await fetch(`${API}/api/admin/manicurist-schedule`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ manicuristId, week: scheduleWeek, year: scheduleYear, shiftTemplateId: shiftTemplateId || null }),
      });
      if (res.ok) { setSuccessMsg('Turno asignado.'); fetchWeekSchedule(); } else setErrorMsg('No se pudo asignar.');
    } catch { setErrorMsg('Error.'); }
  };
  const changeScheduleWeek = (delta: number) => {
    let w = scheduleWeek + delta;
    let y = scheduleYear;
    if (w < 1) { w = 52; y -= 1; }
    if (w > 52) { w = 1; y += 1; }
    setScheduleWeek(w); setScheduleYear(y);
  };

  // --- Clients ---
  const viewClient = async (c: Client) => {
    setSelectedClient(c);
    try {
      const res = await fetch(`${API}/api/appointments?clientId=${c.id}`, { headers: authHeaders() });
      if (res.ok) setClientAppts(await res.json());
    } catch { setClientAppts([]); }
  };

  const handleDeleteClient = (c: Client) => {
    setConfirmModal({
      title: 'Eliminar Cliente',
      message: `¿Eliminar a ${c.name}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar Cliente',
      isDanger: true,
      onConfirm: async () => {
        try {
          const r = await fetch(`${API}/api/admin/clients/${c.id}`, { method: 'DELETE', headers: authHeaders() });
          if (r.ok) {
            setSuccessMsg('Cliente eliminado.');
            setSelectedClient(null);
            loadData();
          } else {
            const e = await r.json().catch(() => ({}));
            if (r.status === 409) {
              setConfirmModal({
                title: 'Cliente con Citas Registradas',
                message: `${e.error || 'No se puede eliminar este cliente porque tiene citas asociadas'}. El historial de citas se mantiene resguardado por seguridad.`,
                confirmText: 'Entendido',
                isDanger: false,
                onConfirm: () => {}
              });
            } else {
              setErrorMsg(e.error || 'No se pudo eliminar.');
            }
          }
        } catch { setErrorMsg('Error al conectar.'); }
      }
    });
  };

  // --- CMS ---
  const fetchCMS = async () => {
    setCmsLoading(true);
    setCmsError(false);
    try {
      const res = await fetch(`${API}/api/landing/content`);
      if (res.ok) { setCmsItems(await res.json()); } else { setCmsError(true); }
    } catch { setCmsError(true); }
    finally { setCmsLoading(false); }
  };
  const handleDeleteCMS = (id: string) => {
    setConfirmModal({
      title: 'Quitar Anuncio',
      message: '¿Seguro que deseas quitar este anuncio del carrusel de la página principal?',
      confirmText: 'Quitar Anuncio',
      isDanger: true,
      onConfirm: async () => {
        try {
          const r = await fetch(`${API}/api/admin/landing-cms/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (r.ok) { setSuccessMsg('Eliminado.'); fetchCMS(); } else setErrorMsg('No se pudo eliminar.');
        } catch { setErrorMsg('Error.'); }
      }
    });
  };
  const handleToggleCmsActive = async (item: any) => {
    try {
      const nextActive = item.isActive === false;
      const payload = {
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        isActive: nextActive
      };
      const r = await fetch(`${API}/api/admin/landing-cms`, { method: 'POST', headers: authHeaders(), body: JSON.stringify([payload]) });
      if (r.ok) {
        setSuccessMsg(nextActive ? 'Anuncio reactivado.' : 'Anuncio deshabilitado.');
        fetchCMS();
      } else setErrorMsg('No se pudo cambiar el estado del anuncio.');
    } catch { setErrorMsg('Error al cambiar el estado del anuncio.'); }
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
  const filterApps = () => {
    const now = new Date();
    const todayStr = toLocalDateKey(now);
    const tomorrowStr = toLocalDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    return appointments
      .filter(a => `${a.clientName || a.client?.name || ''} ${getManName(a.manicuristId)}`.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(a => {
        if (apptDateFilter === 'all') return true;
        const apptDay = toDateLabel(a.date);
        return apptDateFilter === 'today' ? apptDay === todayStr : apptDay === tomorrowStr;
      })
      .filter(a => apptManicuristFilter === 'all' || String(a.manicuristId) === apptManicuristFilter)
      .filter(a => apptStatusFilter === 'all' || a.status === apptStatusFilter);
  };
  const filterClients = () => clients.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const filterOffers = () => offers.filter(o => `${o.title} ${o.code}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const getManName = (id: string | number) => manicurists.find(m => String(m.id) === String(id))?.name || '—';
  const svcNames = (ss: ServiceItem[]) => ss.map(s => s.name).join(', ') || '—';
  const clear = () => { setSuccessMsg(null); setErrorMsg(null); setSearchQuery(''); setCurrentPage(1); };
  const filteredApps = useMemo(() => filterApps(), [appointments, searchQuery, apptDateFilter, apptManicuristFilter, apptStatusFilter, manicurists]);

  // Si un filtro (o un cambio de datos, ej. una cita cancelada en otra pestana)
  // reduce la lista visible y `currentPage` queda apuntando a una pagina que ya
  // no existe, la tabla se veria vacia sin explicacion hasta que alguien haga
  // click en "Anterior". Clampeamos apenas eso pasa, para cualquier pestana.
  useEffect(() => {
    let total: number;
    if (activeTab === 'appointments') total = filteredApps.length;
    else if (activeTab === 'clients') total = filterClients().length;
    else if (activeTab === 'offers') total = filterOffers().length;
    else if (activeTab === 'manicurists') {
      total = manicurists.filter(m => (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (m.username || '').toLowerCase().includes(searchQuery.toLowerCase())).length;
    } else if (activeTab === 'services') {
      total = servicesCatalog.filter(s => (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.category || '').toLowerCase().includes(searchQuery.toLowerCase())).length;
    } else {
      return;
    }
    const maxPage = Math.max(1, Math.ceil(total / itemsPerPage));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [activeTab, filteredApps, clients, offers, manicurists, servicesCatalog, searchQuery, currentPage]);
  const priceFmt = (p: any) => typeof p === 'number' ? `$${p.toLocaleString('es-CO')}` : `$${p}`;

  if (loading) return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center"><span className="serif-title text-2xl text-[#3B0019] animate-pulse">Cargando...</span></div>;
  if (unauthorized) return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
      <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-8 max-w-sm w-full space-y-5 text-center shadow-lg">
        <div className="flex flex-col items-center gap-2">
          <img src="/logo.png" alt="WineSpa Logo" className="w-12 h-12 object-contain" />
          <span className="serif-title text-2xl text-[#3B0019] leading-none">WineSpa Admin</span>
          <p className="text-xs text-[#78716C]">Inicia sesion para acceder al panel</p>
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
    { id: 'schedule', label: 'Turnos' },
    { id: 'clients', label: 'Base de Clientes' },
    { id: 'services', label: 'Servicios' },
    { id: 'offers', label: 'Descuentos' },
    { id: 'news', label: 'CMS / Landing' },
    { id: 'chats', label: 'Chats' },
    { id: 'whatsapp_config', label: 'WhatsApp' },
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
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="WineSpa Logo" className="w-6 h-6 object-contain" />
          <span className="serif-title text-xl text-[#3B0019] leading-none">WineSpa Admin</span>
        </div>
        <button onClick={() => { const next = !isMobileMenuOpen; setIsMobileMenuOpen(next); if (next) window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-xs font-semibold text-[#8E1B54]">{isMobileMenuOpen ? 'Cerrar' : 'Menu'}</button>
      </header>

      <aside className={`w-full md:w-56 bg-[#5C0632]/5 border-r border-[#EADEC9]/35 p-5 md:sticky md:top-0 md:h-screen shrink-0 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
        <div className="hidden md:block mb-6 text-left">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="WineSpa Logo" className="w-8 h-8 object-contain" />
            <div className="flex flex-col">
              <span className="serif-title text-xl text-[#3B0019] leading-none">WineSpa</span>
              <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-semibold">Panel Admin</span>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); clear(); }}
                className={`relative isolate px-4 py-3 rounded-xl text-xs font-semibold text-left transition-colors duration-250 cursor-pointer ${
                  isActive ? 'text-white' : 'text-[#78716C] hover:text-[#5C0632]'
                }`}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="adminActiveTabBg"
                    className="absolute inset-0 bg-[#5C0632] rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {t.label}
              </motion.button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        {successMsg && <div className="mb-3 p-2.5 bg-green-50 text-green-700 text-xs rounded-xl border border-green-200">{successMsg}</div>}
        {errorMsg && <div className="mb-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{errorMsg}</div>}
        {loadError && (
          <div className="mb-3 p-2.5 bg-amber-50 text-amber-700 text-xs rounded-xl border border-amber-200 flex items-center justify-between gap-3">
            <span>No se pudo cargar toda la informacion (puede faltar datos en este panel).</span>
            <button onClick={loadData} className="underline font-semibold shrink-0">Reintentar</button>
          </div>
        )}

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8"
        >

        {/* METRICS */}
        {activeTab === 'metrics' && stats && (() => {
          const statusColors: Record<string, string> = {
            PENDING: '#A68F63',
            IN_PROGRESS: '#8E1B54',
            COMPLETED: '#10B981',
            CANCELLED: '#EF4444',
          };
          const statusData = (stats.appointmentsByStatus || []).filter(s => s.count > 0);
          const totalCount = statusData.reduce((sum, s) => sum + s.count, 0) || 1;
          
          // r=50 en el <circle> de abajo -- circunferencia exacta, no el
          // literal "314.16" (aproximacion a 2 decimales de 2*pi*50) usado
          // antes en tres lugares distintos que tenian que coincidir.
          const DONUT_CIRCUMFERENCE = 2 * Math.PI * 50;
          let accumulatedLength = 0;
          const donutSegments = statusData.map(s => {
            const percent = s.count / totalCount;
            const strokeDash = percent * DONUT_CIRCUMFERENCE;
            const strokeOffset = -accumulatedLength;
            accumulatedLength += strokeDash;
            return {
              ...s,
              percent: Math.round(percent * 100),
              color: statusColors[s.status] || '#78716C',
              strokeDash,
              strokeOffset
            };
          });

          const getDailyMetrics = () => {
            // Aritmetica en milisegundos, no con setDate/getDate locales -- esos
            // mutan segun el calendario del navegador, que puede no coincidir con
            // Colombia. toLocalDateKey ya hace la conversion de zona una sola vez.
            const dates = Array.from({ length: 7 }, (_, i) => {
              const offsetDays = i - 6 + metricsOffsetDays;
              return toLocalDateKey(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
            });

            const dailyData = dates.reduce((acc, dateStr) => {
              acc[dateStr] = { earnings: 0, appointments: 0 };
              return acc;
            }, {} as Record<string, { earnings: number; appointments: number }>);

            appointments.forEach(a => {
              try {
                // toDateLabel (slice directo), no new Date(...).toISOString() --
                // mismo criterio que las llaves de `dates` arriba (toLocalDateKey),
                // en vez de dos formas distintas de llegar (con suerte) al mismo valor.
                const dateStr = toDateLabel(a.date);
                if (dateStr in dailyData) {
                  dailyData[dateStr].appointments += 1;
                  if (a.status === 'COMPLETED' || a.status === 'IN_PROGRESS') {
                    dailyData[dateStr].earnings += Number(a.totalPrice || 0);
                  }
                }
              } catch { /* fecha invalida: se ignora esa cita */ }
            });

            return dates.map(dateStr => {
              const dateObj = new Date(dateStr + 'T00:00:00');
              const label = dateObj.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
              return {
                date: dateStr,
                label: label.charAt(0).toUpperCase() + label.slice(1),
                earnings: dailyData[dateStr].earnings,
                appointments: dailyData[dateStr].appointments,
              };
            });
          };

          const dailyMetrics = getDailyMetrics();
          const isEarnings = metricsType === 'earnings';
          const maxVal = Math.max(
            ...dailyMetrics.map(d => isEarnings ? d.earnings : d.appointments),
            1
          );

          return (
            <div className="space-y-8 animate-fade-in text-left">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#EADEC9]/30 pb-4">
                <div>
                  <h2 className="serif-title text-3xl text-[#3B0019]">Panel de Métricas</h2>
                  <p className="text-xs text-[#78716C] mt-1">Monitoreo estratégico y rendimiento financiero en tiempo real.</p>
                </div>
              </div>

              {appointmentsTruncated && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Hay más de 1000 citas registradas -- estas métricas solo reflejan las primeras 1000.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl shadow-xs relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8E1B54]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase text-[#A68F63] font-extrabold tracking-wider block">Ingresos</span>
                      <h3 className="serif-title text-3xl text-[#3B0019] mt-1.5 font-bold">${stats.totalEarnings.toLocaleString('es-CO')}</h3>
                      <span className="text-[10px] text-emerald-600 font-semibold block mt-1">✓ Completado & En Progreso</span>
                    </div>
                    <div className="w-10 h-10 bg-[#8E1B54]/5 rounded-xl flex items-center justify-center text-[#8E1B54] group-hover:bg-[#8E1B54]/10 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl shadow-xs relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#A68F63]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase text-[#A68F63] font-extrabold tracking-wider block">Citas Registradas</span>
                      <h3 className="serif-title text-3xl text-[#3B0019] mt-1.5 font-bold">{stats.totalAppointments}</h3>
                      <span className="text-[10px] text-[#78716C] block mt-1">Volumen total histórico</span>
                    </div>
                    <div className="w-10 h-10 bg-[#A68F63]/5 rounded-xl flex items-center justify-center text-[#A68F63] group-hover:bg-[#A68F63]/10 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl shadow-xs relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase text-[#A68F63] font-extrabold tracking-wider block">Top Especialista</span>
                      <h3 className="serif-title text-xl text-[#8E1B54] mt-2 font-bold truncate max-w-[160px]">{stats.topManicurist}</h3>
                      <span className="text-[10px] text-amber-600 font-semibold block mt-1">★ Mayor número de completadas</span>
                    </div>
                    <div className="w-10 h-10 bg-amber-500/5 rounded-xl flex items-center justify-center text-amber-500 group-hover:bg-amber-500/10 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl shadow-xs lg:col-span-2 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-[#EADEC9]/25 pb-3">
                    <div className="text-left w-full sm:w-auto">
                      <h3 className="serif-title text-base font-bold text-[#3B0019]">Estadísticas Diarias</h3>
                      <p className="text-[10px] text-[#78716C] mt-0.5">Métricas de rendimiento por fecha de cita.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
                      {/* Toggle Metricas */}
                      <div className="flex bg-[#F7F3EB] rounded-lg p-0.5 text-[11px] font-bold border border-[#EADEC9]/40">
                        <button
                          onClick={() => { setMetricsType('earnings'); setAnimateBars(false); setTimeout(() => setAnimateBars(true), 150); }}
                          className={`px-3 py-1 rounded-md transition-colors ${isEarnings ? 'bg-white text-[#8E1B54] shadow-xs' : 'text-[#78716C] hover:text-[#3B0019]'}`}
                        >
                          Ingresos ($)
                        </button>
                        <button
                          onClick={() => { setMetricsType('appointments'); setAnimateBars(false); setTimeout(() => setAnimateBars(true), 150); }}
                          className={`px-3 py-1 rounded-md transition-colors ${!isEarnings ? 'bg-white text-[#8E1B54] shadow-xs' : 'text-[#78716C] hover:text-[#3B0019]'}`}
                        >
                          Citas (Cant.)
                        </button>
                      </div>

                      {/* Date Navigation */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setMetricsOffsetDays(0); setAnimateBars(false); setTimeout(() => setAnimateBars(true), 150); }}
                          className="px-3.5 py-2 border border-[#EADEC9]/60 rounded-xl text-xs font-semibold text-[#8E1B54] bg-[#F7F3EB] hover:bg-[#8E1B54]/5 active:scale-95 transition-all animate-fade-in"
                        >
                          Semana Actual
                        </button>
                        <div className="flex items-center bg-white border border-[#EADEC9]/60 rounded-xl overflow-hidden shadow-xs">
                          <button
                            onClick={() => { setMetricsOffsetDays(prev => prev - 7); setAnimateBars(false); setTimeout(() => setAnimateBars(true), 150); }}
                            className="w-8 h-8 flex items-center justify-center text-[#A68F63] hover:bg-[#5C0632]/5 active:scale-95 transition-all text-base font-bold border-r border-[#EADEC9]/30"
                            title="Anterior"
                          >
                            ‹
                          </button>
                          <button
                            onClick={() => { setMetricsOffsetDays(prev => prev + 7); setAnimateBars(false); setTimeout(() => setAnimateBars(true), 150); }}
                            className="w-8 h-8 flex items-center justify-center text-[#A68F63] hover:bg-[#5C0632]/5 active:scale-95 transition-all text-base font-bold"
                            title="Siguiente"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-visible py-4 pr-2">
                    <svg viewBox="0 0 500 180" className="w-full h-auto overflow-visible">
                      <line x1="30" y1="30" x2="470" y2="30" stroke="#EADEC9" strokeWidth="0.5" strokeDasharray="4 4" />
                      <line x1="30" y1="80" x2="470" y2="80" stroke="#EADEC9" strokeWidth="0.5" strokeDasharray="4 4" />
                      <line x1="30" y1="130" x2="470" y2="130" stroke="#EADEC9" strokeWidth="1" />

                      {dailyMetrics.map((d, index) => {
                        const val = isEarnings ? d.earnings : d.appointments;
                        const heightVal = (val / maxVal) * 90;
                        const x = index * 60 + 45;
                        return (
                          <g key={index} className="group/bar">
                            <rect
                              x={x}
                              width="24"
                              rx="4"
                              ry="4"
                              fill="#8E1B54"
                              className="transition-all duration-700 ease-out hover:fill-[#5C0632] cursor-pointer"
                              style={{
                                y: `${130 - (animateBars ? heightVal : 0)}px`,
                                height: `${animateBars ? heightVal : 0}px`
                              }}
                            />
                            <text
                              x={x + 12}
                              y={130 - (animateBars ? heightVal : 0) - 8}
                              textAnchor="middle"
                              className="text-[10px] sm:text-[9px] font-extrabold fill-[#8E1B54]"
                            >
                              {val > 0 ? (isEarnings ? `$${val.toLocaleString('es-CO')}` : val) : ''}
                            </text>
                            <text
                              x={x + 12}
                              y="152"
                              textAnchor="middle"
                              className="text-[12px] sm:text-[10px] font-bold fill-[#78716C]"
                            >
                              {d.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
                  <h3 className="serif-title text-base font-bold text-[#3B0019] border-b border-[#EADEC9]/25 pb-2">Distribución por Estado</h3>
                  
                  {statusData.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-xs text-[#78716C]">Sin datos de estado.</div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 lg:flex-col xl:flex-row py-2">
                      <div className="relative w-32 h-32 flex-shrink-0">
                        <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
                          <circle cx="80" cy="80" r="50" fill="transparent" stroke="#F5EFE6" strokeWidth="12" />
                          {donutSegments.map((s, idx) => (
                            <circle
                              key={idx}
                              cx="80"
                              cy="80"
                              r="50"
                              fill="transparent"
                              stroke={s.color}
                              strokeWidth="12"
                              strokeDasharray={`${s.strokeDash} ${DONUT_CIRCUMFERENCE}`}
                              strokeDashoffset={s.strokeOffset}
                              className="transition-all duration-300"
                            />
                          ))}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="serif-title text-2xl font-black text-[#3B0019] leading-none">{stats.totalAppointments}</span>
                          <span className="text-[8px] uppercase tracking-widest text-[#A68F63] font-bold mt-1">Citas</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left w-full">
                        {donutSegments.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[10px] border-b border-[#EADEC9]/10 pb-1 last:border-0">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                              <span className="text-[#44403C] font-medium">{STATUS_LABELS[s.status] || s.status}</span>
                            </div>
                            <span className="font-bold text-[#8E1B54]">{s.count} ({s.percent}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Specialist Performance */}
              <div className="bg-white border border-[#EADEC9]/40 p-6 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#EADEC9]/25 pb-2">
                  <h3 className="serif-title text-base font-bold text-[#3B0019]">Rendimiento por Especialista</h3>
                  <span className="text-[10px] text-[#A68F63] font-bold">Citas Completadas</span>
                </div>
                {stats.manicuristPerformance.length === 0 ? (
                  <p className="text-xs text-[#78716C] py-4 text-center">Sin datos de rendimiento.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.manicuristPerformance.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#F7F3EB]/25 hover:bg-[#F7F3EB]/50 border border-[#EADEC9]/20 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${i === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-[#EADEC9]/30 text-[#78716C]'}`}>
                            {i === 0 ? '★' : i + 1}
                          </span>
                          <span className="font-semibold text-xs text-[#44403C]">{p.name}</span>
                        </div>
                        <span className="text-xs font-bold text-[#8E1B54]">{p.completedAppointments} completadas</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-6 animate-fade-in text-left">
            <h2 className="serif-title text-3xl text-[#3B0019]">Pizarra de Citas</h2>
            {appointmentsTruncated && (
              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Hay más de 1000 citas registradas -- esta lista solo muestra las primeras 1000. Usá los filtros de fecha para acotar la búsqueda.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {([['all', 'Todas'], ['today', 'Hoy'], ['tomorrow', 'Mañana']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { setApptDateFilter(value); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${apptDateFilter === value ? 'bg-[#5C0632] text-white border-[#5C0632]' : 'bg-white text-[#78716C] border-[#EADEC9]/60 hover:border-[#8E1B54]/40'}`}
                >
                  {label}
                </button>
              ))}
              <select
                value={apptManicuristFilter}
                onChange={e => { setApptManicuristFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#EADEC9]/60 bg-white text-[#78716C]"
              >
                <option value="all">Todas las manicuristas</option>
                {manicurists.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
              </select>
              <select
                value={apptStatusFilter}
                onChange={e => { setApptStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#EADEC9]/60 bg-white text-[#78716C]"
              >
                <option value="all">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
              <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs w-full sm:w-64" />
              {pagination(filteredApps.length)}
            </div>
            {/* Desktop: tabla normal */}
            <div className="hidden md:block bg-white border border-[#EADEC9]/40 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="bg-[#5C0632]/5 text-[10px] uppercase text-[#8D774C] font-semibold"><th className="p-3">#</th><th className="p-3">Cliente</th><th className="p-3">Especialista</th><th className="p-3">Servicios</th><th className="p-3">Fecha</th><th className="p-3">Total</th><th className="p-3">Estado</th><th className="p-3">Accion</th></tr></thead>
                <tbody className="divide-y divide-[#EADEC9]/20">
                  {filteredApps.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-[#78716C]">Sin citas.</td></tr> :
                    paginate(filteredApps).map(a => (
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
              {filteredApps.length === 0 ? <p className="text-xs text-center py-8 text-[#78716C]">Sin citas.</p> :
                paginate(filteredApps).map(a => (
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
            <h2 className="serif-title text-3xl text-[#3B0019]">Vista de Calendario</h2>
            <div className="md:grid md:grid-cols-12 md:gap-8">
              <div className="md:col-span-5">
                <DatePicker
                  selectedDate={calendarDate}
                  onSelectDate={setCalendarDate}
                  markedDates={new Set(appointments.map(a => (a.date || '').slice(0, 10)))}
                  todayKey={toLocalDateKey(new Date())}
                  allowPast
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
                    <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Telefono</label><input type="tel" inputMode="numeric" required maxLength={10} value={manPhone} onChange={e => setManPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} className="w-full p-2 border rounded-lg text-xs" /></div>
                    <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Usuario</label><input type="text" required maxLength={30} value={manUser} onChange={e => setManUser(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  </div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Nombre Completo</label><input type="text" required maxLength={60} value={manName} onChange={e => setManName(e.target.value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, ''))} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Contrasena {manId && '(dejar vacio = no cambiar)'}</label><input type="password" maxLength={64} required={!manId} value={manPass} onChange={e => setManPass(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Edad</label><input type="number" min={0} max={100} value={manAge} onChange={e => setManAge(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
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

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
              <input type="text" placeholder="Buscar manicurista..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs w-full sm:w-64" />
              {(() => {
                const filtered = manicurists.filter(m => (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (m.username || '').toLowerCase().includes(searchQuery.toLowerCase()));
                return pagination(filtered.length);
              })()}
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
                      <div key={m.id} className={`border p-4 rounded-2xl space-y-3 transition-all ${m.isActive === false ? 'bg-stone-50/70 border-stone-200 opacity-75' : 'bg-white border-[#EADEC9]/40'}`}>
                        <div className="flex items-center gap-3">
                          {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover border" /> : <FallbackAvatar className="w-10 h-10" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-semibold text-sm text-[#3B0019] truncate">{m.name}</h4>
                              {m.isActive === false && <span className="text-[9px] px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded-full font-bold shrink-0">DESHABILITADA</span>}
                            </div>
                            <p className="text-[11px] text-[#78716C]">@{m.username} {m.age ? `· ${m.age} años` : ''}</p>
                          </div>
                        </div>
                        {m.schedules && m.schedules.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-2 border-t border-[#EADEC9]/10">
                            {m.schedules.map((sch, i) => <span key={i} className="px-2 py-0.5 rounded bg-[#F7F3EB] text-[#8D774C] text-[10px] font-semibold">{sch.shiftTemplate?.name} ({sch.shiftTemplate?.startTime}-{sch.shiftTemplate?.endTime})</span>)}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => { editMan(m); setShowManForm(true); }} className="flex-1 py-1.5 border border-[#EADEC9] rounded-lg text-[10px] text-[#A68F63] font-semibold hover:bg-[#5C0632]/5">Editar</button>
                          <button
                            onClick={() => handleToggleManicuristActive(m)}
                            className={`flex-1 py-1.5 border rounded-lg text-[10px] font-bold transition-colors ${
                              m.isActive === false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                : 'border-[#EADEC9] text-amber-600 font-semibold hover:bg-amber-50'
                            }`}
                          >
                            {m.isActive === false ? '✓ Reactivar' : 'Deshabilitar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* SCHEDULE / TURNOS */}
        {activeTab === 'schedule' && (
          <div className="space-y-6 animate-fade-in text-left">
            <h2 className="serif-title text-3xl text-[#3B0019]">Turnos</h2>

            {/* Plantillas de turno */}
            <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#3B0019] uppercase">{editingShiftId ? 'Editar turno' : 'Nuevo turno'}</h3>
              <form onSubmit={handleSaveShiftTemplate} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase text-[#A68F63] font-bold block">Nombre</label>
                  <input type="text" required placeholder="Ej: Turno Manana" value={shiftName} onChange={e => setShiftName(e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#A68F63] font-bold block">Desde</label>
                  <input type="time" required value={shiftStart} onChange={e => setShiftStart(e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#A68F63] font-bold block">Hasta</label>
                  <input type="time" required value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                </div>
                <div className="sm:col-span-4 flex gap-2">
                  <button type="submit" disabled={submitting} className="flex-1 py-2 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{editingShiftId ? 'Actualizar' : 'Crear turno'}</button>
                  {editingShiftId && <button type="button" onClick={resetShiftForm} className="px-4 py-2 border rounded-xl text-xs">Cancelar</button>}
                </div>
              </form>
              {shiftTemplates.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-[#EADEC9]/20">
                  {shiftTemplates.map(s => (
                    <div key={s.id} className="flex justify-between items-center text-xs py-1.5 px-2 rounded-lg bg-[#F7F3EB]/50">
                      <span className="font-medium text-[#44403C]">{s.name} <span className="text-[#A68F63]">({s.startTime}-{s.endTime})</span></span>
                      <div className="flex gap-2">
                        <button onClick={() => editShiftTemplate(s)} className="text-[#A68F63] font-semibold">Editar</button>
                        <button onClick={() => handleDeleteShiftTemplate(s.id)} className="text-red-400 font-semibold">Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {shiftTemplates.length === 0 && <p className="text-[10px] text-[#78716C]">Todavia no hay turnos creados.</p>}
            </div>

            {/* Asignacion semanal */}
            <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#3B0019] uppercase">Asignar por semana</h3>
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={() => changeScheduleWeek(-1)} className="w-7 h-7 border rounded-full text-[#A68F63]">‹</button>
                  <span className="text-center">
                    <span className="block font-semibold text-[#3B0019]">{formatWeekRange(scheduleWeek, scheduleYear)}</span>
                    <span className="block text-[9px] text-[#A68F63] uppercase tracking-wide">Semana {scheduleWeek}</span>
                  </span>
                  <button onClick={() => changeScheduleWeek(1)} className="w-7 h-7 border rounded-full text-[#A68F63]">›</button>
                </div>
              </div>
              {shiftTemplates.length === 0 ? (
                <p className="text-[10px] text-[#78716C]">Cre&aacute; al menos un turno arriba para poder asignarlo.</p>
              ) : (
                <div className="space-y-2">
                  {manicurists.map(m => {
                    const assigned = weekSchedule.find(w => w.manicuristId === String(m.id));
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#F7F3EB]/30">
                        <span className="text-xs font-semibold text-[#44403C]">{m.name}</span>
                        <select
                          value={assigned?.shiftTemplateId || ''}
                          onChange={e => handleAssignShift(String(m.id), e.target.value)}
                          className="p-1.5 border rounded-lg text-xs bg-white"
                        >
                          <option value="">Sin turno</option>
                          {shiftTemplates.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
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
                      <span>{c.age ? `${c.age} años` : '—'} · {c.gender || '—'}</span>
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
                  <p className="text-xs text-[#78716C]">{selectedClient.age || '—'} años · {selectedClient.gender || '—'}</p>
                  {clientAppts.length === 0 && (
                    <button onClick={() => handleDeleteClient(selectedClient)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">Eliminar cliente</button>
                  )}
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
                <button
                  onClick={() => { setShowSvcForm(!showSvcForm); if (!showSvcForm) resetSvc(); }}
                  className="px-3 py-2 bg-[#8E1B54] text-white rounded-xl text-[10px] font-semibold hover:bg-[#3B0019] transition-colors"
                >
                  {showSvcForm ? 'Cancelar' : '+ Nuevo Servicio'}
                </button>
                <button onClick={() => setShowCategoriesPanel(!showCategoriesPanel)} className="px-3 py-2 border border-[#EADEC9] rounded-xl text-[10px] text-[#A68F63] font-semibold hover:bg-[#5C0632]/5 bg-white">
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
            {showSvcForm && (
              <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-3 shadow-xs animate-fade-in">
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
                    <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Duracion (min)</label><input type="number" required min={1} value={svcDuration} onChange={e => setSvcDuration(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  </div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Precio ($)</label><input type="number" required min={0} value={svcPrice} onChange={e => setSvcPrice(e.target.value)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <div><label className="text-[10px] uppercase text-[#A68F63] font-bold block">Imagen {svcId && '(opcional)'}</label><input type="file" accept="image/*" onChange={e => setSvcImageFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded-lg text-xs" /></div>
                  <label className="flex items-center gap-2 text-[11px] text-[#44403C] cursor-pointer">
                    <input type="checkbox" checked={svcTrending} onChange={e => setSvcTrending(e.target.checked)} className="rounded" />
                    Servicio en tendencia (aparece primero en el catalogo)
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">{svcId ? 'Actualizar' : 'Crear'}</button>
                  {<button type="button" onClick={() => { resetSvc(); setShowSvcForm(false); }} className="px-4 py-2.5 border rounded-xl text-xs">Cancelar</button>}
                  </div>
                </form>
              </div>
            )}

            {/* Service List */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white border border-[#EADEC9]/30 p-4 rounded-xl">
                <input type="text" placeholder="Buscar servicio..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-lg text-xs w-full sm:w-64" />
                {(() => {
                  const sorted = [...servicesCatalog]
                    .sort((a, b) => {
                      if (a.trending && !b.trending) return -1;
                      if (!a.trending && b.trending) return 1;
                      return (a.name || '').localeCompare(b.name || '');
                    })
                    .filter(s => (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.category || '').toLowerCase().includes(searchQuery.toLowerCase()));
                  return pagination(sorted.length);
                })()}
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
                        <div key={s.id} className={`p-3 rounded-xl border flex justify-between items-center text-xs transition-all ${s.isActive === false ? 'bg-stone-50/70 border-stone-200 opacity-75' : 'bg-white border-[#EADEC9]/30'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {s.trending && <span className="text-[9px] px-1.5 py-0.5 bg-[#8E1B54] text-white rounded-full font-bold">TOP</span>}
                              {s.isActive === false && <span className="text-[9px] px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded-full font-bold">DESHABILITADO</span>}
                              <span className="font-semibold text-sm text-[#3B0019] truncate">{s.name}</span>
                            </div>
                            <div className="flex gap-2 mt-0.5">
                              {s.category && <span className="text-[10px] bg-[#F7F3EB] px-1.5 py-0.5 rounded text-[#A68F63]">{s.category}</span>}
                              <span className="text-[10px] text-[#78716C]">{s.durationInMinutes || '?'} min</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-sm text-[#8E1B54]">{priceFmt(s.price)}</span>
                            <button onClick={() => { editSvc(s); setShowSvcForm(true); }} className="text-[10px] text-[#A68F63] hover:text-[#5C0632] font-semibold">Editar</button>
                            <button
                              onClick={() => handleToggleServiceActive(s)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                                s.isActive === false
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                  : 'text-amber-600 hover:text-amber-700 font-semibold'
                              }`}
                            >
                              {s.isActive === false ? '✓ Reactivar' : 'Deshabilitar'}
                            </button>
                            <button onClick={() => handleDeleteService(s.id)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">Eliminar</button>
                          </div>
                        </div>
                      ))}
                    </div>
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
                        <button
                          onClick={() => handleToggleOffer(o)}
                          className={`px-2.5 py-1 text-[9px] rounded-lg font-bold transition-colors ${
                            o.isActive
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          {o.isActive ? 'Desactivar' : '✓ Reactivar'}
                        </button>
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

            {/* HERO & EXPERIENCE EDITORS */}
            <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-[#3B0019] uppercase">Imágenes de la Página Principal</h3>
              {cmsError && (
                <div className="p-2.5 bg-amber-50 text-amber-700 text-[11px] rounded-xl border border-amber-200 flex items-center justify-between gap-3">
                  <span>No se pudo cargar el contenido actual -- subir una imagen ahora podria crear un registro duplicado en vez de actualizar el existente.</span>
                  <button onClick={fetchCMS} className="underline font-semibold shrink-0">Reintentar</button>
                </div>
              )}

              {/* HERO IMAGE EDITOR */}
              <div className="border-b border-[#EADEC9]/25 pb-4 space-y-2">
                <p className="text-xs font-semibold text-[#44403C]">Imagen del Banner Principal (Hero)</p>
                {(() => {
                  const heroItem = cmsItems.find((item: any) => item.type === 'HERO');
                  return (
                    <div className="flex items-center gap-4">
                      <img
                        src={heroItem?.imageUrl?.startsWith('/uploads') ? `${API}${heroItem.imageUrl}` : (heroItem?.imageUrl || '/hero_1.jpg')}
                        alt="Hero preview"
                        className="w-20 h-16 rounded-lg object-cover border shrink-0"
                      />
                      <div className="space-y-1">
                        <input
                          type="file"
                          accept="image/*"
                          disabled={cmsLoading || cmsError || submitting}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setSubmitting(true);
                            try {
                              const fd = new FormData();
                              fd.append('image', file);
                              const uRes = await fetch(`${API}/api/admin/landing/upload`, { method: 'POST', headers: authHeadersNoJson(), body: fd });
                              if (!uRes.ok) throw new Error();
                              const data = await uRes.json();

                              const payload = {
                                id: heroItem?.id || null,
                                type: 'HERO',
                                title: 'Hero Image',
                                imageUrl: data.imageUrl,
                                isActive: true
                              };
                              const r = await fetch(`${API}/api/admin/landing-cms`, { method: 'POST', headers: authHeaders(), body: JSON.stringify([payload]) });
                              if (r.ok) {
                                setSuccessMsg('Imagen del Hero actualizada.');
                                fetchCMS();
                              } else throw new Error();
                            } catch {
                              setErrorMsg('Error al actualizar imagen del Hero.');
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                          className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-[#5C0632]/10 file:text-[#5C0632] hover:file:bg-[#5C0632]/20"
                        />
                        <p className="text-[9px] text-[#78716C]">Sube un archivo para cambiar la imagen principal (se recomienda horizontal/cuadrada).</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* EXPERIENCE IMAGE EDITOR */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#44403C]">Imagen de Sección "La Experiencia"</p>
                {(() => {
                  const expItem = cmsItems.find((item: any) => item.type === 'EXPERIENCE');
                  return (
                    <div className="flex items-center gap-4">
                      <img
                        src={expItem?.imageUrl?.startsWith('/uploads') ? `${API}${expItem.imageUrl}` : (expItem?.imageUrl || '/winespa_interior_1.jpg')}
                        alt="Experience preview"
                        className="w-20 h-16 rounded-lg object-cover border shrink-0"
                      />
                      <div className="space-y-1">
                        <input
                          type="file"
                          accept="image/*"
                          disabled={cmsLoading || cmsError || submitting}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setSubmitting(true);
                            try {
                              const fd = new FormData();
                              fd.append('image', file);
                              const uRes = await fetch(`${API}/api/admin/landing/upload`, { method: 'POST', headers: authHeadersNoJson(), body: fd });
                              if (!uRes.ok) throw new Error();
                              const data = await uRes.json();

                              const payload = {
                                id: expItem?.id || null,
                                type: 'EXPERIENCE',
                                title: 'Experience Image',
                                imageUrl: data.imageUrl,
                                isActive: true
                              };
                              const r = await fetch(`${API}/api/admin/landing-cms`, { method: 'POST', headers: authHeaders(), body: JSON.stringify([payload]) });
                              if (r.ok) {
                                setSuccessMsg('Imagen de La Experiencia actualizada.');
                                fetchCMS();
                              } else throw new Error();
                            } catch {
                              setErrorMsg('Error al actualizar imagen de La Experiencia.');
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                          className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-[#5C0632]/10 file:text-[#5C0632] hover:file:bg-[#5C0632]/20"
                        />
                        <p className="text-[9px] text-[#78716C]">Sube un archivo para cambiar la imagen de "La Experiencia" (se recomienda relación de aspecto 4:3 o 16:9).</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Lista de anuncios existentes */}
            {!cmsLoading && !cmsError && cmsItems.filter((item: any) => item.type === 'CAROUSEL').length === 0 && (
              <div className="p-3 bg-[#EADEC9]/20 border border-[#EADEC9]/50 rounded-xl text-[11px] text-[#78716C]">
                Todavía no publicaste ningún anuncio. Mientras tanto, el sitio muestra un carrusel de ejemplo (no editable, no viene de aquí) -- publica uno abajo para reemplazarlo.
              </div>
            )}
            {cmsItems.filter((item: any) => item.type === 'CAROUSEL').length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#3B0019] uppercase">Anuncios publicados ({cmsItems.filter((item: any) => item.type === 'CAROUSEL').length})</h3>
                <div className="space-y-2">
                  {cmsItems.filter((item: any) => item.type === 'CAROUSEL').map((item: any) => (
                    <div key={item.id} className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${item.isActive === false ? 'bg-stone-50/70 border-stone-200 opacity-75' : 'bg-white border-[#EADEC9]/40'}`}>
                      <img src={item.imageUrl?.startsWith('/uploads') ? `${API}${item.imageUrl}` : item.imageUrl} alt={item.title} className="w-14 h-14 rounded-lg object-cover border shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-[#44403C] truncate">{item.title || 'Sin titulo'}</p>
                          {item.isActive === false && <span className="text-[9px] px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded-full font-bold shrink-0">DESHABILITADO</span>}
                        </div>
                        <p className="text-[9px] text-[#78716C] truncate">{item.description || 'Sin descripcion'}</p>
                        <span className="text-[8px] text-[#A68F63] uppercase">{item.type} {item.isActive !== false ? '· Activo' : '· Inactivo'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => editCms(item)} className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold">Editar</button>
                        <button
                          onClick={() => handleToggleCmsActive(item)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                            item.isActive === false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'text-amber-600 hover:text-amber-700 font-semibold'
                          }`}
                        >
                          {item.isActive === false ? '✓ Reactivar' : 'Deshabilitar'}
                        </button>
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

        {/* CHATS */}
        {activeTab === 'chats' && <WhatsAppChat />}
        {activeTab === 'whatsapp_config' && <WhatsAppConfig />}
        </motion.div>
      </main>

      {/* POP-UP ELEGANTE DE CONFIRMACION Y AUDITORIA */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-[#FDFBF7] border border-[#EADEC9] rounded-3xl p-6 shadow-2xl max-w-md w-full text-left space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="serif-title text-xl text-[#3B0019] font-medium">{confirmModal.title}</h3>
              <button type="button" onClick={() => setConfirmModal(null)} className="w-7 h-7 bg-neutral-200/50 rounded-full text-xs flex items-center justify-center text-[#78716C]">✕</button>
            </div>
            <p className="text-xs text-[#57534E] leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-[#EADEC9] rounded-xl text-xs text-[#78716C] font-semibold hover:bg-neutral-100 transition-colors"
              >
                {confirmModal.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(null);
                  action();
                }}
                className={`px-5 py-2 rounded-xl text-xs text-white font-semibold shadow-sm transition-all ${
                  confirmModal.isDanger
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-[#8E1B54] hover:bg-[#5C0632]'
                }`}
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
