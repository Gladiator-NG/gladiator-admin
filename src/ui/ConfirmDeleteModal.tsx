import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { backdropAnim, modalAnim } from './modalAnimations';
import Button from './Button';
import styles from './styles/ConfirmDeleteModal.module.css';

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  isPending?: boolean;
  error?: string | null;
  confirmLabel?: string;
  pendingLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteModal({
  open,
  title,
  children,
  isPending = false,
  error = null,
  confirmLabel = 'Delete',
  pendingLabel = 'Deleting…',
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPending, onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          {...backdropAnim}
          onClick={(event) =>
            !isPending && event.target === event.currentTarget && onClose()
          }
        >
          <motion.div
            aria-labelledby="confirm-delete-title"
            aria-modal="true"
            className={styles.modal}
            role="dialog"
            {...modalAnim}
          >
            <button
              aria-label="Close"
              className={styles.closeButton}
              disabled={isPending}
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
            <div className={styles.icon}>
              <AlertTriangle size={24} />
            </div>
            <h2 className={styles.title} id="confirm-delete-title">
              {title}
            </h2>
            <div className={styles.message}>{children}</div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <Button
                disabled={isPending}
                onClick={onClose}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={onConfirm}
                type="button"
                variant="danger"
              >
                {isPending ? pendingLabel : confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
