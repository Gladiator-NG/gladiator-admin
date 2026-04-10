import { Link } from 'react-router-dom';
import styles from './styles/button.module.css';

type Variant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'submit'
  | 'link-light'
  | 'link-dark'
  | 'icon';

interface ButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  active?: boolean;
  disabled?: boolean;
  onMouseEnter?: React.MouseEventHandler;
  onMouseLeave?: React.MouseEventHandler;
  className?: string;
}

function Button({
  children,
  onClick,
  href = undefined,
  variant = 'primary',
  onMouseEnter,
  onMouseLeave,
  type = 'button',
  active = false,
  disabled = false,
  className,
}: ButtonProps) {
  const commonClassName = [
    styles.button,
    styles[variant],
    active ? styles[`active-${variant}`] : '',
    disabled ? styles.disabled : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <Link
        to={href}
        className={commonClassName}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          if (onClick) onClick(e);
        }}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      className={commonClassName}
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default Button;
