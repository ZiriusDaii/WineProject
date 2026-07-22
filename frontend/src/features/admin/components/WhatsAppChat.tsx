import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const authHeaders = () => {
  const token = localStorage.getItem('winespa_token');
  return token
    ? ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } as Record<string, string>)
    : ({ 'Content-Type': 'application/json' } as Record<string, string>);
};

export interface Conversation {
  conversationId: string;
  phoneNumber: string;
  clientName?: string;
  clientRole?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  totalMessages: number;
  hasAttentionRequest?: boolean;
}

export interface Message {
  id: string;
  waMessageId?: string;
  from: string;
  to: string;
  body: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'RECEIVED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
  isOptimistic?: boolean;
}

// Play notification sound using Web Audio API
function playChimeNotification() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore audio errors
  }
}

// Linkify message body text
function renderMessageText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium hover:opacity-80 break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Format time
function formatTime(isoStr: string) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

// Conversation List Item Memoized
const ConversationListItem = React.memo<{
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  now: number;
}>(({ conversation, isActive, onSelect, now }) => {
  const isRecent = conversation.lastMessageAt
    ? now - new Date(conversation.lastMessageAt).getTime() < 5 * 60 * 1000
    : false;

  const displayTitle = conversation.clientName || conversation.phoneNumber;

  return (
    <motion.button
      onClick={() => onSelect(conversation.conversationId)}
      whileHover={{ scale: 1.01, x: 2 }}
      whileTap={{ scale: 0.99 }}
      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 relative cursor-pointer ${
        isActive
          ? 'bg-[#EADEC9]/40 border-l-4 border-l-[#5C0632] border-t-[#EADEC9]/60 border-r-[#EADEC9]/60 border-b-[#EADEC9]/60 shadow-xs'
          : 'bg-white/60 hover:bg-[#EADEC9]/20 border-stone-200/70'
      }`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#5C0632]/10 border border-[#8E1B54]/20 flex items-center justify-center font-bold text-xs text-[#5C0632]">
          {conversation.clientName
            ? conversation.clientName.slice(0, 2).toUpperCase()
            : '📞'}
        </div>
        {isRecent && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="font-semibold text-xs text-[#3B0019] truncate">
            {displayTitle}
          </span>
          <span className="text-[10px] text-stone-400 shrink-0">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>

        {conversation.clientName && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-stone-500 font-mono truncate">
              {conversation.phoneNumber}
            </span>
            {conversation.clientRole && (
              <span className="px-1.5 py-0.2 bg-[#8E1B54]/10 text-[#8E1B54] text-[9px] font-bold rounded-full">
                {conversation.clientRole}
              </span>
            )}
          </div>
        )}

        <p className="text-[11px] text-stone-600 truncate leading-snug">
          {conversation.lastMessage || 'Sin mensajes'}
        </p>
      </div>

      {/* Unread badge */}
      {conversation.unreadCount > 0 && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="shrink-0 bg-[#8E1B54] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs self-center"
        >
          {conversation.unreadCount}
        </motion.span>
      )}
      {/* Attention request badge */}
      {conversation.hasAttentionRequest && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="shrink-0 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-xs self-center"
          title="Cliente solicito atencion de un asesor"
        >
          🛎
        </motion.span>
      )}
    </motion.button>
  );
});

// Message Bubble Memoized
const MessageBubble = React.memo<{
  message: Message;
  onRetry?: (msg: Message) => void;
}>(({ message, onRetry }) => {
  const isOutbound = message.direction === 'OUTBOUND';

  return (
    <div
      className={`flex flex-col mb-3 max-w-[82%] ${
        isOutbound ? 'ml-auto items-end' : 'mr-auto items-start'
      }`}
    >
      <div
        className={`px-4 py-2.5 rounded-2xl shadow-xs text-xs whitespace-pre-wrap break-words leading-relaxed ${
          isOutbound
            ? 'bg-[#8E1B54] text-white rounded-tr-xs'
            : 'bg-white border border-[#EADEC9]/60 text-stone-800 rounded-tl-xs'
        } ${message.isOptimistic ? 'opacity-70' : ''}`}
      >
        {renderMessageText(message.body)}
      </div>

      <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-stone-400">
        <span>{formatTime(message.createdAt)}</span>
        {isOutbound && (
          <span className="ml-0.5">
            {message.isOptimistic ? (
              <span className="animate-pulse">⏳</span>
            ) : message.status === 'FAILED' ? (
              <button
                onClick={() => onRetry?.(message)}
                className="text-red-500 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                ❌ Error (Reintentar)
              </button>
            ) : message.status === 'READ' ? (
              <span className="text-amber-400 font-bold">✓✓</span>
            ) : message.status === 'DELIVERED' ? (
              <span className="text-stone-300 font-bold">✓✓</span>
            ) : (
              <span className="text-stone-300 font-bold">✓</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
});

export const WhatsAppChat: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeFetchController = useRef<AbortController | null>(null);
  const prevTotalUnread = useRef<number>(0);

  const [now, setNow] = useState(0);

  // Refresh `now` every 10s for online indicators
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch Conversations
  const fetchConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingConversations(true);
    try {
      const q = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : '';
      const res = await fetch(`${API}/api/admin/whatsapp/conversations${q}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const convs: Conversation[] = data.conversations || [];
        setConversations(convs);

        // Check for new unread messages for sound alert
        const currentUnread = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        if (currentUnread > prevTotalUnread.current && soundEnabled) {
          playChimeNotification();
        }
        prevTotalUnread.current = currentUnread;
      }
    } catch {
      // Silent error during polling
    } finally {
      if (showLoading) setLoadingConversations(false);
    }
  }, [debouncedSearch, soundEnabled]);

  // Initial fetch and search filter updates
  useEffect(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  // Periodic polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(false);
      if (selectedConversationId) {
        fetchMessages(selectedConversationId, false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations, selectedConversationId]);

  // Fetch Messages for Selected Conversation
  const fetchMessages = async (conversationId: string, showLoading = true) => {
    if (activeFetchController.current) {
      activeFetchController.current.abort();
    }
    const controller = new AbortController();
    activeFetchController.current = controller;

    if (showLoading) setLoadingMessages(true);
    try {
      const res = await fetch(
        `${API}/api/admin/whatsapp/conversations/${conversationId}/messages?limit=200`,
        {
          headers: authHeaders(),
          signal: controller.signal,
        }
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching messages:', err);
      }
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  // Mark conversation as read
  const markAsRead = async (conversationId: string) => {
    try {
      await fetch(`${API}/api/admin/whatsapp/conversations/${conversationId}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch {
      // Ignore errors
    }
  };

  // Handle select conversation
  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setMobileView('chat');
    fetchMessages(conversationId, true);
    markAsRead(conversationId);
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-grow textarea
  const handleInputTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    if (!selectedConversationId || !inputText.trim() || sending) return;
    const textToSend = inputText.trim();
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Optimistic message
    const tempId = `opt_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      from: 'WineSpa',
      to: selectedConversationId.replace(/^conv_/, ''),
      body: textToSend,
      direction: 'OUTBOUND',
      status: 'SENT',
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setSending(true);

    try {
      const res = await fetch(
        `${API}/api/admin/whatsapp/conversations/${selectedConversationId}/messages`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ messageText: textToSend }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const createdMsg: Message = data.message;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? createdMsg : m))
        );
        fetchConversations(false);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: 'FAILED', isOptimistic: false } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: 'FAILED', isOptimistic: false } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // Retry sending failed message
  const handleRetrySend = async (msg: Message) => {
    if (!selectedConversationId || sending) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: 'SENT', isOptimistic: true } : m))
    );
    setSending(true);

    try {
      const res = await fetch(
        `${API}/api/admin/whatsapp/conversations/${selectedConversationId}/messages`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ messageText: msg.body }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? data.message : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: 'FAILED', isOptimistic: false } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'FAILED', isOptimistic: false } : m))
      );
    } finally {
      setSending(false);
    }
  };

  const selectedConv = useMemo(
    () => conversations.find((c) => c.conversationId === selectedConversationId),
    [conversations, selectedConversationId]
  );

  const isSelectedOnline = useMemo(() => {
    if (!selectedConv?.lastMessageAt) return false;
    return now - new Date(selectedConv.lastMessageAt).getTime() < 5 * 60 * 1000;
  }, [selectedConv, now]);

  return (
    <div className="h-[calc(100vh-120px)] bg-white/70 backdrop-blur-md rounded-2xl border border-[#EADEC9]/50 shadow-lg overflow-hidden flex flex-col md:flex-row">
      {/* LEFT PANEL: Conversation List */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-[#EADEC9]/40 flex flex-col h-full bg-[#FDFBF7]/80 ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header & Search */}
        <div className="p-4 border-b border-[#EADEC9]/40 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="serif-title text-lg text-[#3B0019] flex items-center gap-2">
              <span>💬 Chats WhatsApp</span>
            </h2>
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs text-stone-600 cursor-pointer transition-colors"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
          </div>

          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar cliente, telefono o mensaje... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-xl text-xs bg-white/90 focus:outline-none focus:ring-2 focus:ring-[#8E1B54]/30"
            />
            <span className="absolute left-3 top-2.5 text-xs text-stone-400">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingConversations ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-16 bg-stone-100 rounded-xl animate-pulse p-3 flex gap-3"
                >
                  <div className="w-10 h-10 bg-stone-200 rounded-full" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-stone-200 rounded w-1/2" />
                    <div className="h-2.5 bg-stone-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-400 space-y-2">
              <span className="text-3xl">📥</span>
              <p className="text-xs font-medium">No hay conversaciones activas</p>
              <p className="text-[10px] text-stone-400">
                Los mensajes entrantes de WhatsApp apareceran aqui
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConversationListItem
                key={conv.conversationId}
                conversation={conv}
                isActive={conv.conversationId === selectedConversationId}
                onSelect={handleSelectConversation}
                now={now}
              />
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Message Thread */}
      <div
        className={`flex-1 flex flex-col h-full bg-[#FDFBF7]/40 ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversationId && selectedConv ? (
          <>
            {/* Header */}
            <div className="p-3.5 border-b border-[#EADEC9]/40 bg-white/80 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileView('list')}
                    className="md:hidden p-1.5 text-stone-500 hover:text-stone-800 text-xs font-semibold"
                  >
                    ← Volver
                  </button>
                  <div className="w-9 h-9 rounded-full bg-[#5C0632]/10 border border-[#8E1B54]/20 flex items-center justify-center font-bold text-xs text-[#5C0632]">
                    {selectedConv.clientName
                      ? selectedConv.clientName.slice(0, 2).toUpperCase()
                      : '📞'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-xs text-[#3B0019]">
                        {selectedConv.clientName || selectedConv.phoneNumber}
                      </h3>
                      {selectedConv.clientRole && (
                        <span className="px-1.5 py-0.2 bg-[#8E1B54]/10 text-[#8E1B54] text-[9px] font-bold rounded-full">
                          {selectedConv.clientRole}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-mono">
                      <span>{selectedConv.phoneNumber}</span>
                      {isSelectedOnline ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-sans font-medium">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                          En linea
                        </span>
                      ) : (
                        <span>• Ultimo mensaje {formatTime(selectedConv.lastMessageAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!window.confirm('¿Eliminar toda la conversacion? Esta accion no se puede deshacer.')) return;
                    try {
                      await fetch(
                        `${API}/api/admin/whatsapp/conversations/${selectedConversationId}`,
                        { method: 'DELETE', headers: authHeaders() }
                      );
                      setConversations((prev) => prev.filter((c) => c.conversationId !== selectedConversationId));
                      setSelectedConversationId(null);
                      setMessages([]);
                      setMobileView('list');
                    } catch { /* ignore */ }
                  }}
                  className="px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="Eliminar conversacion"
                >
                  🗑 Eliminar
                </button>
              </div>
              {selectedConv.hasAttentionRequest && (
                <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🛎</span>
                    <div>
                      <p className="text-[11px] font-semibold text-amber-800">Cliente solicito atencion personal</p>
                      <p className="text-[10px] text-amber-600">Responde directamente en este chat</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(
                          `${API}/api/admin/whatsapp/conversations/${selectedConversationId}/resolve`,
                          { method: 'PATCH', headers: authHeaders() }
                        );
                        setConversations((prev) =>
                          prev.map((c) =>
                            c.conversationId === selectedConversationId
                              ? { ...c, hasAttentionRequest: false }
                              : c
                          )
                        );
                      } catch { /* ignore */ }
                    }}
                    className="shrink-0 px-2 py-1 text-[10px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Atendido
                  </button>
                </div>
              )}
            </div>

            {/* Message Thread Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {loadingMessages ? (
                <div className="space-y-3">
                  <div className="h-10 bg-stone-200/50 rounded-2xl w-48 animate-pulse mr-auto" />
                  <div className="h-12 bg-stone-300/50 rounded-2xl w-64 animate-pulse ml-auto" />
                  <div className="h-10 bg-stone-200/50 rounded-2xl w-52 animate-pulse mr-auto" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-2">
                  <span className="text-3xl">💬</span>
                  <p className="text-xs font-medium">
                    Envía un mensaje para iniciar la conversación
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onRetry={handleRetrySend}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-[#EADEC9]/40 bg-white/90 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter nueva linea)"
                  value={inputText}
                  onChange={handleInputTextChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 p-2.5 border border-stone-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#8E1B54]/30 resize-none max-h-24 overflow-y-auto leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="px-4 py-2.5 bg-[#8E1B54] hover:bg-[#5C0632] disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer shrink-0 flex items-center justify-center min-w-12 h-[38px]"
                >
                  {sending ? (
                    <span className="animate-spin text-xs">⏳</span>
                  ) : (
                    <span>➤</span>
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-400 space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#EADEC9]/30 flex items-center justify-center text-2xl">
              📱
            </div>
            <h3 className="serif-title text-base text-[#3B0019]">
              Selecciona una conversación
            </h3>
            <p className="text-xs text-stone-500 max-w-xs">
              Haz clic en cualquier conversación de la lista de la izquierda para ver el historial y responder.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
