import React, { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const authHeaders = () => {
  const token = localStorage.getItem('winespa_token');
  return token
    ? ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } as Record<string, string>)
    : ({ 'Content-Type': 'application/json' } as Record<string, string>);
};

// Mismo estilo de icono de linea que WhatsAppChat.tsx / AdminDashboard.tsx.
const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const;
const SmartphoneIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} {...iconProps}><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
);
const FileTextIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
);

interface Template {
  id: string;
  name: string;
  headerText: string;
  bodyText: string;
  button1Id: string;
  button1Title: string;
  button2Id: string;
  button2Title: string;
  button3Id: string;
  button3Title: string;
  isActive: boolean;
}

export const WhatsAppConfig: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<Template>>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/whatsapp/templates`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      setToast({ msg: 'Error al cargar templates', ok: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const startEditing = (template: Template) => {
    setEditing((prev) => ({ ...prev, [template.id]: true }));
    setDrafts((prev) => ({ ...prev, [template.id]: { ...template } }));
  };

  const cancelEditing = (id: string) => {
    setEditing((prev) => ({ ...prev, [id]: false }));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleChange = (id: string, field: keyof Template, value: string | boolean) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;

    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`${API}/api/admin/whatsapp/templates/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? data.template : t))
        );
        setEditing((prev) => ({ ...prev, [id]: false }));
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setToast({ msg: 'Template guardado exitosamente', ok: true });
      } else {
        setToast({ msg: 'Error al guardar', ok: false });
      }
    } catch {
      setToast({ msg: 'Error de conexion', ok: false });
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2].map((n) => (
          <div key={n} className="h-48 bg-stone-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="serif-title text-xl text-[#3B0019]">Config. WhatsApp</h2>
          <p className="text-xs text-stone-500 mt-1">
            Personaliza el mensaje de bienvenida que reciben los clientes al escribir por primera vez
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-medium ${
            toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Templates */}
      <div className="space-y-6">
        {templates.map((template) => {
          const draft = drafts[template.id] || template;
          const isEditing = editing[template.id];

          return (
            <div
              key={template.id}
              className="bg-white/70 backdrop-blur-md rounded-2xl border border-[#EADEC9]/50 shadow-sm overflow-hidden"
            >
              {/* Template Header */}
              <div className="p-4 border-b border-[#EADEC9]/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SmartphoneIcon className="w-4 h-4 text-[#8E1B54]" />
                  <div>
                    <h3 className="font-semibold text-sm text-[#3B0019] capitalize">
                      {template.name === 'welcome' ? 'Mensaje de Bienvenida' : template.name}
                    </h3>
                    <p className="text-[10px] text-stone-500">
                      {template.isActive ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => isEditing ? cancelEditing(template.id) : startEditing(template)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                      isEditing
                        ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        : 'bg-[#8E1B54]/10 text-[#8E1B54] hover:bg-[#8E1B54]/20'
                    }`}
                  >
                    {isEditing ? 'Cancelar' : 'Editar'}
                  </button>
                  {isEditing && (
                    <button
                      onClick={() => handleSave(template.id)}
                      disabled={saving[template.id]}
                      className="px-4 py-1.5 text-[11px] font-bold bg-[#5C0632] text-white rounded-lg hover:bg-[#8E1B54] disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {saving[template.id] ? 'Guardando...' : 'Guardar'}
                    </button>
                  )}
                </div>
              </div>

              {/* Template Preview / Edit */}
              <div className="p-4 space-y-4">
                {/* Phone Preview */}
                <div className="flex justify-center">
                  <div className="w-full max-w-xs bg-[#EADEC9]/20 rounded-2xl border border-[#EADEC9]/40 p-4 shadow-inner space-y-3">
                    <p className="text-[10px] text-stone-400 text-center font-mono">Vista previa WhatsApp</p>
                    <div className="bg-white rounded-xl p-3 shadow-xs space-y-2 border border-stone-100">
                      <p className="text-[11px] font-bold text-[#3B0019]">
                        {isEditing ? (draft.headerText || '(sin header)') : template.headerText}
                      </p>
                      <p className="text-[10px] text-stone-600 leading-relaxed">
                        {isEditing ? (draft.bodyText || '(sin cuerpo)') : template.bodyText}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { id: draft.button1Id || '', title: draft.button1Title || '' },
                        { id: draft.button2Id || '', title: draft.button2Title || '' },
                        { id: draft.button3Id || '', title: draft.button3Title || '' },
                      ].map((btn, i) =>
                        btn.title ? (
                          <div
                            key={i}
                            className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-[10px] font-medium text-center text-stone-600"
                          >
                            {btn.title}
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit Fields */}
                {isEditing && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1">
                          Header (título del mensaje)
                        </label>
                        <input
                          type="text"
                          value={draft.headerText || ''}
                          onChange={(e) => handleChange(template.id, 'headerText', e.target.value)}
                          maxLength={60}
                          className="w-full p-2 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8E1B54]/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1">
                          Cuerpo (texto principal)
                        </label>
                        <textarea
                          value={draft.bodyText || ''}
                          onChange={(e) => handleChange(template.id, 'bodyText', e.target.value)}
                          maxLength={1024}
                          rows={2}
                          className="w-full p-2 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8E1B54]/30 resize-none"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] font-semibold text-stone-500 pt-1">Botones (máximo 3)</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(['1', '2', '3'] as const).map((n) => (
                        <div key={n} className="space-y-2">
                          <label className="block text-[10px] font-medium text-stone-400">
                            Botón {n}
                          </label>
                          <input
                            type="text"
                            placeholder={`Texto botón ${n}`}
                            value={String(draft[`button${n}Title` as keyof Template] || '')}
                            onChange={(e) =>
                              handleChange(template.id, `button${n}Title` as keyof Template, e.target.value)
                            }
                            maxLength={20}
                            className="w-full p-2 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8E1B54]/30"
                          />
                          <input
                            type="text"
                            placeholder="ID interno"
                            value={String(draft[`button${n}Id` as keyof Template] || '')}
                            onChange={(e) =>
                              handleChange(template.id, `button${n}Id` as keyof Template, e.target.value)
                            }
                            maxLength={30}
                            className="w-full p-2 border border-stone-100 rounded-lg text-[10px] font-mono text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8E1B54]/30"
                          />
                        </div>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.isActive !== false}
                        onChange={(e) => handleChange(template.id, 'isActive', e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 text-[#5C0632] focus:ring-[#8E1B54]"
                      />
                      <span className="text-[11px] text-stone-600">
                        Plantilla activa (se enviara automaticamente al recibir mensajes)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {templates.length === 0 && (
          <div className="text-center py-12 text-stone-400 flex flex-col items-center gap-2">
            <FileTextIcon className="w-8 h-8" />
            <p className="text-xs mt-2">No hay templates configurados.</p>
            <p className="text-[10px] mt-1">Ejecuta el seed para crear el template por defecto.</p>
          </div>
        )}
      </div>
    </div>
  );
};
