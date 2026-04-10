import { useNavigate } from 'react-router-dom';
import { BarChart2, BookOpen, Ship, Home, Users, User, X } from 'lucide-react';
import SidebarLink from './SidebarLink';
import { useIsAdmin } from '../features/authentication/useIsAdmin';
import styles from './styles/Sidebar.module.css';

const baseLinks = [
  { icon: <BarChart2 />, label: 'Dashboard', to: '/dashboard' },
  { icon: <BookOpen />, label: 'Bookings', to: '/bookings' },
  { icon: <Ship />, label: 'Boats', to: '/boats' },
  { icon: <Home />, label: 'Beach Houses', to: '/beach-houses' },
  { icon: <Users />, label: 'Users', to: '/users', adminOnly: true },
  { icon: <User />, label: 'Profile', to: '/profile' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const links = baseLinks.filter((l) => !l.adminOnly || isAdmin);

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
      {/* Logo */}
      <div
        className={styles.logoArea}
        onClick={() => {
          navigate('/dashboard');
          onClose();
        }}
      >
        <img
          src="/gladiator_icon.png"
          alt="Gladiator logo"
          className={styles.logo}
          draggable={false}
        />
        <div className={styles.logoText}>
          <span className={styles.logoName}>Gladiator</span>
          <span className={styles.logoSub}>NG Admin</span>
        </div>
      </div>

      {/* Mobile close button */}
      <button
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="Close menu"
      >
        <X />
      </button>

      <hr className={styles.divider} />

      {/* Nav links — close sidebar on navigate (mobile) */}
      <nav className={styles.nav}>
        {links.map((link) => (
          <SidebarLink key={link.label} {...link} onNavigate={onClose} />
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
