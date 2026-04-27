import type React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Booking } from '../../services/apiBooking';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import Button from '../../ui/Button';
import styles from './BookingsHome.module.css';
import { BookingFormFields } from './BookingFormFields';

interface BookingFormModalProps {
  mode: 'create' | 'edit';
  open: boolean;
  title: string;
  subtitle?: string;
  busy: boolean;
  pending: boolean;
  submitLabel: string;
  submitDisabled: boolean;
  onClose: () => void;
  onSubmit: (event?: React.BaseSyntheticEvent) => void;
  submitError: string | null;
  formProps: React.ComponentProps<typeof BookingFormFields>;
}

function BookingFormModal({
  mode,
  open,
  title,
  subtitle,
  busy,
  pending,
  submitLabel,
  submitDisabled,
  onClose,
  onSubmit,
  submitError,
  formProps,
}: BookingFormModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          {...backdropAnim}
          onClick={(e) => !busy && e.target === e.currentTarget && onClose()}
        >
          <motion.div className={styles.modal} {...modalAnim}>
            {busy && (
              <div className={styles.modalBusyOverlay}>
                <div className={styles.busySpinner} />
                <p className={styles.busyLabel}>
                  {mode === 'create'
                    ? pending
                      ? 'Creating booking…'
                      : 'Saving…'
                    : 'Saving…'}
                </p>
              </div>
            )}
            <div className={styles.modalBody}>
              <div className={styles.modalHeader}>
                <div>
                  <h2 className={styles.modalTitle}>{title}</h2>
                  {subtitle ? (
                    <p className={styles.modalSubtitle}>{subtitle}</p>
                  ) : null}
                </div>
                <button className={styles.closeBtn} onClick={onClose} disabled={busy}>
                  <X />
                </button>
              </div>
              <form className={styles.modalForm} onSubmit={onSubmit}>
                <BookingFormFields {...formProps} />
                {submitError && <p className={styles.submitError}>{submitError}</p>}
                <div className={styles.modalActions}>
                  <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={submitDisabled}>
                    {submitLabel}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DeleteBookingModalProps {
  booking: Booking | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteBookingModal({
  booking,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteBookingModalProps) {
  return (
    <AnimatePresence>
      {booking && (
        <motion.div
          className={styles.backdrop}
          {...backdropAnim}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div className={`${styles.modal} ${styles.confirmModal}`} {...modalAnim}>
            <div className={styles.modalBody}>
              <div className={styles.confirmIcon}>
                <AlertTriangle />
              </div>
              <h2 className={styles.confirmTitle}>Delete Booking?</h2>
              <p className={styles.confirmText}>
                Are you sure you want to permanently delete booking{' '}
                <strong>{booking.reference_code}</strong> for{' '}
                <strong>{booking.customer_name}</strong>? This cannot be undone.
              </p>
              <div className={styles.confirmActions}>
                <Button variant="ghost" type="button" onClick={onClose} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button variant="danger" type="button" onClick={onConfirm} disabled={isDeleting}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface BookingModalsProps {
  createModal: {
    open: boolean;
    busy: boolean;
    pending: boolean;
    submitError: string | null;
    submitDisabled: boolean;
    onClose: () => void;
    onSubmit: (event?: React.BaseSyntheticEvent) => void;
    formProps: React.ComponentProps<typeof BookingFormFields>;
  };
  editModal: {
    booking: Booking | null;
    busy: boolean;
    pending: boolean;
    submitError: string | null;
    submitDisabled: boolean;
    onClose: () => void;
    onSubmit: (event?: React.BaseSyntheticEvent) => void;
    formProps: React.ComponentProps<typeof BookingFormFields>;
  };
  deleteModal: {
    booking: Booking | null;
    isDeleting: boolean;
    onClose: () => void;
    onConfirm: () => void;
  };
}

export function BookingModals({
  createModal,
  editModal,
  deleteModal,
}: BookingModalsProps) {
  return (
    <>
      <BookingFormModal
        mode="create"
        open={createModal.open}
        title="New Booking"
        busy={createModal.busy}
        pending={createModal.pending}
        submitLabel={createModal.pending ? 'Creating…' : 'Create Booking'}
        submitDisabled={createModal.submitDisabled}
        onClose={createModal.onClose}
        onSubmit={createModal.onSubmit}
        submitError={createModal.submitError}
        formProps={createModal.formProps}
      />
      <BookingFormModal
        mode="edit"
        open={Boolean(editModal.booking)}
        title="Edit Booking"
        subtitle={editModal.booking?.reference_code}
        busy={editModal.busy}
        pending={editModal.pending}
        submitLabel={editModal.pending ? 'Saving…' : 'Save Changes'}
        submitDisabled={editModal.submitDisabled}
        onClose={editModal.onClose}
        onSubmit={editModal.onSubmit}
        submitError={editModal.submitError}
        formProps={editModal.formProps}
      />
      <DeleteBookingModal {...deleteModal} />
    </>
  );
}
