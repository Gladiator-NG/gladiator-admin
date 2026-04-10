import { useState, useRef, useEffect } from 'react';
import { Bell, HelpCircle, Settings, LogOut, Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../features/authentication/useUser';
import { useSignOut } from '../hooks/useSignOut';
import SettingsModal from './SettingsModal';
import styles from './styles/Header.module.css';

interface HeaderProps {
  onMenuClick: () => void;
}

function Header({ onMenuClick }: HeaderProps) {
  const { user } = useUser();
  const { logout, isPending } = useSignOut();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName =
    (user?.user_metadata?.full_name as string) ?? user?.email ?? 'Admin User';
  const role = (user?.user_metadata?.role as string) ?? 'Fleet Manager';
  const initial = displayName.charAt(0).toUpperCase();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className={styles.header}>
        {/* Hamburger — only visible on tablet/mobile */}
        <button
          className={styles.hamburger}
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu />
        </button>

        {/* Right actions */}
        <div className={styles.actions}>
          <button className={styles.iconBtn} title="Notifications">
            <Bell />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.hideMobile}`}
            title="Help"
            onClick={() => navigate('/help')}
          >
            <HelpCircle />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.hideMobile}`}
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings />
          </button>

          <div className={styles.userInfoWrapper} ref={menuRef}>
            <div
              className={styles.userInfo}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <div className={styles.avatar}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User avatar" />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div className={styles.userText}>
                <span className={styles.userName}>{displayName}</span>
                <span className={styles.userRole}>{role}</span>
              </div>
            </div>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className={styles.userMenu}
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <button
                    className={styles.userMenuItem}
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    disabled={isPending}
                  >
                    <LogOut />
                    <span>{isPending ? 'Signing out…' : 'Log Out'}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

export default Header;
