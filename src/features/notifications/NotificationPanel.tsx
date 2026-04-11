import { useRef, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Ship,
  Home,
  UserPlus,
  UserCheck,
  RefreshCw,
  X,
  Settings,
  ArrowLeft,
  Mail,
  Trash2,
} from 'lucide-react';
import {
  useNotifications,
  useNotificationPreferences,
} from './useNotifications';
import type {
  AppNotification,
  NotificationPreferences,
} from '../../services/apiNotifications';
import styles from './NotificationPanel.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  switch (type) {
    case 'new_booking':
      return <BookOpen size={15} />;
    case 'booking_status':
      return <RefreshCw size={15} />;
    case 'new_boat':
      return <Ship size={15} />;
    case 'new_beach_house':
      return <Home size={15} />;
    case 'new_customer':
      return <UserPlus size={15} />;
    case 'new_user':
      return <UserCheck size={15} />;
    case 'delete_booking':
      return <Trash2 size={15} />;
    case 'delete_customer':
      return <Trash2 size={15} />;
    case 'delete_boat':
      return <Trash2 size={15} />;
    case 'delete_beach_house':
      return <Trash2 size={15} />;
    case 'delete_user':
      return <Trash2 size={15} />;
    default:
      return <Bell size={15} />;
  }
}

function notifLink(n: AppNotification): string {
  switch (n.entity_type) {
    case 'booking':
      return n.entity_id ? `/bookings?open=${n.entity_id}` : '/bookings';
    case 'boat':
      return '/boats';
    case 'beach_house':
      return '/beach-houses';
    case 'customer': {
      const name = (n.metadata as { full_name?: string } | null)?.full_name;
      return name
        ? `/bookings?tab=customers&cq=${encodeURIComponent(name)}`
        : '/bookings?tab=customers';
    }
    case 'user':
      return '/users';
    default:
      return '/dashboard';
  }
}

// ── Settings rows config ──────────────────────────────────────────────────────
const TYPE_SETTINGS: Array<{
  key: keyof NotificationPreferences;
  label: string;
}> = [
  { key: 'notif_new_booking', label: 'New bookings created' },
  { key: 'notif_booking_status', label: 'Booking status changes' },
  { key: 'notif_delete_booking', label: 'Bookings deleted' },
  { key: 'notif_new_boat', label: 'New boats added' },
  { key: 'notif_delete_boat', label: 'Boats deleted' },
  { key: 'notif_new_beach_house', label: 'New beach houses added' },
  { key: 'notif_delete_beach_house', label: 'Beach houses deleted' },
  { key: 'notif_new_customer', label: 'New customers' },
  { key: 'notif_delete_customer', label: 'Customers deleted' },
  { key: 'notif_new_user', label: 'New staff accounts' },
  { key: 'notif_delete_user', label: 'Staff accounts removed' },
];

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`${styles.toggle} ${checked ? styles.toggleOn : styles.toggleOff}`}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  bellRef: React.RefObject<HTMLButtonElement | null>;
}

function NotificationPanel({ isOpen, onClose, bellRef }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'settings'>('list');
  const { notifications, markRead, markAllRead } = useNotifications();
  const { preferences, savePreferences, isSaving } =
    useNotificationPreferences();

  // Filter out types the user has disabled
  const visibleNotifications = notifications.filter((n) => {
    const key = `notif_${n.type}` as keyof NotificationPreferences;
    return preferences?.[key] !== false;
  });

  const visibleUnread = visibleNotifications.filter((n) => !n.is_read).length;

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose, bellRef]);

  // Reset to list view when panel closes
  useEffect(() => {
    if (!isOpen) setView('list');
  }, [isOpen]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

  function handleItemClick(n: AppNotification) {
    if (!n.is_read) markRead(n.id);
    navigate(notifLink(n));
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          {isMobile && (
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
            />
          )}
          <motion.div
            ref={panelRef}
            className={styles.panel}
            initial={
              isMobile
                ? { opacity: 1, y: '100%' }
                : { opacity: 0, y: -8, scale: 0.97 }
            }
            animate={
              isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              isMobile
                ? { opacity: 1, y: '100%' }
                : { opacity: 0, y: -8, scale: 0.97 }
            }
            transition={{
              duration: isMobile ? 0.28 : 0.15,
              ease: [0.32, 0.72, 0, 1],
            }}
          >
            {/* Mobile drag handle */}
            {isMobile && <div className={styles.dragHandle} />}
            {/* ── Header ── */}
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                {view === 'settings' ? (
                  <button
                    className={styles.backBtn}
                    onClick={() => setView('list')}
                  >
                    <ArrowLeft size={15} />
                    <span>Notification Settings</span>
                  </button>
                ) : (
                  <>
                    <span>Notifications</span>
                    {visibleUnread > 0 && (
                      <span className={styles.unreadPill}>{visibleUnread}</span>
                    )}
                  </>
                )}
              </div>
              <div className={styles.panelActions}>
                {view === 'list' && visibleUnread > 0 && (
                  <button
                    className={styles.markAllBtn}
                    onClick={() => markAllRead()}
                  >
                    Mark all read
                  </button>
                )}
                {view === 'list' && (
                  <button
                    className={styles.settingsBtn}
                    onClick={() => setView('settings')}
                    title="Notification settings"
                  >
                    <Settings size={15} />
                  </button>
                )}
                <button
                  className={styles.closeBtn}
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── Settings view ── */}
            {view === 'settings' && (
              <div className={styles.settingsList}>
                <p className={styles.settingsHint}>
                  Choose which events show up in your notification feed. These
                  settings apply only to you.
                </p>

                <div className={styles.settingsGroup}>
                  <p className={styles.settingsGroupLabel}>Email</p>
                  <div className={styles.settingsRow}>
                    <div className={styles.settingsRowInfo}>
                      <Mail size={14} />
                      <span>Email notifications</span>
                    </div>
                    <Toggle
                      checked={preferences?.email_notifications ?? true}
                      onChange={() =>
                        savePreferences({
                          email_notifications: !(
                            preferences?.email_notifications ?? true
                          ),
                        })
                      }
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className={styles.settingsGroup}>
                  <p className={styles.settingsGroupLabel}>In-app events</p>
                  {TYPE_SETTINGS.map(({ key, label }) => (
                    <div key={key} className={styles.settingsRow}>
                      <span className={styles.settingsRowLabel}>{label}</span>
                      <Toggle
                        checked={preferences?.[key] !== false}
                        onChange={() =>
                          savePreferences({
                            [key]: !(preferences?.[key] !== false),
                          })
                        }
                        disabled={isSaving}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Notifications list ── */}
            {view === 'list' && (
              <div className={styles.list}>
                {visibleNotifications.length === 0 ? (
                  <div className={styles.empty}>
                    <Bell size={28} />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  visibleNotifications.map((n) => (
                    <button
                      key={n.id}
                      className={`${styles.item} ${n.is_read ? styles.itemRead : styles.itemUnread}`}
                      onClick={() => handleItemClick(n)}
                    >
                      <span className={styles.iconWrap}>
                        <NotifIcon type={n.type} />
                      </span>
                      <div className={styles.itemBody}>
                        <p
                          className={`${styles.itemTitle} ${!n.is_read ? styles.itemTitleBold : ''}`}
                        >
                          {n.title}
                        </p>
                        <p className={styles.itemMessage}>{n.message}</p>
                        <p className={styles.itemTime}>
                          {n.actor_name && (
                            <span className={styles.itemActor}>
                              by {n.actor_name} ·{' '}
                            </span>
                          )}
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {!n.is_read && <span className={styles.dot} />}
                    </button>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default NotificationPanel;
