import React, { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { AdminDashboard } from './features/admin/views/AdminDashboard'
import { StylistAgenda } from './features/manicurista/views/StylistAgenda'
import { TerminosCondiciones, PoliticaPrivacidad, PoliticaCancelacion } from './features/legal/LegalPages'
import { DatePicker } from './components/DatePicker'

interface Service {
  id: string | number;
  name: string;
  price: string | number;
  durationInMinutes?: string | number;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  category?: string;
}

interface Manicurist {
  id: string | number;
  name: string;
  role?: string;
  age?: number;
  avatarUrl?: string;
  avatarPath?: string;
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
const toDateLabel = (isoDate: string) => (isoDate || '').slice(0, 10);
const toTimeLabel = (isoDate: string) => (isoDate || '').slice(11, 16);

// Horario del local (confirmado con el negocio, perfil de WhatsApp Business).
// 0=Domingo..6=Sabado. Debe coincidir con BUSINESS_HOURS en
// backend/src/controllers/client.controller.ts.
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
// horario del local, el turno de la manicurista (si tiene uno asignado) y
// descartando los que se solapan con `busy` (rangos en minutos desde
// medianoche, ya filtrados a la manicurista/fecha elegida) o que ya pasaron
// si la fecha es hoy. Debe reflejar exactamente las mismas reglas que el
// backend (isWithinBusinessHours / isWithinManicuristShift en
// client.controller.ts) -- si un horario no pasaria esas validaciones, no
// tiene que aparecer aca como opcion; el usuario no deberia enterarse del
// rechazo recien al confirmar.
const getAvailableSlots = (
  dateStr: string,
  durationMinutes: number,
  busy: { start: number; end: number }[],
  shift?: { startTime: string; endTime: string } | null,
): string[] => {
  if (!dateStr || !durationMinutes) return [];
  const dayOfWeek = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
  const hours = BUSINESS_HOURS[dayOfWeek];
  if (!hours) return [];
  let openMin = timeToMinutes(hours.open);
  let closeMin = timeToMinutes(hours.close);
  if (shift) {
    openMin = Math.max(openMin, timeToMinutes(shift.startTime));
    closeMin = Math.min(closeMin, timeToMinutes(shift.endTime));
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMin = dateStr === todayStr ? now.getHours() * 60 + now.getMinutes() : -1;

  const slots: string[] = [];
  for (let start = openMin; start + durationMinutes <= closeMin; start += SLOT_STEP_MINUTES) {
    if (start < nowMin) continue;
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

// EXPERIMENTAL -- rama de testeo. Hero con parallax ligado al scroll (motion/react):
// la imagen se desplaza y se atenua a medida que el usuario baja, el texto entra
// escalonado al montar. Si se valida, migrar el patron a un componente reusable
// en vez de dejarlo inline aca.
const heroTextVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const heroItemVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

const HeroScrollSection: React.FC<{ heroImage: string; onBook: () => void }> = ({ heroImage, onBook }) => {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const imageOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.35]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={heroRef} className="max-w-7xl mx-auto px-6 pt-10 md:pt-20 grid grid-cols-1 md:grid-cols-12 gap-8 items-center overflow-hidden">
      <motion.div
        className="md:col-span-6 space-y-6 text-left"
        style={{ y: textY, opacity: textOpacity }}
        variants={heroTextVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={heroItemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D8C7A9]/40 bg-[#F7F3EB]/60">
          <span className="w-1.5 h-1.5 bg-[#8E1B54] rounded-full"></span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-[#8D774C] font-semibold">Experiencia Premium</span>
        </motion.div>
        <motion.h1 variants={heroItemVariants} className="serif-title text-5xl md:text-6xl leading-[1.1] text-[#3B0019] font-light tracking-tight">
          El arte de <br />
          <span className="italic font-normal text-[#8E1B54]">consentir</span> tus <br />
          manos y pies.
        </motion.h1>
        <motion.p variants={heroItemVariants} className="text-[#57534E] text-xs leading-relaxed max-w-sm font-light">
          Un spa boutique premium donde combinamos las mejores técnicas de nail design con el placer de una selecta copa de vino en un ambiente de confort absoluto.
        </motion.p>
        <motion.div variants={heroItemVariants} className="pt-2">
          <button
            onClick={onBook}
            className="px-8 py-4 bg-[#5C0632] hover:bg-[#3B0019] text-white font-medium rounded-xl text-xs tracking-wider uppercase shadow-lg transition-all"
          >
            Reservar una Experiencia
          </button>
        </motion.div>
      </motion.div>

      <motion.div
        className="md:col-span-6 relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3] md:aspect-square"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.img
          src={heroImage}
          alt="Trabajo de uñas WineSpa"
          className="w-full h-full object-cover"
          style={{ y: imageY, scale: imageScale, opacity: imageOpacity }}
        />
      </motion.div>
    </section>
  );
};

const WineSpaExperienceSection: React.FC<{ experienceImage: string; onBook: () => void }> = ({ experienceImage, onBook }) => {
  return (
    <section className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-12 items-center text-left">
      <div className="md:col-span-6">
        <motion.div
          className="aspect-[4/3] md:aspect-video w-full rounded-2xl overflow-hidden shadow-lg border border-[#EADEC9]/40 bg-neutral-100"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={experienceImage} alt="Interior de Wine Nails Spa" className="w-full h-full object-cover hover:scale-103 transition-transform duration-700 ease-out" />
        </motion.div>
      </div>

      <motion.div
        className="md:col-span-6 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="text-[10px] tracking-widest uppercase text-[#A68F63] font-bold">La Experiencia</span>
        <h2 className="serif-title text-3xl md:text-4xl text-[#3B0019] font-light leading-tight">
          Un Refugio Diseñado para tu <span className="italic font-normal text-[#8E1B54]">Bienestar</span>
        </h2>
        <p className="text-xs text-[#57534E] leading-relaxed font-light">
          En WineSpa fusionamos la delicadeza del cuidado de manos y pies con el ritual relajante del vino. Creamos un ambiente exclusivo para desconectarte del día a día.
        </p>

        <div className="space-y-4 pt-2">
          {[
            {
              title: "Nail Art & Cuidado Boutique",
              desc: "Esmaltados semipermanentes y tradicionales con los más altos estándares de higiene y diseño de vanguardia."
            },
            {
              title: "Espacio de Confort Acústico",
              desc: "Aromas de lavanda, iluminación cálida y música relajante pensados para mimar tus sentidos."
            }
          ].map((item, idx) => (
            <div key={idx} className="flex gap-4">
              <span className="w-5 h-5 rounded-full bg-[#5C0632]/5 text-[#8E1B54] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <h4 className="text-xs font-semibold text-[#3B0019]">{item.title}</h4>
                <p className="text-[11px] text-[#78716C] font-light mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2">
          <button
            onClick={onBook}
            className="px-6 py-3 bg-[#8E1B54] hover:bg-[#5C0632] text-white text-xs font-semibold rounded-xl shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            Reservar Cita en Línea
          </button>
        </div>
      </motion.div>
    </section>
  );
};

export default function App() {
  // PERSISTENCIA DE SESION
  const [session, setSession] = useState<UserSession | null>(null);

  // VISTA ACTIVA: 'landing' | 'booking' | 'clientPortal' | 'terms' | 'privacy' | 'cancellation'
  const [view, setView] = useState<'landing' | 'booking' | 'clientPortal' | 'servicesCatalog' | 'terms' | 'privacy' | 'cancellation'>('landing');

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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string | null>(null);
  const [zoomedAvatar, setZoomedAvatar] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [manicuristShifts, setManicuristShifts] = useState<Record<string, { startTime: string; endTime: string } | null>>({});

  // Estados para Imágenes Dinámicas del Home/Landing
  const [heroImage, setHeroImage] = useState('/hero_1.jpg');
  const [experienceImage, setExperienceImage] = useState('/winespa_interior_1.jpg');

  // Control de Modales Booking
  const [isBookingOpen, setIsBookingOpen] = useState(false); // Móvil

  // Wizard mobile: paso actual (1=servicios, 2=manicurista, 3=fecha/hora)
  const [bookingWizardStep, setBookingWizardStep] = useState(1);
  const [svcSearch, setSvcSearch] = useState('');
  const [manSearch, setManSearch] = useState('');
  const [svcPage, setSvcPage] = useState(1);
  const [manPage, setManPage] = useState(1);
  const PER_PAGE = 5;
  const [showDiscount, setShowDiscount] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(true);

  // Flujo Drawer Booking (Mobile/Inline): 'selection' | 'auth' | 'register' | 'success'
  const [bookingStep, setBookingStep] = useState<'selection' | 'auth' | 'register' | 'success'>('selection');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingName, setBookingName] = useState('');
  const [bookingAge, setBookingAge] = useState('');
  const [bookingGender, setBookingGender] = useState('Femenino');

  const handleGoToBooking = () => {
    setBookingStep('selection');
    if (session && session.role === 'cliente') {
      setBookingPhone(session.phone || '');
      setBookingName(session.name || '');
    }
    setView('booking');
  };

  // Envío Cita
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<AppointmentResponse | null>(null);
  // Sesion armada con los datos de la reserva (flujo invitado, sin login real) para el boton "Ver mi cita"
  const [postBookingSession, setPostBookingSession] = useState<UserSession | null>(null);

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

  const [portalToast, setPortalToast] = useState<{ msg: string; ok: boolean } | null>(null);

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

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, [view]);

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
      setBookingWizardStep(1);
      setBookingStep('selection');
      setSvcSearch('');
      setManSearch('');
      setSvcPage(1);
      setManPage(1);
      fetchManicurists().then(fresh => {
        if (fresh.length > 0) setManicurists(fresh);
      });
    }
  }, [view]);

  useEffect(() => {
    if (portalToast) {
      const t = setTimeout(() => setPortalToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [portalToast]);

  useEffect(() => { setPortalToast(null); }, [view]);

  // Trae el turno asignado (si existe) a cada manicurista para la fecha elegida,
  // para mostrarlo como dato al elegir manicurista (no filtra a nadie: sin turno
  // asignado se interpreta como "sin restriccion", el backend hace lo mismo).
  useEffect(() => {
    if (!bookingDate) { setManicuristShifts({}); return; }
    let cancelled = false;
    fetch(`${API_URL}/api/manicurists?date=${bookingDate}`)
      .then(res => res.ok ? res.json() : [])
      .then((data: any[]) => {
        if (cancelled) return;
        const map: Record<string, { startTime: string; endTime: string } | null> = {};
        (data || []).forEach(m => { map[String(m.id)] = m.shift || null; });
        setManicuristShifts(map);
      })
      .catch(() => { if (!cancelled) setManicuristShifts({}); });
    return () => { cancelled = true; };
  }, [bookingDate]);

  // Recalcula los horarios disponibles (dentro del horario del local y del
  // turno de la manicurista, sin choques con citas ya agendadas ni horarios
  // ya pasados hoy) cada vez que cambian fecha, especialista o servicios elegidos.
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
    fetch(`${API_URL}/api/appointments?date=${bookingDate}&manicuristId=${selectedSpecialist}`)
      .then(res => res.ok ? res.json() : [])
      .then((occupied: { date: string; totalDuration: number }[]) => {
        if (cancelled) return;
        const busy = occupied.map(a => {
          const start = timeToMinutes(toTimeLabel(a.date));
          return { start, end: start + a.totalDuration };
        });
        const slots = getAvailableSlots(bookingDate, totalDuration, busy, manicuristShifts[selectedSpecialist]);
        setAvailableSlots(slots);
        if (bookingTime && !slots.includes(bookingTime)) setBookingTime('');
      })
      .catch(() => { if (!cancelled) setAvailableSlots([]); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });

    return () => { cancelled = true; };
  }, [bookingDate, selectedSpecialist, selectedServiceIds, services, manicuristShifts]);

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
    Promise.all([
      fetch(`${API_URL}/api/appointments?date=${newDateInput}&manicuristId=${editingAppt.manicuristId}&excludeId=${editingAppt.id}`)
        .then(res => res.ok ? res.json() : []) as Promise<{ date: string; totalDuration: number }[]>,
      fetch(`${API_URL}/api/manicurists?date=${newDateInput}`)
        .then(res => res.ok ? res.json() : []) as Promise<any[]>,
    ])
      .then(([occupied, manicuristsData]) => {
        if (cancelled) return;
        const busy = occupied.map(a => {
          const start = timeToMinutes(toTimeLabel(a.date));
          return { start, end: start + a.totalDuration };
        });
        const shift = (manicuristsData || []).find(m => String(m.id) === String(editingAppt.manicuristId))?.shift || null;
        const slots = getAvailableSlots(newDateInput, totalDuration, busy, shift);
        setRescheduleSlots(slots);
        if (newTimeInput && !slots.includes(newTimeInput)) setNewTimeInput('');
      })
      .catch(() => { if (!cancelled) setRescheduleSlots([]); })
      .finally(() => { if (!cancelled) setLoadingRescheduleSlots(false); });

    return () => { cancelled = true; };
  }, [editingAppointmentId, newDateInput, clientAppointments]);

  const fetchManicurists = async (): Promise<Manicurist[]> => {
    try {
      const res = await fetch(`${API_URL}/api/manicurists`);
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
      { id: '1', name: 'Sofía Valenzuela', role: 'Master Nail Artist', age: 26 },
      { id: '2', name: 'Camila Ortega', role: 'Especialista en Pedicura', age: 29 }
    ];

    try {
      setLoading(true);
      setError(null);

      let fetchedServices: Service[] = [];
      let fetchedManicurists: Manicurist[] = [];

      try {
        const servicesRes = await fetch(`${API_URL}/api/services`);
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
        const offersRes = await fetch(`${API_URL}/api/offers`);
        if (offersRes.ok) {
          setOffers(await offersRes.json());
        } else {
          setOffers([]);
        }
      } catch {
        setOffers([]);
      }

      try {
        const landingRes = await fetch(`${API_URL}/api/landing/content`);
        if (!landingRes.ok) throw new Error();
        const items: { type: string; title: string; description?: string | null; imageUrl: string; order?: number }[] = await landingRes.json();
        
        // Extract Hero Image
        const heroItem = items.find((i) => i.type === 'HERO');
        if (heroItem) {
          setHeroImage(heroItem.imageUrl.startsWith('/uploads') ? `${API_URL}${heroItem.imageUrl}` : heroItem.imageUrl);
        } else {
          setHeroImage('/hero_1.jpg');
        }

        // Extract Experience Image
        const expItem = items.find((i) => i.type === 'EXPERIENCE');
        if (expItem) {
          setExperienceImage(expItem.imageUrl.startsWith('/uploads') ? `${API_URL}${expItem.imageUrl}` : expItem.imageUrl);
        } else {
          setExperienceImage('/winespa_interior_1.jpg');
        }

        const carousel = items
          .filter((i) => i.type === 'CAROUSEL')
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        if (carousel.length === 0) throw new Error();
        setLandingContent({
          images: carousel.map((i) => i.imageUrl.startsWith('/uploads') ? `${API_URL}${i.imageUrl}` : i.imageUrl),
          news: carousel.map((i) => ({ title: i.title, description: i.description || '' })),
        });
      } catch {
        setHeroImage('/hero_1.jpg');
        setExperienceImage('/winespa_interior_1.jpg');
        setLandingContent({
          images: [
            '/hero_1.jpg',
            '/hero_2.jpg',
            '/hero_3.jpg'
          ],
          news: [
            { title: 'Inauguración El Poblado', description: 'Disfruta de nuestras nuevas estaciones boutique con aromaterapia.' },
            { title: 'Ritual de Bienvenida', description: 'Conocé nuestros tratamientos de manicura y pedicura boutique.' }
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
      const res = await fetch(`${API_URL}/api/appointments?clientId=${session.id}`);
      if (res.ok) {
        const data = await res.json();
        setClientAppointments(data);
      }
    } catch {
      setClientAppointments([]);
    }
  };

  const handleCancelAppointment = async (id: string | number) => {
    if (!window.confirm('¿Seguro que deseas cancelar esta cita?')) return;
    try {
      const res = await fetch(`${API_URL}/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      if (res.ok) {
        setPortalToast({ msg: 'Cita cancelada con exito.', ok: true });
        fetchClientAppointments();
      } else {
        const errData = await res.json().catch(() => null);
        setPortalToast({ msg: errData?.error || 'No se pudo cancelar la cita.', ok: false });
      }
    } catch {
      setPortalToast({ msg: 'Error de conexion al cancelar.', ok: false });
    }
  };

  const handleUpdateSchedule = async (id: string | number) => {
    if (!newDateInput || !newTimeInput) {
      setPortalToast({ msg: 'Por favor ingresa fecha y hora.', ok: false });
      return;
    }
    setIsUpdatingSchedule(true);
    try {
      const res = await fetch(`${API_URL}/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Concatenacion directa: `new Date(...).toISOString()` interpretaba el string
        // como hora local del navegador y corria la hora guardada.
        body: JSON.stringify({ date: `${newDateInput}T${newTimeInput}:00.000Z` })
      });
      if (res.ok) {
        setPortalToast({ msg: 'Horario modificado con exito.', ok: true });
        setEditingAppointmentId(null);
        fetchClientAppointments();
      } else {
        setPortalToast({ msg: 'No se pudo modificar el horario.', ok: false });
      }
    } catch {
      setPortalToast({ msg: 'Error de conexion al modificar.', ok: false });
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

  // Nombres de persona: solo letras (con tildes/enie), espacios, apostrofe y guion.
  // Nada de digitos ni simbolos -- evita que alguien meta basura en un campo de nombre.
  const handleNameInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, ''));
  };

  // Trae los datos reales de una cuenta existente por telefono. Se usa al
  // recuperarnos de un 409 en el registro, para no quedarnos con el nombre
  // que se acaba de escribir (que puede no ser el dueño real del numero).
  const fetchClientByPhone = async (phone: string): Promise<{ id: string; name: string } | null> => {
    try {
      const res = await fetch(`${API_URL}/api/clients/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      const client = data.client || data;
      if (res.ok && (data.exists || data.client) && (client.id || client._id)) {
        return { id: String(client.id || client._id), name: client.name || 'Cliente' };
      }
      return null;
    } catch {
      return null;
    }
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
        const response = await fetch(`${API_URL}/api/clients/auth`, {
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
        const clientRes = await fetch(`${API_URL}/api/clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneInput,
            name: clientNameInput,
            age: parseInt(clientAgeInput),
            gender: clientGenderInput
          })
        });

        if (!clientRes.ok) {
          const errData = await clientRes.json().catch(() => null);
          // El numero ya tiene cuenta (caso tipico: cliente antiguo cuyo
          // telefono quedo guardado en otro formato). Solo recuperamos la
          // sesion si esa cuenta es realmente de tipo CLIENTE (fetchClientByPhone
          // lo confirma) -- si el numero en realidad es de un admin/manicurista,
          // no hay cuenta de cliente valida a la que loguear, y mostramos el error.
          const existingClient = clientRes.status === 409 && errData?.clientId
            ? await fetchClientByPhone(phoneInput)
            : null;
          if (existingClient) {
            const user: UserSession = {
              id: existingClient.id,
              name: existingClient.name,
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
            return;
          }
          throw new Error(errData?.error || 'Error al registrar tu cuenta.');
        }

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
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: staffUser, password: staffPassword })
      });

      if (res.ok) {
        const data = await res.json();
        const userData = data.user || data;
        const token = data.token;

        if (token) {
          localStorage.setItem('winespa_token', token);
        }

        const apiRole = String(userData.role || '').toLowerCase();
        let roleVal: 'admin' | 'manicurista' = 'manicurista';
        if (apiRole.includes('admin') || apiRole.includes('director') || apiRole.includes('owner')) {
          roleVal = 'admin';
        } else if (apiRole.includes('manic') || apiRole.includes('stylist') || apiRole.includes('colab') || apiRole.includes('profesional')) {
          roleVal = 'manicurista';
        } else {
          roleVal = staffUser.toLowerCase().includes('admin') ? 'admin' : 'manicurista';
        }

        const user: UserSession = {
          id: String(userData.id || userData._id || 'staff'),
          name: userData.name || staffUser,
          role: roleVal,
          avatarUrl: userData.avatarUrl
        };
        setSession(user);
        localStorage.setItem('winespa_session', JSON.stringify(user));
        setIsLoginOpen(false);
        setStaffUser('');
        setStaffPassword('');
      } else {
        throw new Error('Credenciales invalidas.');
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
    localStorage.removeItem('winespa_token');
    setView('landing');
    setSelectedServiceIds([]);
    setSelectedSpecialist(null);
    setBookingDate('');
    setBookingTime('');
    setDiscountCode('');
    setDiscountPercent(null);
    setDiscountTitle(null);
    setDiscountError(null);
    setClientAppointments([]);
    setBookingStep('selection');
    setIsBookingOpen(false);
  };

  const resetBooking = () => {
    setSelectedServiceIds([]);
    setSelectedSpecialist(null);
    setBookingDate('');
    setBookingTime('');
    setDiscountCode('');
    setDiscountPercent(null);
    setDiscountTitle(null);
    setDiscountError(null);
    setBookingStep('selection');
    setBookingWizardStep(1);
    setBookingPhone('');
    setBookingName('');
    setBookingAge('');
    setSubmitError(null);
    setIsBookingOpen(false);
    setSvcSearch('');
    setManSearch('');
    setSvcPage(1);
    setManPage(1);
  };

  const handleConfirmLoggedInBooking = async () => {
    if (!session) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createAppointment(session.id, session.name);
    } catch (err: any) {
      setSubmitError(err.message || 'No se pudo confirmar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewMyAppointment = () => {
    if (!session && postBookingSession) {
      setSession(postBookingSession);
      localStorage.setItem('winespa_session', JSON.stringify(postBookingSession));
    }
    setView('clientPortal');
    resetBooking();
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
      const response = await fetch(`${API_URL}/api/clients/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: bookingPhone })
      });

      const data = await response.json();

      if (response.ok && (data.exists || data.client)) {
        const client = data.client || data;
        try {
          await createAppointment(String(client.id || client._id), client.name);
        } catch (err: any) {
          // El telefono si tiene cuenta -- si falla, es un problema real de la
          // reserva (horario, servicio, etc.), no un cliente nuevo. No lo mandes
          // a "register" ni le prellenes ese nombre en un formulario que no es suyo.
          setSubmitError(err.message || 'No se pudo confirmar la reserva.');
        }
      } else {
        setBookingName('');
        setBookingStep('register');
      }
    } catch {
      setSubmitError('Error al verificar el numero. Intenta de nuevo.');
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
      const clientRes = await fetch(`${API_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: bookingPhone,
          name: bookingName,
          age: parseInt(bookingAge),
          gender: bookingGender
        })
      });

      if (!clientRes.ok) {
        const errData = await clientRes.json().catch(() => null);
        // Numero ya registrado (cliente antiguo guardado en otro formato de
        // telefono): reservamos igual, pero solo si esa cuenta es realmente
        // de tipo CLIENTE. Si el numero en realidad es de un admin/manicurista,
        // no hay cuenta de cliente valida y mostramos el error tal cual.
        if (clientRes.status === 409 && errData?.clientId) {
          const existingClient = await fetchClientByPhone(bookingPhone);
          if (existingClient) {
            await createAppointment(existingClient.id, existingClient.name);
            return;
          }
        }
        throw new Error(errData?.error || 'Error al registrar.');
      }

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
      const apptRes = await fetch(`${API_URL}/api/appointments`, {
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

      if (apptRes.status === 201 || apptRes.ok) {
        const apptData = await apptRes.json();
        setCreatedAppointment(apptData);
        setBookingStep('success');

        // Limpiamos la seleccion del wizard ya mismo (no solo tras el
        // resetBooking() del flujo logueado, que corre recien a los 2200ms):
        // si el invitado cierra la pantalla de exito sin usar "Ver mi cita",
        // volveria a ver el mismo servicio/especialista/horario ya elegidos
        // -- y ese horario, recien tomado, ahora falla como solapado.
        setSelectedServiceIds([]);
        setSelectedSpecialist(null);
        setBookingDate('');
        setBookingTime('');
        setDiscountCode('');
        setDiscountPercent(null);
        setDiscountTitle(null);
        setDiscountError(null);
        setBookingWizardStep(1);
        setSvcSearch('');
        setManSearch('');
        setSvcPage(1);
        setManPage(1);

        if (session && session.role === 'cliente') {
          // Ya estaba logueado: lo llevamos directo a ver la cita en su perfil.
          setTimeout(() => {
            fetchClientAppointments();
            setView('clientPortal');
            resetBooking();
          }, 2200);
        } else {
          // Reservo como invitado (auth por telefono o registro rapido): no lo logueamos
          // automaticamente, pero dejamos la sesion lista para el boton "Ver mi cita".
          setPostBookingSession({ id: clientId, name, role: 'cliente', phone: bookingPhone });
        }

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

        const whatsappNumber = '+57 319 707 2921'.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        
        setTimeout(() => {
          window.open(whatsappUrl, '_blank');
        }, 1800);
      } else {
        const errData = await apptRes.json().catch(() => null);
        throw new Error(errData?.error || 'Error en el servidor al registrar cita.');
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
      const res = await fetch(`${API_URL}/api/offers/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim().toUpperCase(), phone: session?.phone || bookingPhone || undefined }),
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
    setSelectedServiceIds(prev => {
      if (prev.includes(idStr)) return prev.filter(x => x !== idStr);

      // Dos servicios de la misma categoria no se pueden agendar juntos (lo
      // rechaza el backend). En vez de dejar que falle al confirmar, al elegir
      // uno nuevo se quita automaticamente el anterior de esa misma categoria.
      const newService = services.find(s => String(s.id) === idStr);
      const category = newService?.category;
      const withoutSameCategory = category
        ? prev.filter(existingId => services.find(s => String(s.id) === existingId)?.category !== category)
        : prev;

      return [...withoutSameCategory, idStr];
    });
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
            <img src="/logo.png" alt="WineSpa Logo" className="w-8 h-8 object-contain" />
            <div className="flex flex-col">
              <span className="serif-title text-2xl font-normal tracking-wider text-[#3B0019] leading-none">WineSpa</span>
              <span className="text-[8px] uppercase tracking-[0.22em] text-[#A68F63] font-semibold">Boutique</span>
            </div>
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
        <motion.div
          className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full space-y-10 text-left"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="flex items-center gap-3">
            <img src="/logo.png" alt="WineSpa Logo" className="w-10 h-10 object-contain" />
            <div className="flex flex-col">
              <h2 className="serif-title text-3xl text-[#3B0019] leading-none">Portal de Bienestar</h2>
              <p className="text-xs text-[#78716C] mt-1">Sincroniza tus turnos y consulta el registro de tus visitas.</p>
            </div>
          </header>

          {portalToast && (
            <div className={`text-xs font-semibold p-3 rounded-xl animate-fade-in ${portalToast.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {portalToast.ok ? '✓' : '✕'} {portalToast.msg}
            </div>
          )}

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
                            <img src={appt.manicurist.avatarPath.startsWith('/') ? `${API_URL}${appt.manicurist.avatarPath}` : appt.manicurist.avatarPath} alt={appt.manicurist.name} className="w-5 h-5 rounded-full object-cover border border-[#EADEC9]" />
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
                              <DatePicker
                                selectedDate={newDateInput}
                                onSelectDate={(d) => { setNewDateInput(d); setNewTimeInput(''); }}
                                className="max-w-[260px] mt-1"
                              />
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
        </motion.div>
      )}

      {/* VISTA 3: LANDING PAGE */}
      {view === 'landing' && (
        <motion.div
          className="space-y-16 pb-16"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Banner CMS como hero visual */}
          {landingContent && landingContent.images && landingContent.images.length > 0 && (
            <div id="promos" className="relative w-full bg-[#3B0019] overflow-hidden">
              <div className="max-w-5xl mx-auto">
                <div className="relative flex flex-col md:flex-row items-center gap-0 md:gap-6">
                  <div className="w-full md:w-3/5 aspect-[21/9] md:aspect-[16/6] relative overflow-hidden bg-neutral-900 cursor-grab active:cursor-grabbing">
                    <motion.img
                      key={activeSlide}
                      src={landingContent.images[activeSlide]}
                      alt="Anuncio"
                      className="w-full h-full object-cover select-none"
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.6}
                      onDragEnd={(_, info) => {
                        const swipe = info.offset.x;
                        const count = landingContent.images.length;
                        if (swipe < -80) {
                          setActiveSlide((activeSlide + 1) % count);
                        } else if (swipe > 80) {
                          setActiveSlide((activeSlide - 1 + count) % count);
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#3B0019]/80 via-transparent to-transparent md:bg-gradient-to-r md:from-[#3B0019]/80 md:via-[#3B0019]/20 md:to-transparent pointer-events-none" />
                  </div>
                  <motion.div
                    key={activeSlide}
                    className="absolute md:relative bottom-0 left-0 right-0 md:flex-1 p-4 md:p-6 text-left z-10"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                  >
                    {landingContent.news && landingContent.news[activeSlide] ? (
                      <>
                        <span className="text-[9px] uppercase tracking-widest text-[#EADEC9] font-bold">Novedad</span>
                        <h3 className="serif-title text-lg md:text-xl text-white font-medium mt-1 leading-snug">{landingContent.news[activeSlide].title}</h3>
                        <p className="text-xs text-[#EADEC9]/80 mt-2 leading-relaxed line-clamp-2">{landingContent.news[activeSlide].description}</p>
                      </>
                    ) : (
                      <h3 className="serif-title text-lg md:text-xl text-white font-medium">Novedades WineSpa</h3>
                    )}
                    <div className="flex gap-2 mt-4">
                      {landingContent.images.map((_, idx) => (
                        <button key={idx} onClick={() => setActiveSlide(idx)} className={`h-2 rounded-full transition-all ${activeSlide === idx ? 'bg-[#8E1B54] w-6' : 'bg-white/40 w-2'}`} />
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          )}

          <HeroScrollSection heroImage={heroImage} onBook={handleGoToBooking} />

          <WineSpaExperienceSection experienceImage={experienceImage} onBook={handleGoToBooking} />

          {/* Servicios Destacados — compacto en landing */}
          <section id="services" className="max-w-7xl mx-auto px-6 space-y-6">
            <motion.div
              className="text-center space-y-1"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="text-[10px] tracking-widest uppercase text-[#A68F63] font-bold">Carta de Rituales</span>
              <h2 className="serif-title text-2xl text-[#3B0019] font-light">Servicios de Uñas & Cuidado Premium</h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const trending = services.filter(s => (s as any).trending);
                const featured = trending.length > 0
                  ? trending.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).slice(0, 3)
                  : [...services].sort((a, b) => (a.name || '').localeCompare(b.name || '')).slice(0, 3);
                return featured.map((s, i) => (
                  <motion.div
                    key={s.id}
                    className="bg-white border border-[#EADEC9]/30 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    initial={{ opacity: 0, y: 32, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="aspect-video relative overflow-hidden bg-neutral-100">
                      <img src={
                        s.imageUrl
                          ? (s.imageUrl.startsWith('/') ? `${API_URL}${s.imageUrl}` : s.imageUrl)
                          : '/hero_1.jpg'
                      } alt={s.name} className="w-full h-full object-cover" />
                      {(s as any).trending && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#8E1B54] text-white text-[8px] font-bold rounded-full">TOP</span>
                      )}
                    </div>
                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between text-left">
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-wider text-[#A68F63] font-bold">{s.durationInMinutes || 60} mins</span>
                        <h3 className="serif-title text-sm text-[#3B0019] font-medium">{s.name}</h3>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-[#EADEC9]/20">
                        <span className="text-sm font-bold text-[#8E1B54]">{typeof s.price === 'number' ? `$${s.price.toLocaleString('es-CO')}` : s.price}</span>
                        <button onClick={() => { setSelectedServiceIds([String(s.id)]); setBookingStep('selection'); setView('booking'); }} className="px-3 py-1 bg-[#5C0632]/5 text-[#5C0632] hover:bg-[#8E1B54] hover:text-white rounded-lg text-[10px] font-bold transition-all">Reservar</button>
                      </div>
                    </div>
                  </motion.div>
                ));
              })()}
            </div>

            <div className="text-center">
              <button onClick={() => setView('servicesCatalog')} className="px-6 py-3 bg-[#5C0632] hover:bg-[#3B0019] text-white text-xs font-semibold rounded-xl shadow-sm">
                Ver Todos los Servicios →
              </button>
            </div>
          </section>
        </motion.div>
      )}

      {/* VISTA: Catálogo Completo de Servicios */}
      {view === 'servicesCatalog' && (
        <motion.div
          className="max-w-7xl mx-auto px-6 py-12 space-y-8 text-left"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => setView('landing')} className="text-xs text-[#A68F63] hover:text-[#5C0632] font-semibold mb-2 inline-block">← Volver al Inicio</button>
              <h1 className="serif-title text-3xl text-[#3B0019]">Carta de Rituales</h1>
              <p className="text-xs text-[#78716C] mt-1">Explora todos nuestros servicios premium de cuidado de uñas.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Buscar servicio..." value={svcSearch} onChange={e => setSvcSearch(e.target.value)} className="p-2.5 border border-[#EADEC9] rounded-xl text-xs flex-1 bg-white" />
            <select value={svcSearch} onChange={e => setSvcSearch(e.target.value)} className="p-2.5 border border-[#EADEC9] rounded-xl text-xs bg-white">
              <option value="">Todas las categorias</option>
              {[...new Set(services.map(s => (s as any).category).filter(Boolean))].map(c => (
                <option key={c as string} value={c as string}>{c as string}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(() => {
              const filtered = services
                .filter(s => !svcSearch || (s.name || '').toLowerCase().includes(svcSearch.toLowerCase()) || ((s as any).category || '').toLowerCase().includes(svcSearch.toLowerCase()))
                .sort((a, b) => {
                  if ((a as any).trending && !(b as any).trending) return -1;
                  if (!(a as any).trending && (b as any).trending) return 1;
                  return (a.name || '').localeCompare(b.name || '');
                });
              if (filtered.length === 0) return <p className="text-xs text-[#78716C] py-12 text-center col-span-full">Sin servicios que coincidan.</p>;
              return filtered.map((s, i) => (
                <motion.div
                  key={s.id}
                  className="bg-white border border-[#EADEC9]/30 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="aspect-video relative overflow-hidden bg-neutral-100">
                    <img src={
                      s.imageUrl
                        ? (s.imageUrl.startsWith('/') ? `${API_URL}${s.imageUrl}` : s.imageUrl)
                        : '/hero_1.jpg'
                    } alt={s.name} className="w-full h-full object-cover" />
                    {(s as any).trending && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#8E1B54] text-white text-[8px] font-bold rounded-full">TOP</span>
                    )}
                  </div>
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between text-left">
                    <div className="space-y-1">
                      {(s as any).category && <span className="text-[8px] uppercase bg-[#F7F3EB] px-1.5 py-0.5 rounded text-[#A68F63] font-semibold">{(s as any).category}</span>}
                      <h3 className="serif-title text-base text-[#3B0019] font-medium mt-1">{s.name}</h3>
                      {s.shortDescription && <p className="text-[10px] italic text-[#A68F63]">{s.shortDescription}</p>}
                      <p className="text-xs text-[#78716C] leading-normal font-light line-clamp-2">{s.description || 'Cuidado integral diseñado para nutrir y estilizar.'}</p>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-[#EADEC9]/20">
                      <span className="text-sm font-bold text-[#8E1B54]">{typeof s.price === 'number' ? `$${s.price.toLocaleString('es-CO')}` : s.price}</span>
                      <button onClick={() => { setSelectedServiceIds([String(s.id)]); setBookingStep('selection'); setView('booking'); }} className="px-3.5 py-1.5 bg-[#5C0632]/5 text-[#5C0632] hover:bg-[#8E1B54] hover:text-white rounded-lg text-[10px] font-bold transition-all">Reservar</button>
                    </div>
                  </div>
                </motion.div>
              ));
            })()}
          </div>
        </motion.div>
      )}

      {/* VISTA 4: FORMULARIO RESERVAS */}
      {view === 'booking' && (
        <motion.div
          className="flex-1 md:grid md:grid-cols-12 min-h-screen relative"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <aside className="hidden md:flex md:flex-col md:col-span-4 bg-[#5C0632]/5 border-r border-[#EADEC9]/30 md:p-8 md:sticky md:top-0 md:h-screen md:overflow-y-auto pt-8">
            <button onClick={() => { resetBooking(); setView(session && session.role === 'cliente' ? 'clientPortal' : 'landing'); }} className="mb-6 bg-white border border-[#EADEC9]/50 px-4 py-2 rounded-xl text-xs font-semibold text-[#5C0632] shadow-sm hover:bg-[#5C0632]/5 transition-colors w-fit">
              ← Volver
            </button>
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="WineSpa Logo" className="w-8 h-8 object-contain" />
                <span className="serif-title text-2xl text-[#3B0019] leading-none">WineSpa Booking</span>
              </div>
              <p className="text-xs text-[#78716C] font-light max-w-xs">
                Configura tu cita boutique. Selecciona tus tratamientos favoritos de la carta, tu manicurista preferida y tus turnos estimados.
              </p>
            </div>

            {activeSpecialistDetails && (
              <div className="p-4 bg-white border border-[#8E1B54]/25 rounded-2xl space-y-3 shadow-xs text-left mb-6">
                <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold block">Manicurista Seleccionada</span>
                <div className="flex items-center gap-3">
                  {activeSpecialistDetails.avatarPath || activeSpecialistDetails.avatarUrl ? (
                    <img src={activeSpecialistDetails.avatarPath?.startsWith('/') ? `${API_URL}${activeSpecialistDetails.avatarPath}` : (activeSpecialistDetails.avatarPath || activeSpecialistDetails.avatarUrl)} alt={activeSpecialistDetails.name} className="w-12 h-12 rounded-full object-cover border border-[#EADEC9]" />
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

            {/* Servicios seleccionados */}
            {selectedServiceIds.length > 0 && (
              <div className="mb-6 space-y-2">
                <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold block">Rituales Seleccionados</span>
                <div className="space-y-1.5">
                  {services.filter(s => selectedServiceIds.includes(String(s.id))).map(s => (
                    <div key={s.id} className="flex justify-between items-center text-[11px]">
                      <span className="text-[#44403C] truncate max-w-[55%]">{s.name} <span className="text-[#A68F63]">· {s.durationInMinutes || 60} min</span></span>
                      <span className="text-[#8E1B54] font-semibold">{typeof s.price === 'number' ? `$${s.price.toLocaleString('es-CO')}` : s.price}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-[#A68F63] pt-0.5">
                  Tiempo aproximado: {services.filter(s => selectedServiceIds.includes(String(s.id))).reduce((sum, s) => sum + (Number(s.durationInMinutes) || 60), 0)} min
                </p>
              </div>
            )}

            {/* Fecha y hora seleccionadas */}
            {bookingDate && bookingTime && (
              <div className="mb-6 space-y-1 text-left">
                <span className="text-[9px] uppercase tracking-wider text-[#A68F63] font-bold block">Cita Programada</span>
                <p className="text-[11px] text-[#3B0019] font-medium">{bookingDate} a las {bookingTime}</p>
              </div>
            )}

            {/* Resumen del Agendamiento */}
            <div className="mt-auto border-t border-[#EADEC9]/30 pt-6 space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="serif-title text-sm text-[#3B0019] font-medium">Total</h3>
                <div className="text-right">
                  <span className="text-xl font-bold text-[#8E1B54]">{getFormattedTotal()}</span>
                  {discountPercent && (
                    <span className="block text-[9px] text-green-600">-{discountPercent}% {discountTitle}</span>
                  )}
                </div>
              </div>

              {/* Codigo descuento — boton revelador */}
              {discountPercent ? (
                <p className="text-[10px] text-green-600 bg-green-50 p-1.5 rounded-lg">
                  {discountPercent}% de descuento aplicado: {discountTitle}
                </p>
              ) : showDiscount ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Codigo de descuento"
                      value={discountCode}
                      onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setDiscountPercent(null); setDiscountTitle(null); setDiscountError(null); }}
                      className="flex-1 p-2.5 border border-[#EADEC9] rounded-xl text-xs uppercase bg-white"
                    />
                    <button type="button" onClick={handleValidateDiscount} disabled={discountValidating || !discountCode.trim()} className="px-4 py-2.5 bg-[#A68F63] text-white text-xs font-semibold rounded-xl disabled:opacity-50">
                      {discountValidating ? '...' : 'Aplicar'}
                    </button>
                  </div>
                  <button onClick={() => setShowDiscount(false)} className="text-[9px] text-[#A68F63] underline">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setShowDiscount(true)} className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold underline text-left">
                  ¿Tienes un codigo de descuento?
                </button>
              )}
              {discountError && <p className="text-[10px] text-red-600 bg-red-50 p-1.5 rounded-lg">{discountError}</p>}

              {selectedServiceIds.length === 0 || !selectedSpecialist || !bookingDate || !bookingTime ? (
                <p className="text-[10px] text-[#78716C] text-center py-3 border border-dashed border-[#EADEC9] rounded-xl bg-neutral-50/50">
                  Completa servicios, especialista y fecha para continuar.
                </p>
              ) : (
                <div className="space-y-3">
                  {session && session.role === 'cliente' ? (
                    <div className="space-y-3">
                      <p className="text-[10px] text-[#78716C]">Sesión activa: <strong>{session.name}</strong> ({session.phone})</p>
                      {submitError && <p className="text-[10px] text-red-600 bg-red-50 p-2 rounded-lg">{submitError}</p>}
                      <button
                        onClick={handleConfirmLoggedInBooking}
                        disabled={isSubmitting}
                        className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl disabled:opacity-60"
                      >
                        {isSubmitting ? 'Procesando...' : 'Confirmar Reserva'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {(bookingStep === 'selection' || bookingStep === 'auth') && (
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
                          <input type="text" required maxLength={60} placeholder="Nombre Completo" value={bookingName} onChange={handleNameInputChange(setBookingName)} className="w-full p-2.5 border rounded-xl text-xs" />
                          <div className="grid grid-cols-2 gap-3">
                            <input type="number" required min={0} max={100} placeholder="Edad" value={bookingAge} onChange={(e) => setBookingAge(e.target.value)} className="p-2.5 border rounded-xl text-xs" />
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

                      {bookingStep === 'success' && (
                        <div className="text-center py-4 text-xs space-y-3 text-[#3B0019]">
                          <p className="font-bold text-base">Cita Agendada</p>
                          <p className="text-[#78716C]">Reserva #{createdAppointment?.appointmentId || createdAppointment?.id} creada. Redirigiendo a WhatsApp...</p>
                          {!session && (
                            <button onClick={handleViewMyAppointment} className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold underline">
                              Ver mi cita
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>

          <main className="md:col-span-8 p-6 md:p-12 space-y-10 pt-16 pb-24 md:pb-10">
            <button onClick={() => { resetBooking(); setView(session && session.role === 'cliente' ? 'clientPortal' : 'landing'); }} className="md:hidden bg-white border border-[#EADEC9]/50 px-4 py-2 rounded-xl text-xs font-semibold text-[#5C0632] shadow-sm hover:bg-[#5C0632]/5 transition-colors w-fit mb-4">
              ← Volver
            </button>
            {/* Wizard Progress — mobile only */}
            <div className="md:hidden flex items-center justify-center gap-3 pb-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                      s === bookingWizardStep
                        ? 'bg-[#5C0632] text-white shadow-md'
                        : s < bookingWizardStep
                        ? 'bg-[#8E1B54] text-white cursor-pointer'
                        : (s === 2 && selectedServiceIds.length > 0) || (s === 3 && selectedServiceIds.length > 0 && bookingDate)
                        ? 'bg-[#EADEC9]/60 text-[#8E1B54] hover:bg-[#8E1B54] hover:text-white cursor-pointer'
                        : 'bg-[#EADEC9]/40 text-[#A68F63] cursor-default'
                    }`}
                    onClick={() => {
                      if (s < bookingWizardStep) { setBookingWizardStep(s); return; }
                      if (s === bookingWizardStep) return;
                      // s > bookingWizardStep: forward only if prerequisites met
                      if (s === 2 && selectedServiceIds.length === 0) return;
                      if (s === 3 && (!bookingDate || selectedServiceIds.length === 0)) return;
                      setBookingWizardStep(s);
                    }}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div className={`w-6 h-0.5 ${s < bookingWizardStep ? 'bg-[#8E1B54]' : 'bg-[#EADEC9]/40'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* ===== PASO 1 ===== */}
            <section className={`space-y-4 ${bookingWizardStep !== 1 ? 'hidden md:block' : ''}`}>
              <h2 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-3">1. Selecciona tus Rituales</h2>
              <input type="text" placeholder="Buscar servicio..." value={svcSearch} onChange={e => { setSvcSearch(e.target.value); setSvcPage(1); }} className="p-2 border rounded-lg text-xs w-full max-w-xs bg-white" />
              {(() => {
                const filtered = services
                  .filter(s => (s.name || '').toLowerCase().includes(svcSearch.toLowerCase()))
                  .sort((a, b) => {
                    if ((a as any).trending && !(b as any).trending) return -1;
                    if (!(a as any).trending && (b as any).trending) return 1;
                    return (a.name || '').localeCompare(b.name || '');
                  });
                const total = filtered.length;
                const start = (svcPage - 1) * PER_PAGE;
                const page = filtered.slice(start, start + PER_PAGE);
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {page.map(s => {
                        const serviceIdStr = String(s.id);
                        const isSelected = selectedServiceIds.includes(serviceIdStr);
                        return (
                          <div key={s.id} onClick={() => handleServiceToggle(serviceIdStr)} className={`p-4 rounded-xl border cursor-pointer transition-all text-left ${isSelected ? 'border-[#8E1B54] bg-[#5C0632]/5' : 'border-[#EADEC9]/30 bg-white'}`}>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1.5">
                                {(s as any).trending && <span className="text-[7px] px-1 py-0.5 bg-[#8E1B54] text-white rounded-full font-bold">TOP</span>}
                                <span className="text-xs font-bold text-[#44403C]">{s.name}</span>
                              </div>
                              <span className="text-xs font-bold text-[#8E1B54]">{typeof s.price === 'number' ? `$${s.price.toLocaleString('es-CO')}` : s.price}</span>
                            </div>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-[9px] text-[#A68F63]">{s.durationInMinutes || 60} min</span>
                              {s.shortDescription && <span className="text-[9px] text-[#78716C] italic truncate">{s.shortDescription}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {total > PER_PAGE && (
                      <div className="flex items-center justify-center gap-3 text-xs pt-2">
                        <button disabled={svcPage === 1} onClick={() => setSvcPage(p => p - 1)} className="px-3 py-1.5 border border-[#EADEC9] rounded-lg disabled:opacity-30 text-[#A68F63] font-semibold">‹ Anterior</button>
                        <span className="text-[#78716C]">{svcPage} / {Math.ceil(total / PER_PAGE)}</span>
                        <button disabled={svcPage * PER_PAGE >= total} onClick={() => setSvcPage(p => p + 1)} className="px-3 py-1.5 border border-[#EADEC9] rounded-lg disabled:opacity-30 text-[#A68F63] font-semibold">Siguiente ›</button>
                      </div>
                    )}
                  </>
                );
              })()}
              {/* Navegación wizard — mobile only */}
              <div className="md:hidden pt-4 flex justify-end">
                <button onClick={() => setBookingWizardStep(2)} disabled={selectedServiceIds.length === 0} className="px-6 py-2.5 bg-[#5C0632] disabled:bg-neutral-300 text-white text-xs font-semibold rounded-xl">
                  Siguiente: Fecha →
                </button>
              </div>
            </section>

            {/* ===== PASO 2 ===== */}
            <section className={`space-y-4 ${bookingWizardStep !== 2 ? 'hidden md:block' : ''}`}>
              <h2 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-3">2. Elige la Fecha</h2>
              <DatePicker
                selectedDate={bookingDate}
                onSelectDate={(d) => { setBookingDate(d); setBookingTime(''); setSelectedSpecialist(null); }}
                className="max-w-[280px]"
              />
              {/* Navegación wizard — mobile only */}
              <div className="md:hidden pt-4 flex justify-between">
                <button onClick={() => setBookingWizardStep(1)} className="px-5 py-2.5 bg-white border border-[#EADEC9] text-[#5C0632] text-xs font-semibold rounded-xl">
                  ← Anterior
                </button>
                <button onClick={() => setBookingWizardStep(3)} disabled={!bookingDate} className="px-6 py-2.5 bg-[#5C0632] disabled:bg-neutral-300 text-white text-xs font-semibold rounded-xl">
                  Siguiente: Manicurista →
                </button>
              </div>
            </section>

            {/* ===== PASO 3 ===== */}
            <section className={`space-y-4 ${bookingWizardStep !== 3 ? 'hidden md:block' : ''}`}>
              <h2 className="serif-title text-xl text-[#3B0019] border-b border-[#EADEC9]/30 pb-3">3. Elige Manicurista y Hora</h2>
              {!bookingDate ? (
                <p className="text-[10px] text-[#78716C]">Elegí primero una fecha.</p>
              ) : (
                <>
                  <input type="text" placeholder="Buscar manicurista..." value={manSearch} onChange={e => { setManSearch(e.target.value); setManPage(1); }} className="p-2 border rounded-lg text-xs w-full max-w-xs bg-white" />
                  {(() => {
                    const filtered = manicurists
                      .filter(m => (m.name || '').toLowerCase().includes(manSearch.toLowerCase()))
                      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    const total = filtered.length;
                    const start = (manPage - 1) * PER_PAGE;
                    const page = filtered.slice(start, start + PER_PAGE);
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {page.map(m => {
                            const manicuristIdStr = String(m.id);
                            const isSelected = selectedSpecialist === manicuristIdStr;
                            const shift = manicuristShifts[manicuristIdStr];
                            return (
                              <div key={m.id} onClick={() => { setSelectedSpecialist(manicuristIdStr); setBookingTime(''); }} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${isSelected ? 'border-[#8E1B54] bg-[#5C0632]/5' : 'border-[#EADEC9]/30 bg-white'}`}>
                                {m.avatarPath || m.avatarUrl ? (
                                  <img
                                    src={m.avatarPath?.startsWith('/') ? `${API_URL}${m.avatarPath}` : (m.avatarPath || m.avatarUrl)}
                                    alt={m.name}
                                    onClick={() => setZoomedAvatar(m.avatarPath?.startsWith('/') ? `${API_URL}${m.avatarPath}` : (m.avatarPath || m.avatarUrl || null))}
                                    className="w-10 h-10 rounded-full mx-auto object-cover border border-[#EADEC9] cursor-zoom-in hover:scale-110 transition-transform"
                                  />
                                ) : (
                                  <FallbackAvatar className="w-10 h-10 mx-auto" />
                                )}
                                <span className="block text-xs font-semibold text-[#44403C] mt-2">{m.name}</span>
                                {shift && <span className="block text-[9px] text-[#A68F63] mt-0.5">Turno: {shift.startTime}-{shift.endTime}</span>}
                              </div>
                            );
                          })}
                        </div>
                        {total > PER_PAGE && (
                          <div className="flex items-center justify-center gap-3 text-xs pt-2">
                            <button disabled={manPage === 1} onClick={() => setManPage(p => p - 1)} className="px-3 py-1.5 border border-[#EADEC9] rounded-lg disabled:opacity-30 text-[#A68F63] font-semibold">‹ Anterior</button>
                            <span className="text-[#78716C]">{manPage} / {Math.ceil(total / PER_PAGE)}</span>
                            <button disabled={manPage * PER_PAGE >= total} onClick={() => setManPage(p => p + 1)} className="px-3 py-1.5 border border-[#EADEC9] rounded-lg disabled:opacity-30 text-[#A68F63] font-semibold">Siguiente ›</button>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {!selectedSpecialist ? (
                    <p className="text-[10px] text-[#78716C]">Elegí una manicurista para ver sus horarios disponibles.</p>
                  ) : loadingSlots ? (
                    <p className="text-[10px] text-[#78716C]">Buscando horarios disponibles...</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-[10px] text-[#78716C]">No hay horarios disponibles ese día para esta manicurista, probá con otra.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
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
                </>
              )}
              {/* Navegación wizard — mobile only */}
              <div className="md:hidden pt-4 flex justify-between">
                <button onClick={() => setBookingWizardStep(2)} className="px-5 py-2.5 bg-white border border-[#EADEC9] text-[#5C0632] text-xs font-semibold rounded-xl">
                  ← Anterior
                </button>
                <button onClick={() => { if (selectedServiceIds.length > 0) { setBookingStep('selection'); setIsBookingOpen(true); } }} disabled={selectedServiceIds.length === 0 || !selectedSpecialist || !bookingDate || !bookingTime} className="px-6 py-2.5 bg-[#8E1B54] disabled:bg-neutral-300 text-white text-xs font-semibold rounded-xl">
                  Revisar y Confirmar
                </button>
              </div>
            </section>

          </main>

          {/* Zoom avatar modal */}
          {zoomedAvatar && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoomedAvatar(null)}>
              <img src={zoomedAvatar} alt="Especialista" className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
              <button onClick={() => setZoomedAvatar(null)} className="absolute top-4 right-4 text-white text-2xl font-bold">✕</button>
            </div>
          )}

          {/* BARRA FLOTANTE MÓVIL — resumen pegado y plegable, siempre junto al boton */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FDFBF7]/95 border-t border-[#EADEC9]/30 z-30">
            {selectedServiceIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMobileSummary(v => !v)}
                className="w-full px-4 pt-2.5 pb-1 flex items-center justify-between text-left"
              >
                <span className="text-xs text-[#78716C] truncate pr-2">
                  {services.filter(s => selectedServiceIds.includes(String(s.id))).map(s => s.name).join(', ')}
                </span>
                <span className="text-[11px] text-[#A68F63] font-bold shrink-0">{showMobileSummary ? 'Ocultar ▾' : 'Ver resumen ▴'}</span>
              </button>
            )}

            {showMobileSummary && selectedServiceIds.length > 0 && (
              <div className="px-4 pb-2 space-y-2 max-h-[45vh] overflow-y-auto border-b border-[#EADEC9]/20">
                <div className="space-y-1.5">
                  {services.filter(s => selectedServiceIds.includes(String(s.id))).map(s => (
                    <div key={s.id} className="flex justify-between text-xs">
                      <span className="text-[#44403C]">{s.name} <span className="text-[#A68F63]">· {s.durationInMinutes || 60} min</span></span>
                      <span className="text-[#8E1B54] font-semibold">{typeof s.price === 'number' ? `$${s.price.toLocaleString('es-CO')}` : s.price}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#A68F63]">Tiempo aprox: {services.filter(s => selectedServiceIds.includes(String(s.id))).reduce((sum, s) => sum + (Number(s.durationInMinutes) || 60), 0)} min</p>
                {selectedSpecialist && (
                  <p className="text-xs text-[#78716C]">Manicurista: <strong className="text-[#3B0019]">{getManicuristName(selectedSpecialist)}</strong></p>
                )}
                {bookingDate && bookingTime && (
                  <p className="text-xs text-[#78716C]">Fecha: <strong className="text-[#3B0019]">{bookingDate} · {bookingTime}</strong></p>
                )}
                {discountPercent && <p className="text-xs text-green-600">-{discountPercent}% {discountTitle}</p>}
                {discountError && <p className="text-xs text-red-600">{discountError}</p>}
              </div>
            )}

            <div className="p-4 pt-2">
              {bookingWizardStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setBookingWizardStep(2)}
                  disabled={selectedServiceIds.length === 0}
                  className="w-full py-3.5 bg-[#5C0632] disabled:bg-neutral-300 text-white font-medium rounded-xl text-xs transition-all"
                >
                  Continuar: Fecha y Hora
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { if (selectedServiceIds.length > 0 && selectedSpecialist && bookingDate && bookingTime) { setBookingStep('selection'); setIsBookingOpen(true); } }}
                  disabled={selectedServiceIds.length === 0 || !selectedSpecialist || !bookingDate || !bookingTime}
                  className="w-full py-3.5 bg-[#5C0632] disabled:bg-neutral-300 text-white font-medium rounded-xl text-xs transition-all"
                >
                  Reservar {selectedServiceIds.length} Ritual(es) ({getFormattedTotal()})
                </button>
              )}
            </div>
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
                {discountPercent ? (
                  <p className="text-[10px] text-green-600 font-semibold">-{discountPercent}% {discountTitle} | Total: {getFormattedTotal()}</p>
                ) : showDiscount ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Codigo de descuento" value={discountCode} onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setDiscountPercent(null); setDiscountTitle(null); setDiscountError(null); }} className="flex-1 p-2.5 border rounded-xl text-xs uppercase" />
                      <button type="button" onClick={handleValidateDiscount} disabled={discountValidating || !discountCode.trim()} className="px-3 py-2.5 bg-[#A68F63] text-white text-xs font-semibold rounded-xl disabled:opacity-50">{discountValidating ? '...' : 'Aplicar'}</button>
                    </div>
                    <button onClick={() => setShowDiscount(false)} className="text-[9px] text-[#A68F63] underline">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setShowDiscount(true)} className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold underline">
                    ¿Tienes un codigo de descuento?
                  </button>
                )}
                {discountError && <p className="text-[10px] text-red-600">{discountError}</p>}

                {session && session.role === 'cliente' ? (
                  <div className="space-y-3 text-xs">
                    <p>Sesión activa: <strong>{session.name}</strong></p>
                    {submitError && <p className="text-[10px] text-red-600 bg-red-50 p-2 rounded-lg">{submitError}</p>}
                    <button onClick={handleConfirmLoggedInBooking} disabled={isSubmitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl disabled:opacity-60">
                      {isSubmitting ? 'Procesando...' : 'Confirmar Reserva'}
                    </button>
                  </div>
                ) : (
                  <>
                    {(bookingStep === 'selection' || bookingStep === 'auth') && (
                      <form onSubmit={handleCheckAuthBooking} className="space-y-3">
                        <input type="tel" inputMode="numeric" required maxLength={10} placeholder="Celular" value={bookingPhone} onChange={handlePhoneInputChange(setBookingPhone)} className="w-full p-2.5 border rounded-xl text-xs" />
                        {submitError && <p className="text-[10px] text-red-600">{submitError}</p>}
                        <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">Verificar</button>
                      </form>
                    )}

                    {bookingStep === 'register' && (
                      <form onSubmit={handleRegisterAndBookBooking} className="space-y-3">
                        <input type="text" required maxLength={60} placeholder="Nombre Completo" value={bookingName} onChange={handleNameInputChange(setBookingName)} className="w-full p-2.5 border rounded-xl text-xs" />
                        <input type="number" required min={0} max={100} placeholder="Edad" value={bookingAge} onChange={(e) => setBookingAge(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" />
                        {submitError && <p className="text-[10px] text-red-600">{submitError}</p>}
                        <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-[#8E1B54] text-white text-xs font-semibold rounded-xl">Registrarse & Confirmar</button>
                      </form>
                    )}
                  </>
                )}

                {bookingStep === 'success' && (
                  <div className="text-center py-4 text-xs space-y-3 text-[#3B0019]">
                    <p className="font-bold text-base">¡Cita Agendada!</p>
                    <p>Reserva #{createdAppointment?.appointmentId || createdAppointment?.id} creada. Redirigiendo a WhatsApp...</p>
                    {!session && (
                      <button onClick={handleViewMyAppointment} className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold underline">
                        Ver mi cita
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
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
                      <input type="text" required maxLength={60} value={clientNameInput} onChange={handleNameInputChange(setClientNameInput)} className="w-full p-2 border rounded-lg text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-[#78716C] block">Edad</label>
                        <input type="number" required min={0} max={100} value={clientAgeInput} onChange={(e) => setClientAgeInput(e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
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
          <span>Cc. Parque Fabricato • S1 local 104 • +57 319 707 2921</span>
        </div>
        <p className="text-[10px] text-[#78716C]">Lunes a Viernes: 9:00 AM - 8:00 PM • Sábado y Domingo: 9:00 AM - 7:00 PM</p>
        <a href="https://www.instagram.com/wine.spa" target="_blank" rel="noopener noreferrer" className="inline-block text-[10px] text-[#A68F63] hover:text-[#5C0632] hover:underline">@wine.spa</a>
        <div className="flex justify-center gap-4 pt-1">
          <button onClick={() => setView('terms')} className="text-[10px] text-[#A68F63] hover:text-[#5C0632] hover:underline">Términos y Condiciones</button>
          <button onClick={() => setView('privacy')} className="text-[10px] text-[#A68F63] hover:text-[#5C0632] hover:underline">Política de Privacidad</button>
          <button onClick={() => setView('cancellation')} className="text-[10px] text-[#A68F63] hover:text-[#5C0632] hover:underline">Política de Cancelación</button>
        </div>
      </footer>
    </div>
  );
}
