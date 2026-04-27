import type React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import type { Customer } from '../../services/apiBooking';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import Button from '../../ui/Button';
import FormInput from '../../ui/formElements/FormInput';
import styles from './BookingsHome.module.css';

interface CustomerFormValues {
  full_name: string;
  email: string;
  phone: string;
  marketing_opt_in: boolean;
}

interface CustomerModalsProps {
  editingCustomer: Customer | null;
  deletingCustomer: Customer | null;
  isSavingCustomer: boolean;
  isDeletingCustomer: boolean;
  customerEditError: string | null;
  customerFormActions: {
    register: ReturnType<typeof useForm<CustomerFormValues>>['register'];
    errors: ReturnType<typeof useForm<CustomerFormValues>>['formState']['errors'];
  };
  customerReg: ReturnType<typeof useForm<CustomerFormValues>>['register'];
  onCloseEdit: () => void;
  onCloseDelete: () => void;
  onSubmitEdit: (event?: React.BaseSyntheticEvent) => void;
  onConfirmDelete: () => void;
}

export function CustomerModals({
  editingCustomer,
  deletingCustomer,
  isSavingCustomer,
  isDeletingCustomer,
  customerEditError,
  customerFormActions,
  customerReg,
  onCloseEdit,
  onCloseDelete,
  onSubmitEdit,
  onConfirmDelete,
}: CustomerModalsProps) {
  return (
    <>
      <AnimatePresence>
        {editingCustomer && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isSavingCustomer && e.target === e.currentTarget && onCloseEdit()
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              {isSavingCustomer && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>Saving…</p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <div>
                    <h2 className={styles.modalTitle}>Edit Customer</h2>
                    <p className={styles.modalSubtitle}>{editingCustomer.email}</p>
                  </div>
                  <button
                    className={styles.closeBtn}
                    onClick={onCloseEdit}
                    disabled={isSavingCustomer}
                  >
                    <X />
                  </button>
                </div>
                <form className={styles.modalForm} onSubmit={onSubmitEdit}>
                  <p className={styles.formSectionLabel}>Customer Details</p>
                  <div className={styles.formRow}>
                    <FormInput
                      id="full_name"
                      label="Full Name"
                      formActions={customerFormActions}
                      disabled={isSavingCustomer}
                      validation={{ required: 'Required' }}
                    />
                    <FormInput
                      id="email"
                      type="email"
                      label="Email"
                      formActions={customerFormActions}
                      disabled={isSavingCustomer}
                      validation={{ required: 'Required' }}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <FormInput
                      id="phone"
                      type="tel"
                      label="Phone"
                      formActions={customerFormActions}
                      disabled={isSavingCustomer}
                      required={false}
                    />
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Marketing opt-in</label>
                      <label className={styles.toggleLabel}>
                        <input
                          type="checkbox"
                          className={styles.toggleCheckbox}
                          {...customerReg('marketing_opt_in')}
                          disabled={isSavingCustomer}
                        />
                        <span className={styles.toggleText}>
                          Customer agreed to marketing communications
                        </span>
                      </label>
                    </div>
                  </div>
                  {customerEditError && (
                    <p className={styles.submitError}>{customerEditError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={onCloseEdit}
                      disabled={isSavingCustomer}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={isSavingCustomer}
                    >
                      {isSavingCustomer ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingCustomer && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isDeletingCustomer && e.target === e.currentTarget && onCloseDelete()
            }
          >
            <motion.div className={`${styles.modal} ${styles.confirmModal}`} {...modalAnim}>
              <div className={styles.modalBody}>
                <div className={styles.confirmIcon}>
                  <AlertTriangle />
                </div>
                <h2 className={styles.confirmTitle}>Delete Customer?</h2>
                <p className={styles.confirmText}>
                  Are you sure you want to permanently delete{' '}
                  <strong>{deletingCustomer.full_name}</strong> and all their data?
                  This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={onCloseDelete}
                    disabled={isDeletingCustomer}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={onConfirmDelete}
                    disabled={isDeletingCustomer}
                  >
                    {isDeletingCustomer ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
