import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Users, MessageSquare, Hash, Lock, Search, Bell, Settings,
  UserPlus, UserMinus, Smile, Send, X, Minus, Square, ChevronDown,
  ChevronRight, Volume2, VolumeX, Moon, Sun, LogOut, Trash2, Shield,
  Star, Crown, MoreVertical, AtSign, Plus, MessageCircle, UserX,
  Eye, EyeOff, Wifi, WifiOff
} from 'lucide-react';

/* =========================================================================
   SOUND SYSTEM — classic IRC-style beeps via WebAudio (no external files)
   ========================================================================= */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}
function beep(freq, duration, type = 'square', vol = 0.05, delay = 0) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + delay;
    osc.start(start);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.stop(start + duration);
  } catch (e) { /* audio not available */ }
}
const Sounds = {
  message: () => beep(880, 0.05, 'square', 0.04),
  mention: () => { beep(1200, 0.08, 'square', 0.06); beep(1500, 0.08, 'square', 0.06, 0.09); },
  pm: () => { beep(660, 0.07, 'square', 0.05); beep(990, 0.07, 'square', 0.05, 0.08); },
  join: () => beep(520, 0.06, 'triangle', 0.04),
  leave: () => beep(330, 0.06, 'triangle', 0.04),
  error: () => beep(200, 0.15, 'sawtooth', 0.05),
  notify: () => { beep(740, 0.05, 'sine', 0.05); beep(740, 0.05, 'sine', 0.05, 0.12); },
};

/* =========================================================================
   MOCK DATA LAYER
   This simulates Firebase Auth + Firestore with in-memory state + timers
   to emulate realtime listeners (onSnapshot-style). Swapping in real
   Firebase means replacing these functions with Firestore calls and
   onSnapshot subscriptions — the component logic / shape stays the same.
   ========================================================================= */

const RANKS = { ADMIN: 'admin', MOD: 'mod', MEMBER: 'member' };

const RANK_BADGE = {
  admin: { icon: Crown, color: '#ff0000', label: 'Admin' },
  mod: { icon: Shield, color: '#0000ff', label: 'Mod' },
  member: { icon: null, color: '#000080', label: '' },
};

const AVATAR_COLORS = ['#ff5555','#55ff55','#5555ff','#ffff55','#ff55ff','#55ffff','#ffaa00','#aa55ff','#00aa88','#aa0055'];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash)];
}

function nowStr() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fullTimestamp() {
  const d = new Date();
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

let idCounter = 1000;
const uid = () => `id_${idCounter++}`;

// Seed "online" bot-like users to populate the room for a realistic demo feel
const SEED_USERS = [
  { id: 'u_neo', nick: 'Neo_Trinity', email: 'neo@matrix.io', rank: RANKS.ADMIN, status: 'online', joined: '2024-01-12', avatarLetter: 'N' },
  { id: 'u_byte', nick: 'ByteWizard', email: 'byte@wizard.net', rank: RANKS.MOD, status: 'online', joined: '2024-02-03', avatarLetter: 'B' },
  { id: 'u_pixel', nick: 'PixelPunk98', email: 'pixel@punk.com', rank: RANKS.MEMBER, status: 'away', joined: '2024-03-22', avatarLetter: 'P' },
  { id: 'u_glow', nick: 'GlowStick', email: 'glow@stick.com', rank: RANKS.MEMBER, status: 'online', joined: '2024-04-15', avatarLetter: 'G' },
  { id: 'u_modem', nick: 'ModemMaster', email: 'modem@56k.com', rank: RANKS.MEMBER, status: 'online', joined: '2024-05-01', avatarLetter: 'M' },
];

const SEED_ROOMS = [
  { id: 'room_lobby', name: '#lobby', description: 'Main lobby - welcome everyone!', type: 'public', pin: null, owner: 'u_neo', members: ['u_neo','u_byte','u_pixel','u_glow','u_modem'] },
  { id: 'room_retro', name: '#retro-computing', description: 'Talk about old hardware, BBSes, and demoscene', type: 'public', pin: null, owner: 'u_byte', members: ['u_byte','u_pixel'] },
  { id: 'room_secret', name: '#vip-lounge', description: 'Members only chill zone', type: 'pin', pin: '1234', owner: 'u_neo', members: ['u_neo'] },
];

const SEED_MESSAGES = {
  room_lobby: [
    { id: uid(), userId: 'u_neo', nick: 'Neo_Trinity', text: 'Welcome to *#lobby*! Be excellent to each other. :)', time: '10:01', system: false },
    { id: uid(), userId: 'system', nick: 'System', text: 'ByteWizard has joined #lobby', time: '10:02', system: true, kind: 'join' },
    { id: uid(), userId: 'u_byte', nick: 'ByteWizard', text: 'hey all! anyone else here remember dial-up tones lol', time: '10:03', system: false },
    { id: uid(), userId: 'u_pixel', nick: 'PixelPunk98', text: 'omg yes the *screeeee* sound still haunts me 😂', time: '10:04', system: false },
    { id: uid(), userId: 'u_glow', nick: 'GlowStick', text: '_brb getting coffee_', time: '10:05', system: false },
  ],
  room_retro: [
    { id: uid(), userId: 'u_byte', nick: 'ByteWizard', text: 'Just fixed up an old Pentium 100 with Windows 98SE :D', time: '09:40', system: false },
    { id: uid(), userId: 'u_pixel', nick: 'PixelPunk98', text: 'nice!! got pics?', time: '09:41', system: false },
  ],
  room_secret: [
    { id: uid(), userId: 'u_neo', nick: 'Neo_Trinity', text: 'Welcome to the VIP lounge, you found the PIN 🔒', time: '08:00', system: false },
  ],
};

/* Auto-reply lines for simulated "other users" to feel alive */
const AUTO_LINES = [
  'haha true that',
  'anyone tried the new build yet?',
  'brb',
  'lol',
  '👍',
  'this room is comfy',
  'gtg in a bit, ttyl',
  'check your PMs',
  'what time zone is everyone in?',
  '...',
  'lmaooo',
  'nice one',
];

/* =========================================================================
   STORAGE (mock persistence via localStorage substitute - in-memory only
   per artifact restrictions, but structured so it maps 1:1 to Firestore
   collections: users, rooms, messages, privateMessages, friends, blocks)
   ========================================================================= */

/* =========================================================================
   UI PRIMITIVES — Win95 / mIRC styled
   ========================================================================= */

function Win95Button({ children, onClick, active, disabled, style, className = '', title }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`win95-btn ${active ? 'win95-btn-active' : ''} ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}

function TitleBar({ title, icon, onClose, onMinimize, onMaximize, dark }) {
  return (
    <div className={`titlebar ${dark ? 'titlebar-dark' : ''}`}>
      <div className="titlebar-left">
        {icon}
        <span className="titlebar-text">{title}</span>
      </div>
      <div className="titlebar-buttons">
        {onMinimize && <button className="tb-btn" onClick={onMinimize}><Minus size={10} strokeWidth={3}/></button>}
        {onMaximize && <button className="tb-btn" onClick={onMaximize}><Square size={9} strokeWidth={3}/></button>}
        {onClose && <button className="tb-btn tb-close" onClick={onClose}><X size={10} strokeWidth={3}/></button>}
      </div>
    </div>
  );
}

/* =========================================================================
   AVATAR
   ========================================================================= */
function Avatar({ user, size = 28 }) {
  if (!user) return null;
  const letter = (user.avatarLetter || user.nick || '?')[0].toUpperCase();
  const bg = colorForName(user.nick || 'x');
  return (
    <div
      className="avatar-box"
      style={{
        width: size, height: size, background: bg,
        fontSize: size * 0.5, lineHeight: `${size}px`
      }}
    >
      {letter}
    </div>
  );
}

function StatusDot({ status }) {
  const color = status === 'online' ? '#00cc00' : status === 'away' ? '#ffaa00' : '#888';
  return <span className="status-dot" style={{ background: color }} title={status} />;
}

function RankBadge({ rank }) {
  const b = RANK_BADGE[rank];
  if (!b || !b.icon) return null;
  const Icon = b.icon;
  return <Icon size={11} style={{ color: b.color, marginLeft: 3, flexShrink: 0 }} title={b.label} />;
}

/* =========================================================================
   TEXT FORMATTING — basic markdown-ish + emoji passthrough + mention highlight
   ========================================================================= */
function formatMessageText(text, myNick) {
  // Escape first
  let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // bold *text*
  safe = safe.replace(/\*([^\*\n]+)\*/g, '<b>$1</b>');
  // italic _text_
  safe = safe.replace(/_([^_\n]+)_/g, '<i>$1</i>');
  // mentions @nick
  safe = safe.replace(/@(\w+)/g, (m, nick) => {
    const cls = myNick && nick.toLowerCase() === myNick.toLowerCase() ? 'mention mention-me' : 'mention';
    return `<span class="${cls}">@${nick}</span>`;
  });
  return safe;
}

const containsMention = (text, nick) => {
  if (!nick) return false;
  const re = new RegExp(`@${nick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(text);
};

const EMOJI_PALETTE = ['😀','😂','😍','😎','🤔','😢','😡','👍','👎','❤️','🔥','💻','☕','🎮','🚀','⭐','✅','❌','😴','🤣','😉','🙏','👋','🎉'];

/* =========================================================================
   LOGIN / REGISTER SCREEN
   ========================================================================= */
function AuthScreen({ onLogin, existingNicks }) {
  const [mode, setMode] = useState('login'); // login | register | guest
  const [nick, setNick] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    if (mode === 'guest') {
      const guestNick = nick.trim() || `Guest${Math.floor(1000 + Math.random() * 9000)}`;
      if (existingNicks.has(guestNick.toLowerCase())) {
        setError('That nickname is taken. Try another.');
        return;
      }
      onLogin({ nick: guestNick, email: null, isGuest: true });
      return;
    }
    if (mode === 'register') {
      if (!nick.trim() || !email.trim() || !password.trim()) {
        setError('All fields are required.');
        return;
      }
      if (existingNicks.has(nick.trim().toLowerCase())) {
        setError('Nickname already taken.');
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      onLogin({ nick: nick.trim(), email: email.trim(), isGuest: false, isNew: true });
      return;
    }
    // login
    if (!email.trim() || !password.trim()) {
      setError('Enter email and password.');
      return;
    }
    onLogin({ email: email.trim(), password, isGuest: false, isNew: false });
  };

  return (
    <div className="crt-wrapper auth-bg">
      <div className="scanlines" />
      <div className="win95-window auth-window">
        <TitleBar
          title="mIRC95 :: Connect to Server"
          icon={<MessageSquare size={14} />}
        />
        <div className="auth-body">
          <div className="auth-banner">
            <div className="auth-banner-title">▓▒░ mIRC95 ░▒▓</div>
            <div className="auth-banner-sub">Internet Relay Chat &mdash; reimagined</div>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>Login</button>
            <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); }}>Register</button>
            <button className={`auth-tab ${mode === 'guest' ? 'active' : ''}`} onClick={() => { setMode('guest'); setError(''); }}>Guest</button>
          </div>

          <div className="auth-form">
            {mode === 'register' && (
              <div className="field-row">
                <label>Nickname:</label>
                <input value={nick} onChange={e => setNick(e.target.value)} placeholder="e.g. CoolHacker99" maxLength={20} />
              </div>
            )}
            {mode === 'guest' && (
              <div className="field-row">
                <label>Nickname:</label>
                <input value={nick} onChange={e => setNick(e.target.value)} placeholder="(optional) leave blank for random" maxLength={20} />
              </div>
            )}
            {(mode === 'login' || mode === 'register') && (
              <div className="field-row">
                <label>Email:</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            )}
            {(mode === 'login' || mode === 'register') && (
              <div className="field-row">
                <label>Password:</label>
                <div className="pw-input-wrap">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} />
                  <button className="pw-toggle" onClick={() => setShowPw(s => !s)} type="button">
                    {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="auth-error">⚠ {error}</div>}

            <div className="auth-actions">
              <Win95Button onClick={submit} className="auth-submit">
                {mode === 'login' ? 'Login' : mode === 'register' ? 'Create Account' : 'Connect as Guest'}
              </Win95Button>
            </div>

            <div className="auth-footer">
              <Wifi size={12} /> <span>Server: irc.retroweb.net (6667)</span>
            </div>
          </div>
        </div>
        <div className="statusbar">
          <span>Ready</span>
          <span>mIRC v9.5 reimagined</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   USER PROFILE CARD (popup)
   ========================================================================= */
function ProfileCard({ user, onClose, onPM, onFriend, onBlock, isFriend, isBlocked, myUserId, onKick, canModerate }) {
  if (!user) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="win95-window profile-card" onClick={e => e.stopPropagation()}>
        <TitleBar title={`User Info: ${user.nick}`} icon={<Users size={14}/>} onClose={onClose} />
        <div className="profile-body">
          <div className="profile-header">
            <Avatar user={user} size={48} />
            <div className="profile-namebox">
              <div className="profile-name">
                {user.nick} <RankBadge rank={user.rank} />
                {user.isGuest && <span className="guest-tag">GUEST</span>}
              </div>
              <div className="profile-status"><StatusDot status={user.status}/> {user.status}</div>
            </div>
          </div>
          <div className="profile-fields">
            <div className="profile-field"><span className="pf-label">Joined:</span> {user.joined}</div>
            <div className="profile-field"><span className="pf-label">Rank:</span> {RANK_BADGE[user.rank]?.label || 'Member'}</div>
            {user.email && <div className="profile-field"><span className="pf-label">Email:</span> {user.email}</div>}
          </div>
          {user.id !== myUserId && (
            <div className="profile-actions">
              <Win95Button onClick={() => onPM(user)}><MessageCircle size={12}/> Message</Win95Button>
              <Win95Button onClick={() => onFriend(user)}>{isFriend ? <><UserMinus size={12}/> Unfriend</> : <><UserPlus size={12}/> Add Friend</>}</Win95Button>
              <Win95Button onClick={() => onBlock(user)} className={isBlocked ? '' : 'danger-btn'}>{isBlocked ? <><UserPlus size={12}/> Unblock</> : <><UserX size={12}/> Block</>}</Win95Button>
              {canModerate && <Win95Button onClick={() => onKick(user)} className="danger-btn"><Trash2 size={12}/> Kick from Room</Win95Button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   CREATE ROOM MODAL
   ========================================================================= */
function CreateRoomModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('public');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) { setError('Room name required.'); return; }
    if (type === 'pin' && (pin.length < 4 || !/^\d+$/.test(pin))) { setError('PIN must be 4+ digits.'); return; }
    let finalName = name.trim();
    if (!finalName.startsWith('#')) finalName = '#' + finalName;
    onCreate({ name: finalName, description: desc.trim(), type, pin: type === 'pin' ? pin : null });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="win95-window create-room-modal" onClick={e => e.stopPropagation()}>
        <TitleBar title="Create New Room" icon={<Hash size={14}/>} onClose={onClose} />
        <div className="profile-body">
          <div className="field-row">
            <label>Room Name:</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="#my-room" maxLength={24} />
          </div>
          <div className="field-row">
            <label>Description:</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this room about?" maxLength={60} />
          </div>
          <div className="field-row">
            <label>Type:</label>
            <div className="radio-row">
              <label className="radio-opt"><input type="radio" checked={type === 'public'} onChange={() => setType('public')} /> Public</label>
              <label className="radio-opt"><input type="radio" checked={type === 'pin'} onChange={() => setType('pin')} /> PIN-protected</label>
            </div>
          </div>
          {type === 'pin' && (
            <div className="field-row">
              <label>PIN Code:</label>
              <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,8))} placeholder="4-8 digits" maxLength={8} />
            </div>
          )}
          {error && <div className="auth-error">⚠ {error}</div>}
          <div className="auth-actions">
            <Win95Button onClick={submit}>Create Room</Win95Button>
            <Win95Button onClick={onClose}>Cancel</Win95Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   PIN PROMPT MODAL
   ========================================================================= */
function PinModal({ room, onClose, onSubmit }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="win95-window pin-modal" onClick={e => e.stopPropagation()}>
        <TitleBar title="Protected Room" icon={<Lock size={14}/>} onClose={onClose} />
        <div className="profile-body">
          <p style={{ margin: '4px 0 10px', fontSize: 11 }}>
            <Lock size={12} style={{ verticalAlign: -2 }} /> "{room.name}" requires a PIN to enter.
          </p>
          <div className="field-row">
            <label>PIN:</label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g,''))}
              onKeyDown={e => e.key === 'Enter' && (room.pin === pin ? onSubmit() : setError('Incorrect PIN.'))}
              maxLength={8}
              autoFocus
            />
          </div>
          {error && <div className="auth-error">⚠ {error}</div>}
          <div className="auth-actions">
            <Win95Button onClick={() => room.pin === pin ? onSubmit() : setError('Incorrect PIN.')}>Enter Room</Win95Button>
            <Win95Button onClick={onClose}>Cancel</Win95Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   ROOM SETTINGS MODAL (owner only)
   ========================================================================= */
function RoomSettingsModal({ room, onClose, onSave, onDelete, members, onRemoveMember }) {
  const [name, setName] = useState(room.name);
  const [desc, setDesc] = useState(room.description);
  const [pin, setPin] = useState(room.pin || '');
  const [type, setType] = useState(room.type);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="win95-window create-room-modal" onClick={e => e.stopPropagation()}>
        <TitleBar title={`Room Settings: ${room.name}`} icon={<Settings size={14}/>} onClose={onClose} />
        <div className="profile-body">
          <div className="field-row">
            <label>Room Name:</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={24} />
          </div>
          <div className="field-row">
            <label>Description:</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} maxLength={60} />
          </div>
          <div className="field-row">
            <label>Type:</label>
            <div className="radio-row">
              <label className="radio-opt"><input type="radio" checked={type === 'public'} onChange={() => setType('public')} /> Public</label>
              <label className="radio-opt"><input type="radio" checked={type === 'pin'} onChange={() => setType('pin')} /> PIN-protected</label>
            </div>
          </div>
          {type === 'pin' && (
            <div className="field-row">
              <label>PIN Code:</label>
              <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,8))} maxLength={8} />
            </div>
          )}

          <div className="field-row" style={{ alignItems: 'flex-start' }}>
            <label>Members:</label>
            <div className="member-manage-list">
              {members.map(m => (
                <div key={m.id} className="member-manage-row">
                  <Avatar user={m} size={18} /> <span>{m.nick}</span>
                  {m.id !== room.owner && (
                    <button className="kick-x" onClick={() => onRemoveMember(m)} title="Remove from room"><X size={11}/></button>
                  )}
                  {m.id === room.owner && <Star size={11} style={{ color:'#ffaa00', marginLeft: 4 }} title="Owner" />}
                </div>
              ))}
            </div>
          </div>

          <div className="auth-actions">
            <Win95Button onClick={() => onSave({ name, description: desc, pin: type === 'pin' ? pin : null, type })}>Save Changes</Win95Button>
            <Win95Button onClick={onDelete} className="danger-btn"><Trash2 size={12}/> Delete Room</Win95Button>
            <Win95Button onClick={onClose}>Cancel</Win95Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN APP
   ========================================================================= */
export default function App() {
  // ---- Auth / current user state ----
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState(SEED_USERS);
  const [accounts, setAccounts] = useState({}); // email -> {password, userId}

  // ---- Rooms & messages ----
  const [rooms, setRooms] = useState(SEED_ROOMS);
  const [messages, setMessages] = useState(SEED_MESSAGES);
  const [activeRoomId, setActiveRoomId] = useState('room_lobby');

  // ---- Private messages ----
  const [privateMessages, setPrivateMessages] = useState({}); // key: sorted "a|b" -> [msgs]
  const [activePM, setActivePM] = useState(null); // userId of open PM, null = room view

  // ---- Social ----
  const [friends, setFriends] = useState(new Set());
  const [blocked, setBlocked] = useState(new Set());

  // ---- UI state ----
  const [darkMode, setDarkMode] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [pinPromptRoom, setPinPromptRoom] = useState(null);
  const [roomSettingsOpen, setRoomSettingsOpen] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // roomId -> Set of nicks
  const [pmTyping, setPmTyping] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState({ rooms: false, users: false, friends: false });
  const [showMobileLeft, setShowMobileLeft] = useState(false);
  const [showMobileRight, setShowMobileRight] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [unreadPMs, setUnreadPMs] = useState(new Set());
  const [unreadRooms, setUnreadRooms] = useState(new Set());

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const existingNicks = useMemo(() => new Set(allUsers.map(u => u.nick.toLowerCase())), [allUsers]);

  /* ---------------- AUTH HANDLERS ---------------- */
  const addNotification = useCallback((notif) => {
    setNotifications(prev => [{ id: uid(), time: nowStr(), ...notif }, ...prev].slice(0, 50));
  }, []);

  const handleLogin = (data) => {
    if (data.isGuest) {
      const newUser = {
        id: uid(), nick: data.nick, email: null, rank: RANKS.MEMBER,
        status: 'online', joined: new Date().toISOString().slice(0,10),
        avatarLetter: data.nick[0], isGuest: true,
      };
      setAllUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
      setRooms(prev => prev.map(r => r.id === 'room_lobby' ? { ...r, members: [...r.members, newUser.id] } : r));
      return;
    }
    if (data.isNew) {
      const newUser = {
        id: uid(), nick: data.nick, email: data.email, rank: RANKS.MEMBER,
        status: 'online', joined: new Date().toISOString().slice(0,10),
        avatarLetter: data.nick[0], isGuest: false,
      };
      setAccounts(prev => ({ ...prev, [data.email.toLowerCase()]: { password: data.password, userId: newUser.id } }));
      setAllUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
      setRooms(prev => prev.map(r => r.id === 'room_lobby' ? { ...r, members: [...r.members, newUser.id] } : r));
      return;
    }
    // login existing
    const acct = accounts[data.email.toLowerCase()];
    if (!acct || acct.password !== data.password) {
      addNotification({ type: 'error', text: 'Invalid email or password.' });
      Sounds.error();
      alert('Invalid email or password. (Tip: register first, or use Guest mode.)');
      return;
    }
    const user = allUsers.find(u => u.id === acct.userId);
    if (user) {
      setCurrentUser({ ...user, status: 'online' });
      setAllUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'online' } : u));
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      setAllUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, status: 'offline' } : u));
      addRoomSystemMessage(activeRoomId, `${currentUser.nick} has left ${rooms.find(r=>r.id===activeRoomId)?.name}`, 'leave');
    }
    setCurrentUser(null);
    setActivePM(null);
  };

  /* ---------------- ROOM HELPERS ---------------- */
  const addRoomSystemMessage = (roomId, text, kind) => {
    setMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), { id: uid(), userId: 'system', nick: 'System', text, time: nowStr(), system: true, kind }]
    }));
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  const joinRoom = (room) => {
    if (room.type === 'pin' && !room.members.includes(currentUser.id)) {
      setPinPromptRoom(room);
      return;
    }
    enterRoom(room.id);
  };

  const enterRoom = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room.members.includes(currentUser.id)) {
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, members: [...r.members, currentUser.id] } : r));
      addRoomSystemMessage(roomId, `${currentUser.nick} has joined ${room.name}`, 'join');
      if (soundOn) Sounds.join();
    }
    setActiveRoomId(roomId);
    setActivePM(null);
    setUnreadRooms(prev => { const s = new Set(prev); s.delete(roomId); return s; });
    setShowMobileLeft(false);
  };

  const submitPin = () => {
    enterRoom(pinPromptRoom.id);
    setPinPromptRoom(null);
  };

  const createRoom = ({ name, description, type, pin }) => {
    const newRoom = {
      id: uid(), name, description, type, pin,
      owner: currentUser.id, members: [currentUser.id],
    };
    setRooms(prev => [...prev, newRoom]);
    setMessages(prev => ({ ...prev, [newRoom.id]: [
      { id: uid(), userId: 'system', nick: 'System', text: `Room ${name} created by ${currentUser.nick}`, time: nowStr(), system: true, kind: 'info' }
    ]}));
    setActiveRoomId(newRoom.id);
    setActivePM(null);
    setShowCreateRoom(false);
    addNotification({ type: 'room', text: `You created room ${name}` });
  };

  const saveRoomSettings = (updates) => {
    setRooms(prev => prev.map(r => r.id === roomSettingsOpen.id ? { ...r, ...updates } : r));
    setRoomSettingsOpen(null);
    addRoomSystemMessage(roomSettingsOpen.id, `Room settings updated by ${currentUser.nick}`, 'info');
  };

  const deleteRoom = () => {
    const room = roomSettingsOpen;
    setRooms(prev => prev.filter(r => r.id !== room.id));
    setMessages(prev => { const next = { ...prev }; delete next[room.id]; return next; });
    if (activeRoomId === room.id) setActiveRoomId('room_lobby');
    setRoomSettingsOpen(null);
    addNotification({ type: 'room', text: `Room ${room.name} was deleted` });
  };

  const removeMemberFromRoom = (member) => {
    const room = roomSettingsOpen;
    setRooms(prev => prev.map(r => r.id === room.id ? { ...r, members: r.members.filter(id => id !== member.id) } : r));
    addRoomSystemMessage(room.id, `${member.nick} was removed from ${room.name} by ${currentUser.nick}`, 'leave');
    setRoomSettingsOpen(prev => prev ? { ...prev, members: prev.members.filter(id => id !== member.id) } : prev);
  };

  const kickFromProfileCard = (user) => {
    const room = activeRoom;
    if (room.owner !== currentUser.id && currentUser.rank !== RANKS.ADMIN && currentUser.rank !== RANKS.MOD) return;
    setRooms(prev => prev.map(r => r.id === room.id ? { ...r, members: r.members.filter(id => id !== user.id) } : r));
    addRoomSystemMessage(room.id, `${user.nick} was kicked from ${room.name} by ${currentUser.nick}`, 'leave');
    setProfileUser(null);
  };

  /* ---------------- MESSAGE SENDING ---------------- */
  const usersById = useMemo(() => {
    const map = {};
    allUsers.forEach(u => map[u.id] = u);
    return map;
  }, [allUsers]);

  const sendMessage = () => {
    const text = messageInput.trim();
    if (!text || !currentUser) return;

    if (activePM) {
      // private message
      const key = pmKey(currentUser.id, activePM);
      const msg = { id: uid(), userId: currentUser.id, nick: currentUser.nick, text, time: nowStr(), full: fullTimestamp() };
      setPrivateMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] }));
      setMessageInput('');
      if (soundOn) Sounds.message();

      // simulate reply from the other user occasionally
      maybeSimulateReply(activePM, key, true);
    } else {
      const msg = {
        id: uid(), userId: currentUser.id, nick: currentUser.nick, text, time: nowStr(), system: false,
      };
      setMessages(prev => ({ ...prev, [activeRoomId]: [...(prev[activeRoomId] || []), msg] }));
      setMessageInput('');
      if (soundOn) Sounds.message();

      // notify mentioned users (within room)
      const room = rooms.find(r => r.id === activeRoomId);
      room.members.forEach(memberId => {
        if (memberId === currentUser.id) return;
        const member = usersById[memberId];
        if (member && containsMention(text, member.nick) && member.id !== currentUser.id) {
          if (member.id === currentUser.id) return;
          // this would notify the *other* user; for demo, if it's us being mentioned wouldn't happen here
        }
      });

      // simulate someone else responding
      maybeSimulateRoomReply(activeRoomId, text);
    }
  };

  const pmKey = (a, b) => [a, b].sort().join('|');

  const maybeSimulateRoomReply = (roomId, lastText) => {
    const room = rooms.find(r => r.id === roomId);
    const others = room.members.filter(id => id !== currentUser.id && usersById[id] && usersById[id].status !== 'offline' && !blocked.has(id));
    if (others.length === 0) return;
    if (Math.random() > 0.45) return; // not always reply

    const replier = usersById[others[Math.floor(Math.random() * others.length)]];
    if (!replier) return;

    // typing indicator
    setTypingUsers(prev => ({ ...prev, [roomId]: new Set([...(prev[roomId] || []), replier.nick]) }));

    setTimeout(() => {
      setTypingUsers(prev => {
        const next = new Set(prev[roomId] || []);
        next.delete(replier.nick);
        return { ...prev, [roomId]: next };
      });

      let line = AUTO_LINES[Math.floor(Math.random() * AUTO_LINES.length)];
      // small chance to mention current user
      if (Math.random() < 0.2) {
        line = `@${currentUser.nick} ${line}`;
      }

      const msg = { id: uid(), userId: replier.id, nick: replier.nick, text: line, time: nowStr(), system: false };
      setMessages(prev => ({ ...prev, [roomId]: [...(prev[roomId] || []), msg] }));

      if (roomId !== activeRoomId || activePM !== null) {
        setUnreadRooms(prev => new Set(prev).add(roomId));
      }

      if (containsMention(line, currentUser.nick)) {
        addNotification({ type: 'mention', text: `${replier.nick} mentioned you in ${room.name}: "${line}"` });
        if (soundOn) Sounds.mention();
      } else if (soundOn && (roomId !== activeRoomId || activePM !== null)) {
        Sounds.notify();
      } else if (soundOn) {
        Sounds.message();
      }
    }, 1200 + Math.random() * 1800);
  };

  const maybeSimulateReply = (otherUserId, key, force) => {
    const other = usersById[otherUserId];
    if (!other || blocked.has(otherUserId)) return;
    if (!force && Math.random() > 0.6) return;

    setPmTyping(prev => new Set(prev).add(otherUserId));
    setTimeout(() => {
      setPmTyping(prev => { const s = new Set(prev); s.delete(otherUserId); return s; });
      const replies = [
        'hey! got your message',
        'haha nice',
        'sure thing',
        'lol same',
        'one sec...',
        '👍 sounds good',
        'oh really? tell me more',
        'brb',
      ];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      const msg = { id: uid(), userId: other.id, nick: other.nick, text: reply, time: nowStr(), full: fullTimestamp() };
      setPrivateMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] }));

      if (activePM !== otherUserId) {
        setUnreadPMs(prev => new Set(prev).add(otherUserId));
        addNotification({ type: 'pm', text: `New PM from ${other.nick}: "${reply}"`, userId: other.id });
        if (soundOn) Sounds.pm();
      } else if (soundOn) {
        Sounds.message();
      }
    }, 1500 + Math.random() * 2000);
  };

  /* ---------------- TYPING INDICATOR (self) ---------------- */
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
  };

  /* ---------------- PM HANDLING ---------------- */
  const openPM = (user) => {
    setActivePM(user.id);
    setProfileUser(null);
    setUnreadPMs(prev => { const s = new Set(prev); s.delete(user.id); return s; });
    setShowMobileLeft(false);
    setShowMobileRight(false);
  };

  /* ---------------- FRIEND / BLOCK ---------------- */
  const toggleFriend = (user) => {
    setFriends(prev => {
      const next = new Set(prev);
      if (next.has(user.id)) next.delete(user.id); else next.add(user.id);
      return next;
    });
  };
  const toggleBlock = (user) => {
    setBlocked(prev => {
      const next = new Set(prev);
      if (next.has(user.id)) { next.delete(user.id); }
      else { next.add(user.id); if (activePM === user.id) setActivePM(null); }
      return next;
    });
  };

  /* ---------------- STATUS ---------------- */
  const setMyStatus = (status) => {
    setCurrentUser(prev => ({ ...prev, status }));
    setAllUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, status } : u));
    setStatusMenuOpen(false);
  };

  /* ---------------- SCROLL TO BOTTOM ---------------- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRoomId, privateMessages, activePM]);

  /* ---------------- AMBIENT: random status changes for seed users ---------------- */
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      setAllUsers(prev => prev.map(u => {
        if (SEED_USERS.find(s => s.id === u.id) && Math.random() < 0.08) {
          const statuses = ['online', 'away', 'online'];
          return { ...u, status: statuses[Math.floor(Math.random() * statuses.length)] };
        }
        return u;
      }));
    }, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  /* ---------------- EMOJI INSERT ---------------- */
  const insertEmoji = (emoji) => {
    setMessageInput(prev => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  /* ---------------- RENDER GUARD ---------------- */
  if (!currentUser) {
    return (
      <>
        <style>{CSS}</style>
        <AuthScreen onLogin={handleLogin} existingNicks={existingNicks} />
      </>
    );
  }

  /* ---------------- DERIVED ---------------- */
  const currentMessages = activePM
    ? (privateMessages[pmKey(currentUser.id, activePM)] || [])
    : (messages[activeRoomId] || []);

  const roomMembers = activeRoom ? activeRoom.members.map(id => usersById[id]).filter(Boolean) : [];
  const onlineUsers = allUsers.filter(u => !blocked.has(u.id));
  const isOwnerOrMod = activeRoom && (activeRoom.owner === currentUser.id || currentUser.rank === RANKS.ADMIN || currentUser.rank === RANKS.MOD);

  const filteredUsers = searchQuery.trim()
    ? onlineUsers.filter(u => u.nick.toLowerCase().includes(searchQuery.toLowerCase()))
    : onlineUsers;

  const friendsList = allUsers.filter(u => friends.has(u.id));
  const activePMUser = activePM ? usersById[activePM] : null;
  const isTypingInRoom = (typingUsers[activeRoomId] || new Set());
  const otherTypingInPM = activePM && pmTyping.has(activePM);

  const totalUnread = unreadPMs.size + unreadRooms.size + notifications.filter(n=>!n.read).length;

  return (
    <>
      <style>{CSS}</style>
      <div className={`crt-wrapper ${darkMode ? 'dark-mode' : ''}`}>
        <div className="scanlines" />
        <div className="win95-window main-window">
          <TitleBar
            title={`mIRC95 :: ${activePM ? `Query: ${activePMUser?.nick}` : activeRoom?.name || ''} :: connected as ${currentUser.nick}`}
            icon={<MessageSquare size={14} />}
          />

          {/* ===== TOP MENU BAR ===== */}
          <div className="menubar">
            <div className="menubar-left">
              <span className="menu-item">File</span>
              <span className="menu-item">View</span>
              <span className="menu-item">Tools</span>
              <span className="menu-item">Help</span>
            </div>
            <div className="menubar-right">
              <button className="icon-btn" title="Search users" onClick={() => setShowSearch(s => !s)}><Search size={14}/></button>
              <button className="icon-btn" title="Notifications" onClick={() => setShowNotifPanel(s => !s)}>
                <Bell size={14}/>
                {totalUnread > 0 && <span className="badge">{totalUnread > 9 ? '9+' : totalUnread}</span>}
              </button>
              <button className="icon-btn" title={soundOn ? 'Mute sounds' : 'Enable sounds'} onClick={() => setSoundOn(s => !s)}>
                {soundOn ? <Volume2 size={14}/> : <VolumeX size={14}/>}
              </button>
              <button className="icon-btn" title={darkMode ? 'Light mode' : 'Dark / terminal mode'} onClick={() => setDarkMode(d => !d)}>
                {darkMode ? <Sun size={14}/> : <Moon size={14}/>}
              </button>
              <button className="icon-btn" title="Logout" onClick={handleLogout}><LogOut size={14}/></button>
            </div>
          </div>

          {/* Search bar dropdown */}
          {showSearch && (
            <div className="search-bar">
              <Search size={12} />
              <input autoFocus placeholder="Search users by nickname..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}><X size={12}/></button>
            </div>
          )}

          {/* Notification panel */}
          {showNotifPanel && (
            <div className="notif-panel">
              <div className="notif-panel-header">
                <span>Notifications</span>
                <button onClick={() => setNotifications([])}>Clear all</button>
              </div>
              <div className="notif-list">
                {notifications.length === 0 && <div className="notif-empty">No notifications yet.</div>}
                {notifications.map(n => (
                  <div key={n.id} className={`notif-item notif-${n.type}`}>
                    <span className="notif-icon">
                      {n.type === 'mention' && <AtSign size={12}/>}
                      {n.type === 'pm' && <MessageCircle size={12}/>}
                      {n.type === 'room' && <Hash size={12}/>}
                      {n.type === 'error' && <Bell size={12}/>}
                    </span>
                    <div className="notif-text">{n.text}</div>
                    <span className="notif-time">{n.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== TOOLBAR ===== */}
          <div className="toolbar">
            <Win95Button title="Create new room" onClick={() => setShowCreateRoom(true)}><Plus size={12}/> New Room</Win95Button>
            <div className="toolbar-sep" />
            <Win95Button title="Status: Online" active={currentUser.status === 'online'} onClick={() => setMyStatus('online')}><span className="dot-green"/> Online</Win95Button>
            <Win95Button title="Status: Away" active={currentUser.status === 'away'} onClick={() => setMyStatus('away')}><span className="dot-yellow"/> Away</Win95Button>
            <Win95Button title="Status: Offline" active={currentUser.status === 'offline'} onClick={() => setMyStatus('offline')}><span className="dot-gray"/> Offline</Win95Button>
            <div className="toolbar-sep" />
            <button className="mobile-toggle" onClick={() => setShowMobileLeft(true)}><Hash size={12}/> Rooms</button>
            <button className="mobile-toggle" onClick={() => setShowMobileRight(true)}><Users size={12}/> Users</button>
          </div>

          {/* ===== MAIN 3-COLUMN LAYOUT ===== */}
          <div className="main-layout">

            {/* LEFT PANEL: rooms + friends + my profile */}
            <div className={`left-panel ${showMobileLeft ? 'mobile-show' : ''}`}>
              <div className="panel-header">
                <Avatar user={currentUser} size={32} />
                <div className="my-info">
                  <div className="my-nick">{currentUser.nick} <RankBadge rank={currentUser.rank}/></div>
                  <div className="my-status" onClick={() => setStatusMenuOpen(s => !s)}>
                    <StatusDot status={currentUser.status} /> {currentUser.status}
                    <ChevronDown size={10} />
                  </div>
                  {statusMenuOpen && (
                    <div className="status-menu">
                      <div onClick={() => setMyStatus('online')}><StatusDot status="online"/> Online</div>
                      <div onClick={() => setMyStatus('away')}><StatusDot status="away"/> Away</div>
                      <div onClick={() => setMyStatus('offline')}><StatusDot status="offline"/> Offline</div>
                    </div>
                  )}
                </div>
                <button className="mobile-close" onClick={() => setShowMobileLeft(false)}><X size={14}/></button>
              </div>

              <div className="section-header" onClick={() => setCollapsedSections(s => ({...s, rooms: !s.rooms}))}>
                {collapsedSections.rooms ? <ChevronRight size={12}/> : <ChevronDown size={12}/>} CHAT ROOMS ({rooms.length})
              </div>
              {!collapsedSections.rooms && (
                <div className="room-list">
                  {rooms.map(room => (
                    <div
                      key={room.id}
                      className={`room-item ${activeRoomId === room.id && !activePM ? 'active' : ''}`}
                      onClick={() => joinRoom(room)}
                    >
                      <span className="room-icon">{room.type === 'pin' ? <Lock size={12}/> : <Hash size={12}/>}</span>
                      <span className="room-name">{room.name}</span>
                      <span className="room-count">{room.members.length}</span>
                      {unreadRooms.has(room.id) && <span className="unread-dot" />}
                      {room.owner === currentUser.id && (
                        <button className="room-settings-btn" title="Room settings" onClick={(e) => { e.stopPropagation(); setRoomSettingsOpen(room); }}>
                          <Settings size={11}/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="section-header" onClick={() => setCollapsedSections(s => ({...s, friends: !s.friends}))}>
                {collapsedSections.friends ? <ChevronRight size={12}/> : <ChevronDown size={12}/>} FRIENDS ({friendsList.length})
              </div>
              {!collapsedSections.friends && (
                <div className="room-list">
                  {friendsList.length === 0 && <div className="empty-hint">No friends yet. Right-click... er, click a user to add one!</div>}
                  {friendsList.map(f => (
                    <div key={f.id} className={`room-item pm-item ${activePM === f.id ? 'active' : ''}`} onClick={() => openPM(f)}>
                      <StatusDot status={f.status} />
                      <span className="room-name">{f.nick}</span>
                      {unreadPMs.has(f.id) && <span className="unread-dot" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CENTER: messages */}
            <div className="center-panel">
              <div className="channel-header">
                <div className="channel-title">
                  {activePM ? (
                    <><MessageCircle size={14}/> Private chat with <b>{activePMUser?.nick}</b> <StatusDot status={activePMUser?.status}/></>
                  ) : (
                    <><Hash size={14}/> <b>{activeRoom?.name}</b> <span className="channel-desc">— {activeRoom?.description}</span></>
                  )}
                </div>
                {activePM && <button className="close-pm" onClick={() => setActivePM(null)}><X size={12}/> Back to room</button>}
              </div>

              <div className="messages-area">
                {currentMessages.map(msg => (
                  <MessageRow
                    key={msg.id}
                    msg={msg}
                    currentUser={currentUser}
                    usersById={usersById}
                    onAvatarClick={(u) => u && setProfileUser(u)}
                  />
                ))}
                {!activePM && isTypingInRoom.size > 0 && (
                  <div className="typing-indicator">
                    {[...isTypingInRoom].join(', ')} {isTypingInRoom.size === 1 ? 'is' : 'are'} typing<span className="typing-dots">...</span>
                  </div>
                )}
                {activePM && otherTypingInPM && (
                  <div className="typing-indicator">{activePMUser?.nick} is typing<span className="typing-dots">...</span></div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* INPUT BAR */}
              <div className="input-bar">
                <div className="emoji-wrap">
                  <button className="icon-btn" onClick={() => setShowEmoji(s => !s)} title="Insert emoji"><Smile size={16}/></button>
                  {showEmoji && (
                    <div className="emoji-picker">
                      {EMOJI_PALETTE.map(e => (
                        <button key={e} onClick={() => insertEmoji(e)}>{e}</button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  ref={inputRef}
                  className="msg-input"
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder={activePM ? `Message ${activePMUser?.nick}... (try *bold*, _italic_, @mention)` : `Message ${activeRoom?.name}... (try *bold*, _italic_, @mention, emojis)`}
                  maxLength={500}
                />
                <Win95Button onClick={sendMessage} className="send-btn"><Send size={13}/> Send</Win95Button>
              </div>
              <div className="statusbar">
                <span><Wifi size={11}/> Connected</span>
                <span>{activePM ? `Query: ${activePMUser?.nick}` : `${roomMembers.length} users in ${activeRoom?.name}`}</span>
                <span>{messageInput.length}/500</span>
              </div>
            </div>

            {/* RIGHT PANEL: users in room */}
            <div className={`right-panel ${showMobileRight ? 'mobile-show' : ''}`}>
              <div className="panel-header-simple">
                <Users size={13}/> {activePM ? 'All Users' : `Users in ${activeRoom?.name}`}
                <button className="mobile-close" onClick={() => setShowMobileRight(false)}><X size={14}/></button>
              </div>
              {searchQuery && (
                <div className="search-results-label">Search: "{searchQuery}" ({filteredUsers.length})</div>
              )}
              <div className="user-list">
                {(searchQuery ? filteredUsers : (activePM ? onlineUsers : roomMembers)).map(u => (
                  <div key={u.id} className="user-item" onClick={() => setProfileUser(u)}>
                    <Avatar user={u} size={22} />
                    <div className="user-item-info">
                      <div className="user-item-name">
                        {u.nick} <RankBadge rank={u.rank}/>
                        {u.id === currentUser.id && <span className="you-tag">(you)</span>}
                        {friends.has(u.id) && <Star size={10} style={{color:'#ffaa00', marginLeft:2}}/>}
                      </div>
                      <div className="user-item-status"><StatusDot status={u.status}/> {u.status}</div>
                    </div>
                  </div>
                ))}
                {(activePM ? onlineUsers : roomMembers).length === 0 && <div className="empty-hint">No users.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {profileUser && (
        <ProfileCard
          user={profileUser}
          myUserId={currentUser.id}
          onClose={() => setProfileUser(null)}
          onPM={(u) => openPM(u)}
          onFriend={toggleFriend}
          onBlock={toggleBlock}
          isFriend={friends.has(profileUser.id)}
          isBlocked={blocked.has(profileUser.id)}
          canModerate={isOwnerOrMod && profileUser.id !== currentUser.id && roomMembers.some(m=>m.id===profileUser.id)}
          onKick={kickFromProfileCard}
        />
      )}

      {showCreateRoom && <CreateRoomModal onClose={() => setShowCreateRoom(false)} onCreate={createRoom} />}

      {pinPromptRoom && <PinModal room={pinPromptRoom} onClose={() => setPinPromptRoom(null)} onSubmit={submitPin} />}

      {roomSettingsOpen && (
        <RoomSettingsModal
          room={roomSettingsOpen}
          members={roomSettingsOpen.members.map(id => usersById[id]).filter(Boolean)}
          onClose={() => setRoomSettingsOpen(null)}
          onSave={saveRoomSettings}
          onDelete={deleteRoom}
          onRemoveMember={removeMemberFromRoom}
        />
      )}
    </>
  );
}

/* =========================================================================
   MESSAGE ROW
   ========================================================================= */
function MessageRow({ msg, currentUser, usersById, onAvatarClick }) {
  if (msg.system) {
    return (
      <div className={`system-msg sys-${msg.kind || 'info'}`}>
        <span className="sys-icon">{msg.kind === 'join' ? '→' : msg.kind === 'leave' ? '←' : '*'}</span> {msg.text} <span className="msg-time">[{msg.time}]</span>
      </div>
    );
  }
  const user = usersById[msg.userId];
  const mentioned = containsMention(msg.text, currentUser.nick) && msg.userId !== currentUser.id;
  const isMe = msg.userId === currentUser.id;
  return (
    <div className={`message-row ${mentioned ? 'mentioned' : ''} ${isMe ? 'message-mine' : ''}`}>
      <button className="msg-avatar-btn" onClick={() => onAvatarClick(user)}>
        <Avatar user={user || { nick: msg.nick }} size={26} />
      </button>
      <div className="message-content">
        <div className="message-header">
          <span className="message-nick" onClick={() => onAvatarClick(user)}>{msg.nick}</span>
          {user && <RankBadge rank={user.rank} />}
          <span className="msg-time">{msg.time}</span>
        </div>
        <div className="message-text" dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text, currentUser.nick) }} />
      </div>
    </div>
  );
}

/* =========================================================================
   CSS — Windows 95 / mIRC themed
   ========================================================================= */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&family=MS+Sans+Serif&display=swap');

:root {
  --win-gray: #c0c0c0;
  --win-gray-light: #dfdfdf;
  --win-gray-dark: #808080;
  --win-shadow: #000000;
  --win-blue: #000080;
  --win-blue-light: #1084d0;
  --win-bg: #c0c0c0;
  --win-text: #000000;
  --win-input-bg: #ffffff;
  --accent: #000080;
}

.dark-mode {
  --win-gray: #2a2a2a;
  --win-gray-light: #3a3a3a;
  --win-gray-dark: #161616;
  --win-shadow: #000000;
  --win-blue: #003300;
  --win-blue-light: #00aa00;
  --win-bg: #0d0d0d;
  --win-text: #00ff41;
  --win-input-bg: #0a0a0a;
  --accent: #00ff41;
}

* { box-sizing: border-box; }

.crt-wrapper {
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  background: #008080;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'MS Sans Serif', 'VT323', Tahoma, Geneva, sans-serif;
  position: relative;
  overflow: hidden;
  padding: 8px;
}

.dark-mode.crt-wrapper, .dark-mode .crt-wrapper {
  background: #000000;
}

.scanlines {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0) 0px,
    rgba(0,0,0,0) 1px,
    rgba(0,0,0,0.04) 2px,
    rgba(0,0,0,0.04) 3px
  );
  pointer-events: none;
  z-index: 1000;
  mix-blend-mode: multiply;
}

.dark-mode .scanlines {
  background: repeating-linear-gradient(
    to bottom,
    rgba(0,255,65,0) 0px,
    rgba(0,255,65,0) 1px,
    rgba(0,255,65,0.05) 2px,
    rgba(0,255,65,0.05) 3px
  );
  box-shadow: inset 0 0 100px rgba(0,255,65,0.08);
}

/* ===== WIN95 WINDOW BASE ===== */
.win95-window {
  background: var(--win-bg);
  border: 2px solid;
  border-color: var(--win-gray-light) var(--win-shadow) var(--win-shadow) var(--win-gray-light);
  box-shadow: inset 1px 1px 0 var(--win-gray-light), 3px 3px 8px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  color: var(--win-text);
  font-size: 12px;
}

.main-window {
  width: 100%;
  max-width: 1400px;
  height: 100%;
  max-height: 900px;
}

.auth-window {
  width: 420px;
  max-width: 95vw;
}

/* ===== TITLE BAR ===== */
.titlebar {
  background: linear-gradient(90deg, var(--win-blue), var(--win-blue-light));
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 4px 3px 6px;
  font-weight: bold;
  font-size: 12px;
  flex-shrink: 0;
}
.dark-mode .titlebar {
  background: linear-gradient(90deg, #001a00, #003300);
  color: var(--accent);
  text-shadow: 0 0 4px #00ff41;
}
.titlebar-left { display: flex; align-items: center; gap: 5px; overflow: hidden; }
.titlebar-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'MS Sans Serif', Tahoma, sans-serif; }
.titlebar-buttons { display: flex; gap: 2px; flex-shrink: 0; }
.tb-btn {
  width: 18px; height: 16px;
  background: var(--win-gray);
  border: 1px solid;
  border-color: var(--win-gray-light) var(--win-shadow) var(--win-shadow) var(--win-gray-light);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: black;
  padding: 0;
}
.tb-btn:active { border-color: var(--win-shadow) var(--win-gray-light) var(--win-gray-light) var(--win-shadow); }
.tb-close:hover { background: #ff8080; }

/* ===== MENU BAR ===== */
.menubar {
  background: var(--win-gray);
  border-bottom: 1px solid var(--win-gray-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
  flex-shrink: 0;
  position: relative;
}
.menubar-left { display: flex; gap: 12px; }
.menu-item { padding: 2px 6px; cursor: pointer; font-size: 11px; }
.menu-item:hover { background: var(--win-blue); color: white; }
.menubar-right { display: flex; gap: 2px; }
.icon-btn {
  background: var(--win-gray);
  border: 1px solid;
  border-color: var(--win-gray-light) var(--win-gray-dark) var(--win-gray-dark) var(--win-gray-light);
  width: 26px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: var(--win-text);
  position: relative;
}
.icon-btn:active { border-color: var(--win-gray-dark) var(--win-gray-light) var(--win-gray-light) var(--win-gray-dark); }
.badge {
  position: absolute; top: -3px; right: -3px;
  background: #ff0000; color: white;
  font-size: 9px; font-weight: bold;
  border-radius: 50%;
  min-width: 14px; height: 14px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid white;
  padding: 0 2px;
}

/* ===== SEARCH BAR ===== */
.search-bar {
  display: flex; align-items: center; gap: 6px;
  background: var(--win-gray);
  border-bottom: 1px solid var(--win-gray-dark);
  padding: 4px 8px;
  flex-shrink: 0;
}
.search-bar input {
  flex: 1;
  font-family: inherit;
  font-size: 11px;
  padding: 3px 4px;
  border: 1px solid;
  border-color: var(--win-gray-dark) var(--win-gray-light) var(--win-gray-light) var(--win-gray-dark);
  background: var(--win-input-bg);
  color: var(--win-text);
}
.search-bar button {
  background: var(--win-gray);
  border: 1px solid var(--win-gray-dark);
  cursor: pointer;
  display: flex; align-items: center;
}

/* ===== NOTIFICATION PANEL ===== */
.notif-panel {
  position: absolute;
  top: 56px;
  right: 8px;
  width: 320px;
  max-width: 90vw;
  background: var(--win-gray);
  border: 2px solid;
  border-color: var(--win-gray-light) var(--win-shadow) var(--win-shadow) var(--win-gray-light);
  z-index: 500;
  box-shadow: 3px 3px 8px rgba(0,0,0,0.5);
  max-height: 350px;
  display: flex;
  flex-direction: column;
}
.notif-panel-header {
  background: var(--win-blue);
  color: white;
  padding: 4px 8px;
  display: flex; justify-content: space-between; align-items: center;
  font-weight: bold; font-size: 11px;
}
.dark-mode .notif-panel-header { background: #003300; color: var(--accent); }
.notif-panel-header button {
  background: var(--win-gray);
  border: 1px solid var(--win-gray-dark);
  font-size: 10px; cursor: pointer; padding: 1px 6px;
}
.notif-list { overflow-y: auto; padding: 4px; }
.notif-empty { padding: 16px; text-align: center; color: var(--win-gray-dark); font-size: 11px; }
.notif-item {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 6px; border-bottom: 1px solid var(--win-gray-dark);
  font-size: 11px; background: var(--win-input-bg); margin-bottom: 2px;
}
.notif-icon { flex-shrink: 0; margin-top: 1px; }
.notif-text { flex: 1; }
.notif-time { font-size: 9px; color: var(--win-gray-dark); flex-shrink: 0; }
.notif-mention { border-left: 3px solid #ff8800; }
.notif-pm { border-left: 3px solid #0088ff; }

/* ===== TOOLBAR ===== */
.toolbar {
  background: var(--win-gray);
  border-bottom: 1px solid var(--win-gray-dark);
  display: flex; align-items: center; gap: 4px;
  padding: 3px 6px;
  flex-shrink: 0;
  overflow-x: auto;
  flex-wrap: nowrap;
}
.toolbar-sep { width: 1px; height: 20px; background: var(--win-gray-dark); margin: 0 4px; flex-shrink: 0; }
.dot-green, .dot-yellow, .dot-gray { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 3px; }
.dot-green { background: #00cc00; }
.dot-yellow { background: #ffaa00; }
.dot-gray { background: #888; }

.mobile-toggle {
  display: none;
  background: var(--win-gray);
  border: 1px solid;
  border-color: var(--win-gray-light) var(--win-gray-dark) var(--win-gray-dark) var(--win-gray-light);
  font-size: 11px; padding: 3px 8px;
  cursor: pointer;
  align-items: center; gap: 4px;
  color: var(--win-text);
  font-family: inherit;
  flex-shrink: 0;
}

/* ===== WIN95 BUTTON ===== */
.win95-btn {
  background: var(--win-gray);
  border: 1px solid;
  border-color: var(--win-gray-light) var(--win-gray-dark) var(--win-gray-dark) var(--win-gray-light);
  box-shadow: inset 1px 1px 0 var(--win-gray-light);
  padding: 4px 10px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  color: var(--win-text);
  display: flex; align-items: center; gap: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}
.win95-btn:active, .win95-btn-active {
  border-color: var(--win-gray-dark) var(--win-gray-light) var(--win-gray-light) var(--win-gray-dark);
  box-shadow: inset 1px 1px 0 rgba(0,0,0,0.2);
  background: #b0b0b0;
}
.win95-btn:disabled { color: var(--win-gray-dark); cursor: default; }
.win95-btn.danger-btn { color: #aa0000; }
.dark-mode .win95-btn.danger-btn { color: #ff5555; }

/* ===== MAIN LAYOUT ===== */
.main-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* LEFT PANEL */
.left-panel {
  width: 200px;
  flex-shrink: 0;
  background: var(--win-gray);
  border-right: 2px solid var(--win-gray-dark);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.panel-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--win-gray-dark);
  background: var(--win-gray-light);
  position: relative;
}
.my-info { flex: 1; overflow: hidden; }
.my-nick { font-weight: bold; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display:flex; align-items:center; }
.my-status {
  font-size: 10px; display: flex; align-items: center; gap: 3px; cursor: pointer;
  color: var(--win-gray-dark);
}
.dark-mode .my-status { color: #00aa00; }
.status-menu {
  position: absolute;
  top: 100%; left: 8px;
  background: var(--win-gray);
  border: 2px solid;
  border-color: var(--win-gray-light) var(--win-shadow) var(--win-shadow) var(--win-gray-light);
  z-index: 100;
  font-size: 11px;
  min-width: 90px;
}
.status-menu div { padding: 4px 8px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.status-menu div:hover { background: var(--win-blue); color: white; }

.section-header {
  padding: 4px 8px;
  font-size: 10px; font-weight: bold;
  background: var(--win-gray-dark);
  color: white;
  cursor: pointer;
  display: flex; align-items: center; gap: 4px;
  letter-spacing: 0.5px;
  user-select: none;
}
.dark-mode .section-header { background: #001a00; color: var(--accent); }

.room-list { padding: 2px; }
.room-item {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 6px;
  cursor: pointer;
  font-size: 11px;
  border: 1px solid transparent;
  position: relative;
}
.room-item:hover { background: var(--win-gray-light); }
.room-item.active {
  background: var(--win-blue);
  color: white;
  border-color: var(--win-shadow) var(--win-gray-light) var(--win-gray-light) var(--win-shadow);
}
.dark-mode .room-item.active { background: #003300; color: var(--accent); }
.room-icon { flex-shrink: 0; }
.room-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.room-count {
  font-size: 9px; background: var(--win-gray-dark); color: white;
  border-radius: 8px; padding: 0px 5px; flex-shrink: 0;
}
.room-item.active .room-count { background: rgba(255,255,255,0.3); }
.room-settings-btn {
  background: transparent; border: none; cursor: pointer; color: inherit;
  display: flex; align-items: center; flex-shrink: 0; opacity: 0.7;
}
.room-settings-btn:hover { opacity: 1; }
.unread-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #ff4444;
  flex-shrink: 0; border: 1px solid white;
}
.pm-item { gap: 6px; }
.empty-hint { padding: 8px; font-size: 10px; color: var(--win-gray-dark); font-style: italic; }
.dark-mode .empty-hint { color: #006600; }

/* CENTER PANEL */
.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--win-input-bg);
}
.channel-header {
  background: var(--win-gray);
  border-bottom: 1px solid var(--win-gray-dark);
  padding: 6px 10px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px;
  flex-shrink: 0;
}
.channel-title { display: flex; align-items: center; gap: 6px; overflow: hidden; }
.channel-desc { color: var(--win-gray-dark); font-weight: normal; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dark-mode .channel-desc { color: #008800; }
.close-pm {
  background: var(--win-gray); border: 1px solid var(--win-gray-dark);
  font-size: 10px; cursor: pointer; padding: 3px 8px; display: flex; align-items: center; gap: 3px;
  flex-shrink: 0;
  color: var(--win-text);
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px;
  background: var(--win-input-bg);
  font-family: 'Courier New', 'VT323', monospace;
  font-size: 13px;
  line-height: 1.5;
}
.dark-mode .messages-area { background: #0a0a0a; }

.system-msg {
  color: #008800;
  font-style: italic;
  font-size: 12px;
  padding: 2px 0;
}
.dark-mode .system-msg { color: #00aa00; }
.sys-join { color: #009900; }
.sys-leave { color: #aa6600; }
.msg-time { color: var(--win-gray-dark); font-size: 10px; margin-left: 4px; }
.dark-mode .msg-time { color: #007700; }

.message-row {
  display: flex; gap: 8px; padding: 4px 2px;
  border-bottom: 1px solid transparent;
}
.message-row:hover { background: rgba(0,0,128,0.04); }
.dark-mode .message-row:hover { background: rgba(0,255,65,0.05); }
.message-row.mentioned {
  background: rgba(255,170,0,0.15);
  border-left: 3px solid #ff8800;
  padding-left: 5px;
}
.msg-avatar-btn { background: transparent; border: none; cursor: pointer; padding: 0; flex-shrink: 0; }
.message-content { flex: 1; min-width: 0; }
.message-header { display: flex; align-items: baseline; gap: 4px; }
.message-nick { font-weight: bold; color: var(--win-blue); cursor: pointer; font-size: 12.5px; }
.dark-mode .message-nick { color: var(--accent); }
.message-mine .message-nick { color: #aa00aa; }
.dark-mode .message-mine .message-nick { color: #ffff00; }
.message-text { word-break: break-word; white-space: pre-wrap; }
.message-text .mention { background: rgba(0,0,255,0.12); color: var(--win-blue); font-weight: bold; padding: 0 2px; border-radius: 2px; }
.message-text .mention-me { background: #ffaa00; color: #000; }
.dark-mode .message-text .mention { background: rgba(0,255,65,0.15); color: var(--accent); }
.dark-mode .message-text .mention-me { background: var(--accent); color: #000; }

.typing-indicator {
  font-size: 11px; color: var(--win-gray-dark); font-style: italic;
  padding: 4px 2px;
}
.dark-mode .typing-indicator { color: #00aa00; }
.typing-dots { animation: blink 1.2s infinite; }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.2; } }

/* INPUT BAR */
.input-bar {
  display: flex; gap: 4px; align-items: center;
  padding: 6px 8px;
  background: var(--win-gray);
  border-top: 1px solid var(--win-gray-dark);
  flex-shrink: 0;
  position: relative;
}
.msg-input {
  flex: 1;
  font-family: 'Courier New', 'VT323', monospace;
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid;
  border-color: var(--win-gray-dark) var(--win-gray-light) var(--win-gray-light) var(--win-gray-dark);
  background: var(--win-input-bg);
  color: var(--win-text);
  min-width: 0;
}
.dark-mode .msg-input { caret-color: var(--accent); }
.send-btn { flex-shrink: 0; }

.emoji-wrap { position: relative; flex-shrink: 0; }
.emoji-picker {
  position: absolute;
  bottom: 100%; left: 0;
  background: var(--win-gray);
  border: 2px solid;
  border-color: var(--win-gray-light) var(--win-shadow) var(--win-shadow) var(--win-gray-light);
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
  padding: 6px;
  z-index: 200;
  box-shadow: 3px 3px 6px rgba(0,0,0,0.4);
}
.emoji-picker button {
  background: transparent; border: 1px solid transparent;
  font-size: 16px; cursor: pointer; padding: 3px;
  width: 28px; height: 28px;
}
.emoji-picker button:hover { background: var(--win-gray-light); border-color: var(--win-gray-dark); }

/* STATUS BAR */
.statusbar {
  background: var(--win-gray);
  border-top: 1px solid var(--win-gray-light);
  display: flex; justify-content: space-between;
  padding: 2px 8px;
  font-size: 10px;
  color: var(--win-text);
  flex-shrink: 0;
  gap: 8px;
}
.statusbar span { display: flex; align-items: center; gap: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* RIGHT PANEL */
.right-panel {
  width: 200px;
  flex-shrink: 0;
  background: var(--win-gray);
  border-left: 2px solid var(--win-gray-dark);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.panel-header-simple {
  padding: 6px 8px;
  font-size: 11px; font-weight: bold;
  background: var(--win-gray-light);
  border-bottom: 1px solid var(--win-gray-dark);
  display: flex; align-items: center; gap: 5px;
  position: relative;
}
.search-results-label { font-size: 10px; padding: 4px 8px; color: var(--win-gray-dark); border-bottom: 1px solid var(--win-gray-dark); }
.user-list { padding: 2px; overflow-y: auto; }
.user-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px;
  cursor: pointer;
  font-size: 11px;
}
.user-item:hover { background: var(--win-gray-light); }
.user-item-info { flex: 1; min-width: 0; }
.user-item-name { font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display:flex; align-items:center; gap:2px; }
.user-item-status { font-size: 9px; color: var(--win-gray-dark); display: flex; align-items: center; gap: 3px; }
.dark-mode .user-item-status { color: #007700; }
.you-tag { font-size: 9px; color: var(--win-gray-dark); font-weight: normal; margin-left: 2px; }
.status-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.3); flex-shrink: 0;
}

.mobile-close { display: none; background: transparent; border: none; cursor: pointer; color: var(--win-text); margin-left: auto; }

/* ===== AVATAR ===== */
.avatar-box {
  border-radius: 2px;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; color: #fff;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.4);
  border: 1px solid rgba(0,0,0,0.3);
  flex-shrink: 0;
  font-family: 'MS Sans Serif', Tahoma, sans-serif;
}

/* ===== AUTH SCREEN ===== */
.auth-bg { background: #008080; }
.auth-body { padding: 12px; }
.auth-banner { text-align: center; margin-bottom: 10px; }
.auth-banner-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 16px;
  color: var(--win-blue);
  text-shadow: 1px 1px 0 #fff;
}
.auth-banner-sub { font-size: 11px; color: var(--win-gray-dark); margin-top: 4px; }

.auth-tabs { display: flex; border-bottom: 2px solid var(--win-gray-dark); margin-bottom: 10px; }
.auth-tab {
  flex: 1; padding: 6px; font-size: 11px; font-family: inherit;
  background: var(--win-gray-light); border: 1px solid var(--win-gray-dark);
  border-bottom: none; cursor: pointer; color: var(--win-text);
}
.auth-tab.active { background: var(--win-gray); font-weight: bold; border-bottom: 2px solid var(--win-gray); margin-bottom: -2px; }

.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.field-row label { width: 80px; flex-shrink: 0; font-size: 11px; text-align: right; }
.field-row input {
  flex: 1; padding: 4px 6px; font-size: 12px; font-family: inherit;
  border: 1px solid;
  border-color: var(--win-gray-dark) var(--win-gray-light) var(--win-gray-light) var(--win-gray-dark);
  background: var(--win-input-bg); color: var(--win-text); min-width: 0;
}
.pw-input-wrap { flex: 1; display: flex; gap: 2px; min-width: 0; }
.pw-input-wrap input { flex: 1; }
.pw-toggle { background: var(--win-gray); border: 1px solid var(--win-gray-dark); cursor: pointer; display: flex; align-items: center; padding: 0 6px; }

.auth-error {
  background: #ffe0e0; border: 1px solid #ff0000; color: #aa0000;
  font-size: 11px; padding: 4px 6px; margin-bottom: 8px;
}
.auth-actions { display: flex; gap: 6px; justify-content: center; margin-top: 6px; flex-wrap: wrap; }
.auth-submit { font-weight: bold; padding: 6px 16px; }
.auth-footer {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 10px; font-size: 10px; color: var(--win-gray-dark);
}

/* ===== MODALS ===== */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 12px;
}
.profile-card { width: 320px; max-width: 100%; }
.create-room-modal { width: 380px; max-width: 100%; }
.pin-modal { width: 300px; max-width: 100%; }
.profile-body { padding: 12px; }

.profile-header { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--win-gray-dark); }
.profile-namebox { flex: 1; }
.profile-name { font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 2px; }
.profile-status { font-size: 11px; display: flex; align-items: center; gap: 4px; color: var(--win-gray-dark); margin-top: 2px; }
.dark-mode .profile-status { color: #00aa00; }
.guest-tag {
  font-size: 9px; background: var(--win-gray-dark); color: white;
  padding: 1px 4px; border-radius: 2px; margin-left: 4px;
}
.profile-fields { margin-bottom: 10px; }
.profile-field { font-size: 11px; padding: 2px 0; }
.pf-label { font-weight: bold; display: inline-block; width: 60px; }
.profile-actions { display: flex; flex-direction: column; gap: 4px; }
.profile-actions .win95-btn { justify-content: flex-start; }

.radio-row { display: flex; gap: 12px; }
.radio-opt { display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer; }

.member-manage-list {
  flex: 1; max-height: 110px; overflow-y: auto;
  border: 1px solid var(--win-gray-dark); background: var(--win-input-bg); padding: 4px;
}
.member-manage-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; font-size: 11px; }
.kick-x { background: #ffe0e0; border: 1px solid #aa0000; color: #aa0000; cursor: pointer; margin-left: auto; display: flex; align-items: center; }

/* ===== RESPONSIVE ===== */
@media (max-width: 860px) {
  .crt-wrapper { padding: 0; }
  .main-window { max-height: 100vh; height: 100vh; border: none; }
  .left-panel, .right-panel {
    position: absolute; top: 0; bottom: 0;
    width: 230px; max-width: 80vw;
    z-index: 300;
    box-shadow: 3px 0 8px rgba(0,0,0,0.4);
    transform: translateX(-110%);
    transition: transform 0.2s ease;
  }
  .right-panel { left: auto; right: 0; transform: translateX(110%); box-shadow: -3px 0 8px rgba(0,0,0,0.4); }
  .left-panel.mobile-show, .right-panel.mobile-show { transform: translateX(0); }
  .mobile-toggle { display: flex; }
  .mobile-close { display: flex; }
  .field-row label { width: 60px; font-size: 10px; }
  .menu-item:nth-child(3), .menu-item:nth-child(4) { display: none; }
}

@media (max-width: 480px) {
  .titlebar-text { font-size: 10px; }
  .channel-desc { display: none; }
  .auth-window { width: 100%; }
  .notif-panel { width: 95vw; right: 2.5vw; }
}

/* Scrollbars - retro style */
::-webkit-scrollbar { width: 14px; height: 14px; }
::-webkit-scrollbar-track { background: var(--win-gray-light); }
::-webkit-scrollbar-thumb { background: var(--win-gray); border: 1px solid var(--win-gray-dark); }
::-webkit-scrollbar-button { background: var(--win-gray); border: 1px solid var(--win-gray-dark); }
`;
