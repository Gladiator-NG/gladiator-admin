import SignInForm from '../features/authentication/SignInForm';
import styles from './styles/SignIn.module.css';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

function SignIn() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={styles.page}>
      <button
        className={styles.themeToggle}
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <SignInForm />
    </div>
  );
}

export default SignIn;
