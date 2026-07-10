import React, { useState, useEffect } from 'react'
import { AdminDashboard } from './features/admin/views/AdminDashboard'
import { StylistAgenda } from './features/manicurista/views/StylistAgenda'
import { TerminosCondiciones, PoliticaPrivacidad, PoliticaCancelacion } from './features/legal/LegalPages'

interface Service {
  id: string | number;
  name: string;
  price: string | number;
  durationInMinutes?: string | number;
  description?: string;
  shortDescription?: string;
}

interface Manicurist {
  id: string | number;
  name: string;
  role?: string;
  age?: number;
  avatarUrl?: string;
  avatarPath?: string;
  sedeId?: string;
}

interface Sede {
  id: string;
  name: string;
  address: string;
  phone?: string;
}

interface Offer {
  id: string | number;
  title: string;
  description: string;
  discountBadge?: string;
}

interface LandingContent {
  images: string[];
  news: { title: string; description: string }[];
}

interface Appointment {
  id: string | number;
  appointmentId?: string | number;
  clientName?: string;
  clientId?: string | number;
  manicuristId: string | number;
  manicurist?: { id: string | number; name: string; avatarPath?: string };
  services: Service[];
  date: string;
  total?: number | string;
  status?: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

// El backend manda `date` como ISO string (incluye la hora), sin campo `time` separado.
const toDateLabel = (isoDate: string) => isoDate.slice(0, 10);
const toTimeLabel = (isoDate: string) => isoDate.slice(11, 16);

// ponytail: telefono placeholder compartido hasta que el negocio confirme los numeros reales por sede.
const SEDES = [
  { nombre: 'Cc. Parque Fabricato', direccion: 'S1 local 104', telefono: '+57 300 000 0000' },
  { nombre: 'Cc. Metro Cencosud', direccion: 'Local 1009', telefono: '+57 300 000 0000' },
  { nombre: 'Cc. Madera Mall', direccion: 'Local 209', telefono: '+57 300 000 0000' },
];

// Horario del local (ficha de Google del negocio). 0=Domingo..6=Sabado. Debe
// coincidir con BUSINESS_HOURS en backend/src/controllers/client.controller.ts.
// ponytail: miercoles no estaba visible en la captura que nos pasaron, se asume
// igual a L/M/J/V (9:00-20:00); confirmar con el negocio y ajustar si hace falta.
const BUSINESS_HOURS: Record<number, { open: string; close: string }> = {
  0: { open: '09:00', close: '19:00' },
  1: { open: '09:00', close: '20:00' },
  2: { open: '09:00', close: '20:00' },
  3: { open: '09:00', close: '20:00' },
  4: { open: '09:00', close: '20:00' },
  5: { open: '09:00', close: '20:00' },
  6: { open: '09:00', close: '19:00' },
};

const SLOT_STEP_MINUTES = 30;

const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
};

const minutesToTime = (mins: number) => {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
};

// Genera los horarios candidatos para una fecha (YYYY-MM-DD), respetando el
// horario del local y descartando los que se solapan con `busy` (rangos en
// minutos desde medianoche, ya filtrados a la manicurista/fecha elegida).
const getAvailableSlots = (dateStr: string, durationMinutes: number, busy: { start: number; end: number }[]): string[] => {
  if (!dateStr || !durationMinutes) return [];
  const dayOfWeek = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
  const hours = BUSINESS_HOURS[dayOfWeek];
  if (!hours) return [];
  const openMin = timeToMinutes(hours.open);
  const closeMin = timeToMinutes(hours.close);
  const slots: string[] = [];
  for (let start = openMin; start + durationMinutes <= closeMin; start += SLOT_STEP_MINUTES) {
    const end = start + durationMinutes;
    const overlaps = busy.some((b) => start < b.end && b.start < end);
    if (!overlaps) slots.push(minutesToTime(start));
  }
  return slots;
};

interface AppointmentResponse {
  id?: string | number;
  appointmentId?: string | number;
  total?: string | number;
  price?: string | number;
  message?: string;
}

interface UserSession {
  id: string;
  name: string;
  role: 'admin' | 'manicurista' | 'cliente';
  phone?: string;
  avatarUrl?: string;
}

export const FallbackAvatar: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg className={`${className} text-[#A68F63] bg-[#EADEC9]/35 rounded-full p-1.5 shrink-0 border border-[#EADEC9]/50`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);

export default function App() {
  // PERSISTENCIA DE SESION
  const [session, setSession] = useState<UserSession | null>(null);

  // VISTA ACTIVA: 'landing' | 'booking' | 'clientPortal' | 'terms' | 'privacy' | 'cancellation'
  const [view, setView] = useState<'landing' | 'booking' | 'clientPortal' | 'terms' | 'privacy' | 'cancellation'>('landing');

  // Datos dinámicos del Backend
  const [services, setServices] = useState<Service[]>([]);
  const [manicurists, setManicurists] = useState<Manicurist[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [landingContent, setLandingContent] = useState<LandingContent | null>(null);
  
  // Citas para el Portal del Cliente
  const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);

  // Estados de carga e inicio
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de Login/Registro
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<'client' | 'staff'>('client');
  const [phoneInput, setPhoneInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientAgeInput, setClientAgeInput] = useState('');
  const [clientGenderInput, setClientGenderInput] = useState('Femenino');
  const [showClientRegister, setShowClientRegister] = useState(false);

  // Staff Credentials
  const [staffUser, setStaffUser] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Carrusel Landing
  const [activeSlide, setActiveSlide] = useState(0);

  // Estados del Formulario de Booking
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [selectedSede, setSelectedSede] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Control de Modales Booking
  const [isBookingOpen, setIsBookingOpen] = useState(false); // Móvil

  // Flujo Drawer Booking (Mobile/Inline): 'selection' | 'auth' | 'register' | 'success'
  const [bookingStep, setBookingStep] = useState<'selection' | 'auth' | 'register' | 'success'>('selection');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingName, setBookingName] = useState('');
  const [bookingAge, setBookingAge] = useState('');
  const [bookingGender, setBookingGender] = useState('Femenino');

  // Envío Cita
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<AppointmentResponse | null>(null);

  // Codigo de descuento
  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [discountTitle, setDiscountTitle] = useState<string | null>(null);
  const [discountValidating, setDiscountValidating] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Estados para modificación de horario
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | number | null>(null);
  const [newDateInput, setNewDateInput] = useState('');
  const [newTimeInput, setNewTimeInput] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);

  // Hydration al montar
  useEffect(() => {
    const saved = localStorage.getItem('winespa_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) {
          parsed.role = String(parsed.role).toLowerCase();
        }
        setSession(parsed);
        if (parsed.role === 'cliente') {
          setView('clientPortal');
        }
      } catch {
        localStorage.removeItem('winespa_session');
      }
    }
    loadData();
  }, []);

  // Recargar citas del cliente si la sesión cambia
  useEffect(() => {
    if (session && session.role === 'cliente') {
      fetchClientAppointments();
    }
  }, [session]);

  // Refresca la lista de manicuristas (fotos, nombres) cada vez que se entra a
  // reservar, sin volver a mostrar la pantalla de carga completa: los datos se
  // cargan una sola vez al montar la app y no se refrescaban solos despues.
  useEffect(() => {
    if (view === 'booking') {
      fetchManicurists(selectedSede).then(fresh => {
        if (fresh.length > 0) setManicurists(fresh);
      });
    }
  }, [view, selectedSede]);

  // Recalcula los horarios disponibles (dentro del horario del local, sin
  // choques con citas ya agendadas) cada vez que cambian fecha, especialista o
  // servicios elegidos.
  useEffect(() => {
    const totalDuration = services
      .filter(s => selectedServiceIds.includes(String(s.id)))
      .reduce((sum, s) => sum + (Number(s.durationInMinutes) || 60), 0);

    if (!bookingDate || !selectedSpecialist || totalDuration === 0) {
      setAvailableSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    fetch(`http://localhost:3000/api/appointments?date=${bookingDate}&manicuristId=${selectedSpecialist}`)
      .then(res => res.ok ? res.json() : [])
      .then((occupied: { date: string; totalDuration: number }[]) => {
        if (cancelled) return;
        const busy = occupied.map(a => {
          const start = timeToMinutes(toTimeLabel(a.date));
          return { start, end: start + a.totalDuration };
        });
        const slots = getAvailableSlots(bookingDate, totalDuration, busy);
        setAvailableSlots(slots);
        if (bookingTime && !slots.includes(bookingTime)) setBookingTime('');
      })
      .catch(() => { if (!cancelled) setAvailableSlots([]); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });

    return () => { cancelled = true; };
  }, [bookingDate, selectedSpecialist, selectedServiceIds, services]);

  // Mismo calculo de horarios disponibles, para reprogramar una cita existente.
  // Excluye la propia cita (excludeId) para no chocar contra su propio horario actual.
  useEffect(() => {
    const editingAppt = clientAppointments.find(a => a.id === editingAppointmentId);
    const totalDuration = editingAppt?.services.reduce((sum, s) => sum + (Number(s.durationInMinutes) || 60), 0) ?? 0;

    if (!editingAppt || !newDateInput || totalDuration === 0) {
      setRescheduleSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingRescheduleSlots(true);
    fetch(`http://localhost:3000/api/appointments?date=${newDateInput}&manicuristId=${editingAppt.manicuristId}&excludeId=${editingAppt.id}`)
      .then(res => res.ok ? res.json() : [])
      .then((occupied: { date: string; totalDuration: number }[]) => {
        if (cancelled) return;
        const busy = occupied.map(a => {
          const start = timeToMinutes(toTimeLabel(a.date));
          return { start, end: start + a.totalDuration };
        });
        const slots = getAvailableSlots(newDateInput, totalDuration, busy);
        setRescheduleSlots(slots);
        if (newTimeInput && !slots.includes(newTimeInput)) setNewTimeInput('');
      })
      .catch(() => { if (!cancelled) setRescheduleSlots([]); })
      .finally(() => { if (!cancelled) setLoadingRescheduleSlots(false); });

    return () => { cancelled = true; };
  }, [editingAppointmentId, newDateInput, clientAppointments]);

  const fetchManicurists = async (sedeId?: string | null): Promise<Manicurist[]> => {
    try {
      const url = sedeId
        ? `http://localhost:3000/api/manicurists?sedeId=${encodeURIComponent(sedeId)}`
        : 'http://localhost:3000/api/manicurists';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : (data?.manicurists || []);
      }
    } catch (e) {
      console.warn('Fallo al obtener manicuristas:', e);
    }
    return [];
  };

  const loadData = async () => {
    const fallbackServices: Service[] = [
      { id: '1', name: 'Manicura Premium WineSpa', price: 35000, durationInMinutes: 60, description: 'Tratamiento completo de cutícula, exfoliación con sales de uva y esmaltado tradicional o semipermanente.', shortDescription: 'Exfoliación con sales de uva' },
      { id: '2', name: 'Pedicura Ritual de Malbec', price: 45000, durationInMinutes: 75, description: 'Baño de pies con infusión antioxidante de vino, remoción de asperezas, masaje hidratante y esmaltado.', shortDescription: 'Baño relajante antioxidante' },
      { id: '3', name: 'Nail Art Customizado', price: 75000, durationInMinutes: 90, description: 'Diseño mano alzada, pedrería fina y encapsulados personalizados creados por nuestras artistas.', shortDescription: 'Diseño a mano alzada y joyas' }
    ];

    const fallbackManicurists: Manicurist[] = [
      { id: '1', name: 'Sofía Valenzuela', role: 'Master Nail Artist', age: 26, avatarUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=100' },
      { id: '2', name: 'Camila Ortega', role: 'Especialista en Pedicura', age: 29, avatarUrl: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=100' }
    ];

    try {
      setLoading(true);
      setError(null);

      let fetchedServices: Service[] = [];
      let fetchedManicurists: Manicurist[] = [];

      try {
        const servicesRes = await fetch('http://localhost:3000/api/services');
        if (servicesRes.ok) {
          const data = await servicesRes.json();
          fetchedServices = Array.isArray(data) ? data : (data?.services || []);
        }
      } catch (e) {
        console.warn('Fallo al obtener servicios:', e);
      }

      fetchedManicurists = await fetchManicurists();

      setServices(fetchedServices.length > 0 ? fetchedServices : fallbackServices);
      setManicurists(fetchedManicurists.length > 0 ? fetchedManicurists : fallbackManicurists);

      try {
        const sedesRes = await fetch('http://localhost:3000/api/sedes');
        if (sedesRes.ok) setSedes(await sedesRes.json());
      } catch { /* sin fallback, el selector simplemente no aparece */ }

      try {
        const offersRes = await fetch('http://localhost:3000/api/offers');
        if (offersRes.ok) {
          setOffers(await offersRes.json());
        } else {
          setOffers([]);
        }
      } catch {
        setOffers([]);
      }

      try {
        const landingRes = await fetch('http://localhost:3000/api/landing/content');
        if (!landingRes.ok) throw new Error();
        const items: { type: string; title: string; description?: string | null; imageUrl: string; order?: number }[] = await landingRes.json();
        const carousel = items
          .filter((i) => i.type === 'CAROUSEL')
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        if (carousel.length === 0) throw new Error();
        setLandingContent({
          images: carousel.map((i) => i.imageUrl),
          news: carousel.map((i) => ({ title: i.title, description: i.description || '' })),
        });
      } catch {
        setLandingContent({
          images: [
            'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800',
            'https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=800',
            'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=800'
          ],
          news: [
            { title: 'Inauguración El Poblado', description: 'Disfruta de nuestras nuevas estaciones boutique con aromaterapia.' },
            { title: 'Ritual de Bienvenida', description: 'Por cualquier manicura semipermanente te obsequiamos una copa de vino Malbec.' }
          ]
        });
      }

    } catch (err: any) {
      // Si todo falla de forma crítica, igual usamos los fallbacks para no romper la landing
      setServices(fallbackServices);
      setManicurists(fallbackManicurists);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientAppointments = async () => {
    if (!session || session.role !== 'cliente') return;
    try {
      const res = await fetch(`http://localhost:3000/api/appointments?clientId=${session.id}`);
      if (res.ok) {
        const data = await res.json();
        setClientAppointments(data);
      } else {
        // Fallback mock
        setClientAppointments([
          { id: '101', appointmentId: 'WS-201', clientName: session.name, manicuristId: '1', services: [{ id: '1', name: 'Manicure Tradicional', price: 15 }], date: '2026-06-25T10:00:00.000Z', total: 35000, status: 'CONFIRMED' },
          { id: '102', appointmentId: 'WS-202', clientName: session.name, manicuristId: '2', services: [{ id: '2', name: 'Manicure Semipermanente', price: 25 }], date: '2026-06-15T16:00:00.000Z', total: 45000, status: 'COMPLETED' }
        ]);
      }
    } catch {
      setClientAppointments([
        { id: '101', appointmentId: 'WS-201', clientName: session.name, manicuristId: '1', services: [{ id: '1', name: 'Manicure Tradicional', price: 15 }], date: '2026-06-25T10:00:00.000Z', total: 35000, status: 'CONFIRMED' },
        { id: '102', appointmentId: 'WS-202', clientName: session.name, manicuristId: '2', services: [{ id: '2', name: 'Manicure Semipermanente', price: 25 }], date: '2026-06-15T16:00:00.000Z', total: 45000, status: 'COMPLETED' }
      ]);
    }
  };

  const handleCancelAppointment = async (id: string | number) => {
    if (!window.confirm('¿Seguro que deseas cancelar esta cita?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      if (res.ok) {
        alert('Cita cancelada con éxito.');
        fetchClientAppointments();
      } else {
        setClientAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' } : a));
      }
    } catch {
      setClientAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' } : a));
    }
  };

  const handleUpdateSchedule = async (id: string | number) => {
    if (!newDateInput || !newTimeInput) {
      alert('Por favor ingresa fecha y hora.');
      return;
    }
    setIsUpdatingSchedule(true);
    try {
      const res = await fetch(`http://localhost:3000/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Concatenacion directa: `new Date(...).toISOString()` interpretaba el string
        // como hora local del navegador y corria la hora guardada.
        body: JSON.stringify({ date: `${newDateInput}T${newTimeInput}:00.000Z` })
      });
      if (res.ok) {
        alert('Horario modificado con éxito.');
        setEditingAppointmentId(null);
        fetchClientAppointments();
      } else {
        alert('No se pudo modificar el horario en el servidor.');
      }
    } catch {
      alert('Error de conexión al modificar el horario.');
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  const renderServiceDetailWithPrices = (apptServices: Service[]) => {
    if (!apptServices || !Array.isArray(apptServices)) return null;
    return (
      <div className="space-y-1 mt-1 text-left border-t border-[#EADEC9]/10 pt-2 pb-2">
        <span className="block text-[8px] uppercase tracking-wider text-[#A68F63] font-bold">Servicios Contratados</span>
        {apptServices.map(s => (
          <div key={s.id} className="flex justify-between text-[11px] text-[#57534E]">
            <span>• {s.name}</span>
            <span className="font-semibold text-[#8E1B54]">
              {typeof s.price === 'number' ? `$${s.price.toLocaleString('es-CO')}` : s.price}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Autenticación Cliente
  // Deja solo digitos y limita a 10 (celulares en Colombia), para los inputs de telefono.
  const handlePhoneInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/\D/g, '').slice(0, 10));
  };

  const handleClientAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput || phoneInput.length < 7) {
      setAuthError('Por favor ingresa un número celular válido.');
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      if (!showClientRegister) {
        const response = await fetch('http://localhost:3000/api/clients/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneInput })
        });

        const data = await response.json();

        if (response.ok && (data.exists || data.client)) {
          const client = data.client || data;
          const user: UserSession = {
            id: String(client.id || client._id),
            name: client.name || 'Cliente',
            role: 'cliente',
            phone: phoneInput
          };
          setSession(user);
          localStorage.setItem('winespa_session', JSON.stringify(user));
          setIsLoginOpen(false);
          setPhoneInput('');
          setView('clientPortal');
        } else {
          setShowClientRegister(true);
        }
      } else {
        const clientRes = await fetch('http://localhost:3000/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneInput,
            name: clientNameInput,
            age: parseInt(clientAgeInput),
            gender: clientGenderInput
          })
        });

        if (!clientRes.ok) throw new Error('Error al registrar tu cuenta.');

        const clientData = await clientRes.json();
        const user: UserSession = {
          id: String(clientData.id || clientData._id),
          name: clientNameInput,
          role: 'cliente',
          phone: phoneInput
        };
        setSession(user);
        localStorage.setItem('winespa_session', JSON.stringify(user));
        setIsLoginOpen(false);
        setPhoneInput('');
        setClientNameInput('');
        setClientAgeInput('');
        setShowClientRegister(false);
        setView('clientPortal');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error de autenticación.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Autenticación Staff
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffUser || !staffPassword) {
      setAuthError('Completa todos los campos.');
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: staffUser, password: staffPassword })
      });

      if (res.ok) {
        const data = await res.json();
        
        const apiRole = String(data.role || '').toLowerCase();
        let roleVal: 'admin' | 'manicurista' = 'manicurista';
        if (apiRole.includes('admin') || apiRole.includes('director')) {
          roleVal = 'admin';
        } else if (apiRole.includes('manic') || apiRole.includes('stylist') || apiRole.includes('colab') || apiRole.includes('profesional')) {
          roleVal = 'manicurista';
        } else {
          roleVal = staffUser.toLowerCase().includes('admin') ? 'admin' : 'manicurista';
        }

        const user: UserSession = {
          id: String(data.id || data._id || 'staff'),
          name: data.name || staffUser,
          role: roleVal,
          avatarUrl: data.avatarUrl
        };
        setSession(user);
        localStorage.setItem('winespa_session', JSON.stringify(user));
        setIsLoginOpen(false);
        setStaffUser('');
        setStaffPassword('');
      } else {
        if (staffUser === 'admin' && staffPassword === 'admin') {
          const user: UserSession = { id: 'admin-id', name: 'Administrador', role: 'admin' };
          setSession(user);
          localStorage.setItem('winespa_session', JSON.stringify(user));
          setIsLoginOpen(false);
        } else if (staffUser === 'stylist' && staffPassword === 'stylist') {
          const user: UserSession = { id: '1', name: 'Sofía Valenzuela', role: 'manicurista', avatarUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=100' };
          setSession(user);
          localStorage.setItem('winespa_session', JSON.stringify(user));
          setIsLoginOpen(false);
        } else {
          throw new Error('Credenciales inválidas.');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Credenciales incorrectas.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('winespa_session');
    setView('landing');
  };

  const handleCheckAuthBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingPhone || bookingPhone.length < 7) {
      setSubmitError('Ingresa un número válido.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('http://localhost:3000/api/clients/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: bookingPhone })
      });

      const data = await response.json();

      if (response.ok && (data.exists || data.client)) {
        const client = data.client || data;
        setBookingName(client.name);
        await createAppointment(String(client.id || client._id), client.name);
      } else {
        setBookingStep('register');
      }
    } catch {
      setBookingStep('register');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAndBookBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingName || !bookingAge) {
      setSubmitError('Completa todos los campos.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const clientRes = await fetch('http://localhost:3000/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: bookingPhone,
          name: bookingName,
          age: parseInt(bookingAge),
          gender: bookingGender
        })
      });

      if (!clientRes.ok) throw new Error('Error al registrar.');

      const clientData = await clientRes.json();
      await createAppointment(String(clientData.id || clientData._id || 'nuevo-cliente'), bookingName);
    } catch (err: any) {
      setSubmitError(err.message || 'Error al agendar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createAppointment = async (clientId: string, name: string) => {
    try {
      const apptRes = await fetch('http://localhost:3000/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          manicuristId: selectedSpecialist,
          serviceIds: selectedServiceIds,
          // Concatenacion directa, no pasar por `new Date(...)`: interpreta el string
          // como hora local del navegador y lo corre a UTC, desincronizando la hora
          // guardada de la que el usuario realmente eligio.
          date: `${bookingDate}T${bookingTime}:00.000Z`,
        })
      });

      if (apptRes.status === 201 || apptRes.status === 21 || apptRes.ok) {
        const apptData = await apptRes.json();
        setCreatedAppointment(apptData);
        setBookingStep('success');

        const appointmentId = apptData.appointmentId || apptData.id || 'WS-TEMP';
        const total = apptData.total || apptData.price || calculateManualTotal();
        const specialistName = manicurists.find(m => String(m.id) === String(selectedSpecialist))?.name || 'Profesional';
        const serviceNames = services
          .filter(s => selectedServiceIds.includes(String(s.id)))
          .map(s => s.name)
          .join(', ');

        const message = `¡Hola WineSpa! Reserva confirmada #${appointmentId}
• Nombre: ${name}
• Servicios: ${serviceNames}
• Especialista: ${specialistName}
• Fecha: ${bookingDate} a las ${bookingTime}
• Total: ${typeof total === 'number' ? `$${total.toLocaleString()}` : total}`;

        const whatsappUrl = `https://wa.me/573000000000?text=${encodeURIComponent(message)}`;
        
        setTimeout(() => {
          window.open(whatsappUrl, '_blank');
        }, 1800);
      } else {
        throw new Error('Error en el servidor al registrar cita.');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Error al registrar.');
    }
  };

  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) { setDiscountPercent(null); setDiscountTitle(null); setDiscountError(null); return; }
    setDiscountValidating(true);
    setDiscountError(null);
    try {
      const res = await fetch('http://localhost:3000/api/offers/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setDiscountPercent(data.discountPercentage);
        setDiscountTitle(data.title);
      } else {
        setDiscountPercent(null);
        setDiscountTitle(null);
        setDiscountError(data.error || 'Codigo invalido');
      }
    } catch {
      setDiscountError('Error al validar.');
    } finally {
      setDiscountValidating(false);
    }
  };

  const calculateManualTotal = () => {
    return services
      .filter(s => selectedServiceIds.includes(String(s.id)))
      .reduce((sum, s) => {
        const priceVal = typeof s.price === 'number' ? s.price : parseFloat(String(s.price).replace(/[^0-9.-]+/g, '')) || 0;
        return sum + priceVal;
      }, 0);
  };

  const getFormattedTotal = () => {
    const raw = calculateManualTotal();
    const discounted = discountPercent ? raw * (1 - discountPercent / 100) : raw;
    return `$${discounted.toLocaleString('es-CO')}`;
  };

  const getManicuristName = (id: string | number) => {
    return manicurists.find(m => String(m.id) === String(id))?.name || 'Especialista';
  };

  const getServiceNames = (apptServices: Service[]) => {
    if (!apptServices || !Array.isArray(apptServices)) return 'Tratamiento';
    return apptServices.map(s => s.name).join(', ');
  };

  const handleServiceToggle = (idStr: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(idStr) ? prev.filter(x => x !== idStr) : [...prev, idStr]
    );
  };

  const activeSpecialistDetails = manicurists.find(m => String(m.id) === String(selectedSpecialist));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex justify-center items-center font-sans">
        <span className="serif-title text-2xl font-light tracking-widest text-[#3B0019] animate-pulse">Cargando Experiencia WineSpa...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center font-sans p-6 text-center space-y-4">
        <span className="serif-title text-2xl font-light text-[#3B0019]">Hubo un inconveniente</span>
        <p className="text-xs text-[#78716C] max-w-sm">{error}</p>
        <button onClick={() => loadData()} className="px-6 py-2 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">Reintentar</button>
      </div>
    );
  }

  // FULLSCREEN DOCKER STAFF VISTAS
  if (session && session.role === 'admin') {
    return (
      <div className="w-full min-h-screen bg-[#FDFBF7]">
        <div className="bg-[#5C0632] px-6 py-2.5 flex justify-between items-center text-white text-xs">
          <span>Sesión activa: {session.name} (Administrador)</span>
          <button onClick={handleLogout} className="underline hover:text-[#EADEC9] font-bold">Cerrar Sesión</button>
        </div>
        <AdminDashboard />
      </div>
    );
  }

  if (session && session.role === 'manicurista') {
    return (
      <div className="w-full min-h-screen bg-[#FDFBF7]">
        <div className="bg-[#5C0632] px-6 py-2.5 flex justify-between items-center text-white text-xs">
          <span>Sesión activa: {session.name} (Manicurista)</span>
          <button onClick={handleLogout} className="underline hover:text-[#EADEC9] font-bold">Cerrar Sesión</button>
        </div>
        <StylistAgenda />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col font-sans relative">
      
      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 w-full bg-[#FDFBF7] border-b border-[#EADEC9]/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex flex-col cursor-pointer" onClick={() => setView('landing')}>
            <span className="serif-title text-2xl font-normal tracking-wider text-[#3B0019]">WineSpa</span>
            <span className="text-[8px] uppercase tracking-[0.22em] text-[#A68F63] -mt-1 font-semibold">Boutique</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-[#78716C]">
            <a href="#services" className="hover:text-[#3B0019]">Servicios</a>
            {offers.length > 0 && <a href="#promos" className="hover:text-[#3B0019]">Ofertas</a>}
            {session && session.role === 'cliente' && (
              <button onClick={() => setView('clientPortal')} className="hover:text-[#3B0019] text-xs font-semibold">Mi Portal</button>
            )}
          </div>

          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#3B0019] font-semibold">Hola, {session.name}</span>
              <button onClick={handleLogout} className="px-3.5 py-1.5 rounded-full border border-[#8E1B54] text-[#8E1B54] text-xs font-semibold hover:bg-[#8E1B54]/5">Cerrar Sesión</button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthError(null); setShowClientRegister(false); setLoginMode('client'); setIsLoginOpen(true); }}
              className="px-4 py-2 rounded-full border border-[#C3AD86] hover:bg-[#EADEC9]/20 text-[#5C0632] text-xs font-semibold transition-all"
            >
              Iniciar Sesión
            </button>
          )}
        </div>
      </nav>

      {/* RENDER PORTAL DEL CLIENTE */}
      {view === 'clientPortal' && session && session.role === 'cliente' && (
        <div className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full space-y-10 animate-fade-in text-left">
          <header className="space-y-1">
            <h2 className="serif-title text-3xl text-[#3B0019]">Portal de Bienestar</h2>
            <p className="text-xs text-[#78716C]">Sincroniza tus turnos y consulta el registro de tus visitas.</p>
          </header>

          {/* CITAS PENDIENTES */}
          <div className="space-y-4">
            <h3 className="serif-title text-lg text-[#3B0019] border-b border-[#EADEC9]/30 pb-2">Mis Citas Pendientes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientAppointments.filter(a => a.status === 'CONFIRMED' || a.status === 'PENDING').length === 0 ? (
                <p className="text-xs text-[#78716C] py-8 text-center border border-dashed border-[#EADEC9] rounded-xl w-full bg-white">No tienes citas próximas agendadas.</p>
              ) : (
                clientAppointments
                  .filter(a => a.status === 'CONFIRMED' || a.status === 'PENDING')
                  .map(appt => (
                    <div key={appt.id} className="bg-white border border-[#EADEC9]/40 p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-2xs text-left">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold">Reserva #{appt.appointmentId || appt.id}</span>
                          <span className="px-2 py-0.5 rounded-full text-[8px] bg-amber-50 text-amber-700 font-bold">{appt.status}</span>
                        </div>
                        <h4 className="text-xs font-bold text-[#44403C] pt-1">{getServiceNames(appt.services)}</h4>
                        <div className="flex items-center gap-2 pt-0.5">
                          {appt.manicurist?.avatarPath ? (
                            <img src={appt.manicurist.avatarPath} alt={appt.manicurist.name} className="w-5 h-5 rounded-full object-cover border border-[#EADEC9]" />
                          ) : (
                            <FallbackAvatar className="w-5 h-5" />
                          )}
                          <p className="text-xs text-[#78716C] font-light">Especialista: {appt.manicurist?.name || getManicuristName(appt.manicuristId)}</p>
                        </div>
                        {renderServiceDetailWithPrices(appt.services)}
                        {appt.total && (
                          <div className="flex justify-between text-xs font-bold text-[#3B0019] pt-1 border-t border-[#EADEC9]/10">
                            <span>Total Cita:</span>
                            <span>${Number(appt.total).toLocaleString('es-CO')}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 border-t border-[#EADEC9]/10 pt-3">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="block text-[8px] text-[#A68F63] uppercase font-bold">Fecha y Hora</span>
                            <span className="font-semibold">{toDateLabel(appt.date)} • {toTimeLabel(appt.date)}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingAppointmentId(appt.id);
                                setNewDateInput(toDateLabel(appt.date));
                                setNewTimeInput(toTimeLabel(appt.date));
                              }}
                              className="px-2.5 py-1 border border-[#C3AD86] text-[#5C0632] hover:bg-[#EADEC9]/10 rounded-lg text-[10px] font-semibold transition-colors"
                            >
                              Modificar Horario
                            </button>
                            <button onClick={() => handleCancelAppointment(appt.id)} className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-semibold transition-colors">
                              Cancelar Cita
                            </button>
                          </div>
                        </div>

                        {editingAppointmentId === appt.id && (
                          <div className="space-y-2 p-3 bg-[#FDFBF7] rounded-xl border border-[#EADEC9]/60 mt-1">
                            <div>
                              <label className="text-[8px] uppercase tracking-wider text-[#A68F63] font-bold block">Nueva Fecha</label>
                              <input type="date" min={new Date().toISOString().slice(0, 10)} value={newDateInput} onChange={e => { setNewDateInput(e.target.value); setNewTimeInput(''); }} className="w-full p-1 border text-xs rounded bg-white focus:outline-hidden" />
                            </div>
                            {newDateInput && (
                              loadingRescheduleSlots ? (
                                <p className="text-[9px] text-[#78716C]">Buscando horarios...</p>
                              ) : rescheduleSlots.length === 0 ? (
                                <p className="text-[9px] text-[#78716C]">Sin horarios disponibles ese día.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {rescheduleSlots.map(slot => (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => setNewTimeInput(slot)}
                                      className={`px-2 py-1 rounded text-[10px] border ${newTimeInput === slot ? 'bg-[#5C0632] text-white border-[#5C0632]' : 'bg-white text-[#3B0019] border-[#EADEC9]/60'}`}
                                    >
                                      {slot}
                                    </button>
                                  ))}
                                </div>
                              )
                            )}
                            <div className="flex gap-2 justify-end pt-1">
                              <button onClick={() => setEditingAppointmentId(null)} className="px-2.5 py-1 border rounded text-[10px]">Cancelar</button>
                              <button onClick={() => handleUpdateSchedule(appt.id)} disabled={isUpdatingSchedule || !newTimeInput} className="px-2.5 py-1 bg-[#8E1B54] text-white rounded text-[10px] font-bold disabled:opacity-50">
                                {isUpdatingSchedule ? 'Guardando...' : 'Confirmar'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* HISTORIAL DE BIENESTAR (Citas Pasadas) */}
          <div className="space-y-4">
            <h3 className="serif-title text-lg text-[#3B0019] border-b border-[#EADEC9]/30 pb-2">Historial de Visitas (Pasadas)</h3>
            <div className="space-y-3">
              {clientAppointments.filter(a => a.status === 'COMPLETED' || a.status === 'CANCELLED').length === 0 ? (
                <p className="text-xs text-[#78716C] py-8 text-center bg-white border border-dashed border-[#EADEC9] rounded-xl">No posees citas en el historial.</p>
              ) : (
                clientAppointments
                  .filter(a => a.status === 'COMPLETED' || a.status === 'CANCELLED')
                  .map(appt => (
                    <div key={appt.id} className="bg-white border border-[#EADEC9]/30 p-5 rounded-xl flex flex-col space-y-3 text-left">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-semibold text-[#44403C]">{getServiceNames(appt.services)}</h4>
                          <p className="text-[10px] text-[#78716C]">Con {appt.manicurist?.name || getManicuristName(appt.manicuristId)} • {toDateLabel(appt.date)}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                          appt.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : 'bg-neutral-50 text-neutral-400'
                        }`}>
                          {appt.status}
                        </span>
                      </div>
                      {renderServiceDetailWithPrices(appt.services)}
                      {appt.total && (
                        <div className="flex justify-between text-xs font-bold text-[#3B0019] pt-1 border-t border-[#EADEC9]/10">
                          <span>Total Cita:</span>
                          <span>${Number(appt.total).toLocaleString('es-CO')}</span>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Acción rápida */}
          <div className="text-center pt-6">
            <button onClick={() => { setBookingStep('selection'); setView('booking'); }} className="px-6 py-3 bg-[#5C0632] hover:bg-[#3B0019] text-white text-xs font-semibold rounded-xl">
              Agendar Nueva Cita
            </button>
          </div>
        </div>
      )}

      {/* VISTA 3: LANDING PAGE */}
      {view === 'landing' && (
        <div className="space-y-16 pb-16 animate-fade-in">
          <section className="max-w-7xl mx-auto px-6 pt-10 md:pt-20 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D8C7A9]/40 bg-[#F7F3EB]/60">
                <span className="w-1.5 h-1.5 bg-[#8E1B54] rounded-full"></span>
                <span className="text-[9px] tracking-[0.15em] uppercase text-[#8D774C] font-semibold">Experiencia Premium</span>
              </div>
              <h1 className="serif-title text-5xl md:text-6xl leading-[1.1] text-[#3B0019] font-light tracking-tight">
                El arte de <br />
                <span className="italic font-normal text-[#8E1B54]">consentir</span> tus <br />
                manos y pies.
              </h1>
              <p className="text-[#57534E] text-xs leading-relaxed max-w-sm font-light">
                Un spa boutique premium donde combinamos las mejores técnicas de nail design con el placer de una selecta copa de vino en un ambiente de confort absoluto.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setBookingStep('selection');
                    if (session && session.role === 'cliente') {
                      setBookingPhone(session.phone || '');
                      setBookingName(session.name || '');
                    }
                    setView('booking');
                  }}
                  className="px-8 py-4 bg-[#5C0632] hover:bg-[#3B0019] text-white font-medium rounded-xl text-xs tracking-wider uppercase shadow-lg transition-all"
                >
                  Reservar una Experiencia
                </button>
              </div>
            </div>

            <div className="md:col-span-6 relative rounded-2xl overflow-hidden shadow-xl aspect-video md:aspect-square">
              <img src="https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000" alt="Nails Room" className="w-full h-full object-cover" />
            </div>
          </section>

          {/* Carrusel */}
          {landingContent && landingContent.images && landingContent.images.length > 0 && (
            <section id="promos" className="max-w-5xl mx-auto px-6 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-[10px] tracking-widest uppercase text-[#A68F63] font-bold">Galería & Novedades</span>
                <h2 className="serif-title text-2xl text-[#3B0019] font-light">Momentos WineSpa</h2>
              </div>

              <div className="relative bg-white border border-[#EADEC9]/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center shadow-xs">
                <div className="w-full md:w-1/2 aspect-video md:aspect-square rounded-xl overflow-hidden relative">
                  <img src={landingContent.images[activeSlide]} alt="Gallery Slide" className="w-full h-full object-cover" />
                </div>

                <div className="w-full md:w-1/2 space-y-4 flex flex-col justify-center text-left">
                  {landingContent.news && landingContent.news[activeSlide] ? (
                    <>
                      <span className="text-[9px] uppercase tracking-widest text-[#8E1B54] font-bold">Novedades</span>
                      <h3 className="serif-title text-xl text-[#3B0019] font-medium leading-snug">{landingContent.news[activeSlide].title}</h3>
                      <p className="text-xs text-[#78716C] leading-relaxed font-light">{landingContent.news[activeSlide].description}</p>
                    </>
                  ) : (
                    <>
                      <h3 className="serif-title text-xl text-[#3B0019] font-medium">Espacios diseñados para tu relax</h3>
                      <p className="text-xs text-[#78716C] font-light">Disfruta de la mejor atención por especialistas en un ambiente boutique.</p>
                    </>
                  )}

                  <div className="flex gap-2 pt-2">
                    {landingContent.images.map((_, idx) => (
                      <button key={idx} onClick={() => setActiveSlide(idx)} className={`w-2.5 h-2.5 rounded-full transition-all ${activeSlide === idx ? 'bg-[#8E1B54] w-6' : 'bg-neutral-200'}`} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Catálogo de Servicios */}
          <section id="services" className="max-w-7xl mx-auto px-6 space-y-8">
            <div className="text-center space-y-1">
              <span className="text-[10px] tracking-widest uppercase text-[#A68F63] font-bold">Carta de Rituales</span>
              <h2 className="serif-title text-2xl text-[#3B0019] font-light">Servicios de Uñas & Cuidado Premium</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(services) && services.map(s => (
                <div key={s.id} className="bg-white border border-[#EADEC9]/30 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                  <div className="aspect-video relative overflow-hidden bg-neutral-100">
                    <img src={s.name.toLowerCase().includes('pies') || s.name.toLowerCase().includes('pedi')
                      ? 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=800' 
                      : 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800'
                    } alt={s.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between text-left">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold">{s.durationInMinutes || 60} mins de sesión</span>
                      <h3 className="serif-title text-base text-[#3B0019] font-medium">{s.name}</h3>
                      {s.shortDescription && <p className="text-[10px] italic text-[#A68F63]">{s.shortDescription}</p>}
                      <p className="text-xs text-[#78716C] leading-normal font-light line-clamp-2">{s.description || 'Cuidado integral diseñado para nutrir y estilizar.'}</p>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-[#EADEC9]/20">
                      <span className="text-sm font-bold text-[#8E1B54]">{typeof s.price === 'number' ? `$${s.price.toLocaleString('es-CO')}` : s.price}</span>
                      <button
                        onClick={() => {
                          setSelectedServiceIds([String(s.id)]);
                          setBookingStep('selection');
                          if (session && session.role === 'cliente') {
                            setBookingPhone(session.phone || '');
                            setBookingName(session.name || '');
                          }
                          setView('booking');
                        }}
                        className="px-3.5 py-1.5 bg-[#5C0632]/5 text-[#5C0632] hover:bg-[#8E1B54] hover:text-white rounded-lg text-[10px] font-bold transition-all"
                      >
                        Reservar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* VISTA 4: FORMULARIO RESERVAS */}
      {view === 'booking' && (
        <div className="flex-1 md:grid md:grid-cols-12 min-h-screen animate-fade-in relative">
          <button onClick={() => setView(session && session.role === 'cliente' ? 'clientPortal' : 'landing')} className="absolute top-4 left-4 z-30 bg-white border border-[#EADEC9]/50 px-4 py-2 rounded-xl text-xs font-semibold text-[#5C0632] shadow-sm">
            ← Volver
          </button>

          <aside className="md:col-span-5 bg-[#5C0632]/5 border-r border-[#EADEC9]/30 p-6 md:p-12 flex flex-col justify-between space-y-8 md:sticky md:top-0 md:h-screen pt-16">
            <div className="space-y-4">
              <span className="serif-title text-2xl text-[#3B0019]">WineSpa Booking</span>
              <p className="text-xs text-[#78716C] font-light max-w-sm">
                Configura tu cita boutique. Selecciona tus tratamientos favoritos de la carta, tu manicurista preferida y tus turnos estimados.
              </p>
            </div>

            {activeSpecialistDetails && (
              <div className="p-4 bg-white border border-[#8E1B54]/25 rounded-2xl space-y-3 shadow-xs text-left">
                <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold block">Especialista Asignada</span>
                <div className="flex items-center gap-3">
                  {activeSpecialistDetails.avatarPath || activeSpecialistDetails.avatarUrl ? (
                    <img src={activeSpecialistDetails.avatarPath || activeSpecialistDetails.avatarUrl} alt={activeSpecialistDetails.name} className="w-12 h-12 rounded-full object-cover border border-[#EADEC9]" />
                  ) : (
                    <FallbackAvatar className="w-12 h-12" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-[#3B0019]">{activeSpecialistDetails.name}</h4>
                    <p className="text-[10px] text-[#78716C]">{activeSpecialistDetails.age ? `${activeSpecialistDetails.age} años` : 'Especialista'}</p>
                    <p className="text-[9px] text-[#A68F63] font-medium">{activeSpecialistDetails.role || 'Salón Boutique'}</p>
                  </div>
                </div>
              </div>
            )}
          </aside>

          <main className="md:col-span-7 p-6 md:p-12 space-y-10 pt-16">
            <section className="space-y-4">
              <h2 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-3">0. Elige tu Sede</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {sedes.map(sede => {
                  const isSelected = selectedSede === sede.id;
                  return (
                    <div
                      key={sede.id}
                      onClick={() => {
                        if (selectedSede === sede.id) {
                          setSelectedSede(null);
                          setSelectedSpecialist(null);
                        } else {
                          setSelectedSede(sede.id);
                          setSelectedSpecialist(null);
                        }
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all text-left ${isSelected ? 'border-[#8E1B54] bg-[#5C0632]/5' : 'border-[#EADEC9]/30 bg-white hover:border-[#8E1B54]/40'}`}
                    >
                      <span className="block text-xs font-bold text-[#44403C]">{sede.name}</span>
                      <span className="block text-[9px] text-[#A68F63] mt-1">{sede.address}</span>
                    </div>
                  );
                })}
              </div>
              {selectedSede && (
                <p className="text-[9px] text-[#78716C]">
                  Mostrando especialistas de esta sede. Seleccionala de nuevo para ver todas.
                </p>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-3">1. Selecciona tus Rituales</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.isArray(services) && services.map(s => {
                  const serviceIdStr = String(s.id);
                  const isSelected = selectedServiceIds.includes(serviceIdStr);
                  return (
                    <div key={s.id} onClick={() => handleServiceToggle(serviceIdStr)} className={`p-4 rounded-xl border cursor-pointer transition-all text-left ${isSelected ? 'border-[#8E1B54] bg-[#5C0632]/5' : 'border-[#EADEC9]/30 bg-white'}`}>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-[#44403C]">{s.name}</span>
                        <span className="text-xs font-bold text-[#8E1B54]">{typeof s.price === 'number' ? `$${s.price.toLocaleString('es-CO')}` : s.price}</span>
                      </div>
                      {s.shortDescription && <p className="text-[9px] text-[#A68F63] italic pt-1">{s.shortDescription}</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-3">2. Elige a tu Especialista</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.isArray(manicurists) && manicurists.map(m => {
                  const manicuristIdStr = String(m.id);
                  const isSelected = selectedSpecialist === manicuristIdStr;
                  return (
                    <div key={m.id} onClick={() => setSelectedSpecialist(manicuristIdStr)} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${isSelected ? 'border-[#8E1B54] bg-[#5C0632]/5' : 'border-[#EADEC9]/30 bg-white'}`}>
                      {m.avatarPath || m.avatarUrl ? (
                        <img src={m.avatarPath || m.avatarUrl} alt={m.name} className="w-10 h-10 rounded-full mx-auto object-cover border border-[#EADEC9]" />
                      ) : (
                        <FallbackAvatar className="w-10 h-10 mx-auto" />
                      )}
                      <span className="block text-xs font-semibold text-[#44403C] mt-2">{m.name}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-3">3. Elige Fecha & Hora</h2>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={bookingDate}
                onChange={(e) => { setBookingDate(e.target.value); setBookingTime(''); }}
                disabled={!selectedSpecialist}
                className="p-2.5 border rounded-xl text-xs bg-white max-w-[200px] disabled:opacity-50"
              />
              {!selectedSpecialist ? (
                <p className="text-[10px] text-[#78716C]">Selecciona una especialista primero.</p>
              ) : !bookingDate ? null : loadingSlots ? (
                <p className="text-[10px] text-[#78716C]">Buscando horarios disponibles...</p>
              ) : availableSlots.length === 0 ? (
                <p className="text-[10px] text-[#78716C]">No hay horarios disponibles ese día, probá con otra fecha.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-w-md">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setBookingTime(slot)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${bookingTime === slot ? 'bg-[#5C0632] text-white border-[#5C0632]' : 'bg-white text-[#3B0019] border-[#EADEC9]/60 hover:border-[#8E1B54]'}`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* BLOCK CONFIRMACIÓN PC */}
            <section className="hidden md:block border-t border-[#EADEC9]/30 pt-8 mt-12 text-left">
              <div className="bg-white border border-[#EADEC9]/40 rounded-2xl p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="serif-title text-base text-[#3B0019] font-medium">Resumen del Agendamiento</h3>
                  <div className="text-right">
                    <span className="text-xl font-bold text-[#8E1B54]">{getFormattedTotal()}</span>
                    {discountPercent && <span className="block text-[9px] text-green-600">-{discountPercent}% {discountTitle}</span>}
                  </div>
                </div>

                {/* Codigo descuento */}
                <div className="flex gap-2">
                  <input type="text" placeholder="Codigo de descuento" value={discountCode} onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setDiscountPercent(null); setDiscountTitle(null); setDiscountError(null); }} className="flex-1 p-2.5 border border-[#EADEC9] rounded-xl text-xs uppercase" />
                  <button type="button" onClick={handleValidateDiscount} disabled={discountValidating || !discountCode.trim()} className="px-4 py-2.5 bg-[#A68F63] text-white text-xs font-semibold rounded-xl disabled:opacity-50">{discountValidating ? '...' : 'Aplicar'}</button>
                </div>
                {discountError && <p className="text-[10px] text-red-600">{discountError}</p>}
                {discountPercent && <p className="text-[10px] text-green-600">{discountPercent}% de descuento aplicado: {discountTitle}</p>}

                {selectedServiceIds.length === 0 || !selectedSpecialist || !bookingDate || !bookingTime ? (
                  <p className="text-xs text-[#78716C] text-center py-4 border border-dashed border-[#EADEC9] rounded-xl bg-neutral-50/50">
                    Completa servicios, especialista y fecha para continuar.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {session && session.role === 'cliente' ? (
                      <div className="space-y-3">
                        <p className="text-xs text-[#78716C]">Sesión activa: <strong>{session.name}</strong> ({session.phone})</p>
                        <button
                          onClick={() => createAppointment(session.id, session.name)}
                          disabled={isSubmitting}
                          className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl"
                        >
                          {isSubmitting ? 'Procesando...' : 'Confirmar Reserva'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {bookingStep === 'selection' && (
                          <button onClick={() => setBookingStep('auth')} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">
                            Continuar e Identificarse
                          </button>
                        )}

                        {bookingStep === 'auth' && (
                          <form onSubmit={handleCheckAuthBooking} className="space-y-3">
                            <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Celular del Cliente</label>
                            <input type="tel" inputMode="numeric" required maxLength={10} placeholder="Ej: 3001234567" value={bookingPhone} onChange={handlePhoneInputChange(setBookingPhone)} className="w-full p-2.5 border rounded-xl text-xs" />
                            {submitError && <p className="text-[10px] text-red-600 bg-red-50 p-2 rounded-lg">{submitError}</p>}
                            <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">
                              {isSubmitting ? 'Verificando...' : 'Continuar'}
                            </button>
                          </form>
                        )}

                        {bookingStep === 'register' && (
                          <form onSubmit={handleRegisterAndBookBooking} className="space-y-3">
                            <input type="text" required maxLength={60} placeholder="Nombre Completo" value={bookingName} onChange={(e) => setBookingName(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" />
                            <div className="grid grid-cols-2 gap-3">
                              <input type="number" required min={0} max={120} placeholder="Edad" value={bookingAge} onChange={(e) => setBookingAge(e.target.value)} className="p-2.5 border rounded-xl text-xs" />
                              <select value={bookingGender} onChange={(e) => setBookingGender(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white">
                                <option value="Femenino">Femenino</option>
                                <option value="Masculino">Masculino</option>
                              </select>
                            </div>
                            {submitError && <p className="text-[10px] text-red-600 bg-red-50 p-2 rounded-lg">{submitError}</p>}
                            <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">
                              {isSubmitting ? 'Procesando...' : 'Registrarse & Confirmar'}
                            </button>
                          </form>
                        )}
                      </>
                    )}

                    {bookingStep === 'success' && (
                      <div className="text-center py-4 text-xs space-y-1 text-[#3B0019]">
                        <p className="font-bold text-base">¡Cita Registrada!</p>
                        <p className="text-[#78716C]">Reserva #{createdAppointment?.appointmentId || createdAppointment?.id} creada. Redirigiendo a WhatsApp...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </main>

          {/* BARRA FLOTANTE MÓVIL */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FDFBF7]/90 border-t border-[#EADEC9]/30 p-4 z-30">
            <button
              onClick={() => { if (selectedServiceIds.length > 0) { setBookingStep('selection'); setIsBookingOpen(true); } }}
              disabled={selectedServiceIds.length === 0}
              className="w-full py-3.5 bg-[#5C0632] disabled:bg-neutral-300 text-white font-medium rounded-xl text-xs"
            >
              Reservar {selectedServiceIds.length} Ritual(es) ({getFormattedTotal()})
            </button>
          </div>

          {/* DRAWER MÓVIL */}
          {isBookingOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/40">
              <div className="absolute inset-0" onClick={() => { if (bookingStep !== 'success') setIsBookingOpen(false); }}></div>
              <div className="bg-[#FDFBF7] w-full rounded-t-3xl p-6 relative z-10 space-y-4 max-h-[85vh] overflow-y-auto border-t border-[#EADEC9] text-left">
                <div className="flex justify-between items-center">
                  <h3 className="serif-title text-lg text-[#3B0019]">Confirmar Reserva</h3>
                  <button type="button" onClick={() => setIsBookingOpen(false)} className="w-7 h-7 bg-neutral-200/50 rounded-full text-xs">✕</button>
                </div>

                {/* Codigo descuento movil */}
                <div className="flex gap-2">
                  <input type="text" placeholder="Codigo de descuento" value={discountCode} onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setDiscountPercent(null); setDiscountTitle(null); setDiscountError(null); }} className="flex-1 p-2.5 border rounded-xl text-xs uppercase" />
                  <button type="button" onClick={handleValidateDiscount} disabled={discountValidating || !discountCode.trim()} className="px-3 py-2.5 bg-[#A68F63] text-white text-xs font-semibold rounded-xl disabled:opacity-50">{discountValidating ? '...' : 'Aplicar'}</button>
                </div>
                {discountError && <p className="text-[10px] text-red-600">{discountError}</p>}
                {discountPercent && <p className="text-[10px] text-green-600 font-semibold">-{discountPercent}% {discountTitle} | Total: {getFormattedTotal()}</p>}

                {session && session.role === 'cliente' ? (
                  <div className="space-y-3 text-xs">
                    <p>Sesión activa: <strong>{session.name}</strong></p>
                    <button onClick={() => createAppointment(session.id, session.name)} disabled={isSubmitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">
                      {isSubmitting ? 'Procesando...' : 'Confirmar Reserva'}
                    </button>
                  </div>
                ) : (
                  <>
                    {bookingStep === 'selection' && (
                      <button onClick={() => setBookingStep('auth')} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">Siguiente</button>
                    )}

                    {bookingStep === 'auth' && (
                      <form onSubmit={handleCheckAuthBooking} className="space-y-3">
                        <input type="tel" inputMode="numeric" required maxLength={10} placeholder="Celular" value={bookingPhone} onChange={handlePhoneInputChange(setBookingPhone)} className="w-full p-2.5 border rounded-xl text-xs" />
                        {submitError && <p className="text-[10px] text-red-600">{submitError}</p>}
                        <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">Verificar</button>
                      </form>
                    )}

                    {bookingStep === 'register' && (
                      <form onSubmit={handleRegisterAndBookBooking} className="space-y-3">
                        <input type="text" required maxLength={60} placeholder="Nombre Completo" value={bookingName} onChange={(e) => setBookingName(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" />
                        <input type="number" required min={0} max={120} placeholder="Edad" value={bookingAge} onChange={(e) => setBookingAge(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" />
                        {submitError && <p className="text-[10px] text-red-600">{submitError}</p>}
                        <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">Registrarse & Confirmar</button>
                      </form>
                    )}
                  </>
                )}

                {bookingStep === 'success' && (
                  <div className="text-center py-4 text-xs space-y-1 text-[#3B0019]">
                    <p className="font-bold text-base">¡Cita Agendada!</p>
                    <p>Reserva #{createdAppointment?.appointmentId || createdAppointment?.id} creada. Redirigiendo a WhatsApp...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* LOGIN MODAL */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="absolute inset-0" onClick={() => { if (!authSubmitting) setIsLoginOpen(false); }}></div>
          <div className="bg-[#FDFBF7] w-full max-w-sm rounded-3xl p-6 relative z-10 border border-[#EADEC9]/60 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex justify-between items-start">
              <div className="flex flex-col text-left">
                <span className="serif-title text-xl text-[#3B0019]">
                  {loginMode === 'client' ? 'Iniciar Sesión' : 'Portal Staff'}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold">
                  {loginMode === 'client' ? 'Bienestar WineSpa' : 'Acceso de Equipo'}
                </span>
              </div>
              <button type="button" onClick={() => setIsLoginOpen(false)} className="w-7 h-7 bg-neutral-200/50 rounded-full text-xs">✕</button>
            </div>

            {authError && <p className="text-[10px] text-red-600 bg-red-50 p-2.5 rounded-xl">{authError}</p>}

            {loginMode === 'client' ? (
              <form onSubmit={handleClientAuth} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Celular</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    placeholder="Ej: 3001234567"
                    value={phoneInput}
                    onChange={handlePhoneInputChange(setPhoneInput)}
                    className="w-full p-2.5 border border-[#EADEC9]/60 rounded-xl text-xs bg-white"
                  />
                </div>

                {showClientRegister && (
                  <div className="space-y-3 pt-2 border-t border-[#EADEC9]/20 animate-fade-in text-left">
                    <p className="text-[10px] text-[#A68F63] font-semibold">Crea tu cuenta de Cliente:</p>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-[#78716C] block">Nombre Completo</label>
                      <input type="text" required maxLength={60} value={clientNameInput} onChange={(e) => setClientNameInput(e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-[#78716C] block">Edad</label>
                        <input type="number" required min={0} max={120} value={clientAgeInput} onChange={(e) => setClientAgeInput(e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-[#78716C] block">Género</label>
                        <select value={clientGenderInput} onChange={(e) => setClientGenderInput(e.target.value)} className="w-full p-2 border rounded-lg text-xs bg-white">
                          <option value="Femenino">Femenino</option>
                          <option value="Masculino">Masculino</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={authSubmitting} className="w-full py-3 bg-[#5C0632] hover:bg-[#3B0019] text-white text-xs font-semibold rounded-xl">
                  {authSubmitting ? 'Procesando...' : showClientRegister ? 'Registrarse & Acceder' : 'Continuar'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleStaffLogin} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Usuario</label>
                  <input type="text" required maxLength={30} placeholder="Usuario" value={staffUser} onChange={(e) => setStaffUser(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#A68F63] font-bold block">Contraseña</label>
                  <input type="password" required maxLength={64} placeholder="••••••••" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white" />
                </div>
                <button type="submit" disabled={authSubmitting} className="w-full py-3 bg-[#5C0632] hover:bg-[#3B0019] text-white text-xs font-semibold rounded-xl">
                  {authSubmitting ? 'Iniciando Sesión...' : 'Entrar'}
                </button>
              </form>
            )}

            <div className="pt-3 border-t border-[#EADEC9]/20 text-center">
              <button
                onClick={() => {
                  setAuthError(null);
                  setLoginMode(loginMode === 'client' ? 'staff' : 'client');
                }}
                className="text-[10px] font-bold text-[#8E1B54] hover:underline"
              >
                {loginMode === 'client' ? '¿Eres personal del Spa? Acceso Equipo' : '¿Volver al Portal de Clientes?'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'terms' && <TerminosCondiciones onBack={() => setView('landing')} />}
      {view === 'privacy' && <PoliticaPrivacidad onBack={() => setView('landing')} />}
      {view === 'cancellation' && <PoliticaCancelacion onBack={() => setView('landing')} />}

      {/* FOOTER */}
      <footer className="py-8 px-6 bg-[#F7F3EB]/70 border-t border-[#EADEC9]/30 text-center space-y-3 mt-auto">
        <span className="serif-title text-base text-[#3B0019] block">WineSpa</span>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-1.5 text-[10px] text-[#78716C]">
          {SEDES.map((sede) => (
            <span key={sede.nombre}>{sede.nombre} • {sede.direccion} • {sede.telefono}</span>
          ))}
        </div>
        <p className="text-[10px] text-[#78716C]">Lunes a Sábado: 9:00 AM - 8:00 PM</p>
        <div className="flex justify-center gap-4 pt-1">
          <button onClick={() => setView('terms')} className="text-[10px] text-[#A68F63] hover:text-[#5C0632] hover:underline">Términos y Condiciones</button>
          <button onClick={() => setView('privacy')} className="text-[10px] text-[#A68F63] hover:text-[#5C0632] hover:underline">Política de Privacidad</button>
          <button onClick={() => setView('cancellation')} className="text-[10px] text-[#A68F63] hover:text-[#5C0632] hover:underline">Política de Cancelación</button>
        </div>
      </footer>
    </div>
  );
}
