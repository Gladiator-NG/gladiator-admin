import { NavLink } from 'react-router-dom';
import styles from './styles/SidebarLink.module.css';

interface SidebarLinkProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  onNavigate?: () => void;
}

function SidebarLink({ icon, label, to, onNavigate }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${styles.link} ${isActive ? styles.active : ''}`
      }
      onClick={onNavigate}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

export default SidebarLink;
