import { useEffect, useRef, useState } from 'react';
import { X, Sun, Moon, Monitor, Type } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import styles from './styles/SettingsModal.module.css';

const FONT_SIZE_KEY = 'gladiator_font_scale';
const FONT_MIN = 62.5; // 1rem = 10px
const FONT_MAX = 80; // 1rem = 12.8px  (+20%)
const FONT_DEFAULT = 62.5;

function readFontScale(): number {
  const stored = localStorage.getItem(FONT_SIZE_KEY);
  const n = stored ? parseFloat(stored) : NaN;
  return isNaN(n) ? FONT_DEFAULT : Math.min(FONT_MAX, Math.max(FONT_MIN, n));
}

function applyFontScale(value: number) {
  document.documentElement.style.fontSize = `${value}%`;
  localStorage.setItem(FONT_SIZE_KEY, String(value));
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isDark, toggleTheme } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);
  const [fontScale, setFontScale] = useState<number>(readFontScale);

  function handleFontChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    setFontScale(v);
    applyFontScale(v);
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop + centered wrapper */}
          <motion.div
            className={styles.backdropWrapper}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          >
            {/* Modal panel — stop click propagation to backdrop */}
            <motion.div
              ref={modalRef}
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Header */}
              <div className={styles.modalHeader}>
                <h2 id="settings-title" className={styles.modalTitle}>
                  Settings
                </h2>
                <button
                  className={styles.closeBtn}
                  onClick={onClose}
                  aria-label="Close settings"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className={styles.modalBody}>
                {/* Appearance section */}
                <section className={styles.section}>
                  <p className={styles.sectionLabel}>Appearance</p>

                  <div className={styles.themeRow}>
                    <div className={styles.themeInfo}>
                      <div className={styles.themeIconWrap}>
                        {isDark ? <Moon size={20} /> : <Sun size={20} />}
                      </div>
                      <div>
                        <p className={styles.themeTitle}>
                          {isDark ? 'Dark mode' : 'Light mode'}
                        </p>
                        <p className={styles.themeSubtitle}>
                          {isDark
                            ? 'Warm sunset palette · easy on nighttime eyes'
                            : 'Daylight palette · crisp ocean blues'}
                        </p>
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <button
                      role="switch"
                      aria-checked={isDark}
                      className={`${styles.toggle} ${isDark ? styles.toggleOn : ''}`}
                      onClick={toggleTheme}
                      aria-label="Toggle dark mode"
                    >
                      <motion.span
                        className={styles.toggleThumb}
                        layout
                        transition={{
                          type: 'spring',
                          stiffness: 700,
                          damping: 30,
                        }}
                      />
                    </button>
                  </div>

                  {/* Theme preview swatches */}
                  <div className={styles.swatchRow}>
                    <button
                      className={`${styles.swatch} ${!isDark ? styles.swatchActive : ''}`}
                      onClick={() => isDark && toggleTheme()}
                      title="Light mode"
                    >
                      <span
                        className={styles.swatchPreview}
                        data-variant="light"
                      >
                        <Sun size={14} />
                      </span>
                      <span className={styles.swatchLabel}>Daylight</span>
                    </button>
                    <button
                      className={`${styles.swatch} ${isDark ? styles.swatchActive : ''}`}
                      onClick={() => !isDark && toggleTheme()}
                      title="Dark mode"
                    >
                      <span
                        className={styles.swatchPreview}
                        data-variant="dark"
                      >
                        <Moon size={14} />
                      </span>
                      <span className={styles.swatchLabel}>Sunset</span>
                    </button>
                    <button
                      className={styles.swatch}
                      onClick={() => {
                        const prefersDark = window.matchMedia(
                          '(prefers-color-scheme: dark)',
                        ).matches;
                        if (prefersDark !== isDark) toggleTheme();
                      }}
                      title="Use system preference"
                    >
                      <span
                        className={styles.swatchPreview}
                        data-variant="system"
                      >
                        <Monitor size={14} />
                      </span>
                      <span className={styles.swatchLabel}>System</span>
                    </button>
                  </div>
                </section>

                {/* More settings can be added here in future */}

                {/* Font size section */}
                <section className={styles.section}>
                  <p className={styles.sectionLabel}>
                    <Type
                      size={14}
                      style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}
                    />
                    Text Size
                  </p>
                  <p className={styles.sectionHint}>
                    Adjust the interface font size. Useful on smaller screens.
                  </p>
                  <div className={styles.fontRow}>
                    <span className={styles.fontSmall}>A</span>
                    <input
                      type="range"
                      className={styles.fontSlider}
                      min={FONT_MIN}
                      max={FONT_MAX}
                      step={1}
                      value={fontScale}
                      onChange={handleFontChange}
                      aria-label="Font size"
                    />
                    <span className={styles.fontLarge}>A</span>
                    <button
                      className={styles.fontReset}
                      onClick={() => {
                        setFontScale(FONT_DEFAULT);
                        applyFontScale(FONT_DEFAULT);
                      }}
                      disabled={fontScale === FONT_DEFAULT}
                    >
                      Reset
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default SettingsModal;
