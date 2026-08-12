import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { GripVertical, MapPinned, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  createExperienceLocation,
  deleteExperienceLocation,
  getAllExperienceLocations,
  reorderExperienceLocations,
  updateExperienceLocation,
} from '../../services/apiExperienceLocation';
import type { ExperienceLocation } from '../../services/apiExperienceLocation';
import Button from '../../ui/Button';
import FormInput from '../../ui/formElements/FormInput';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import styles from '../locations/LocationsHome.module.css';

interface ExperienceLocationFields {
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export default function ExperienceLocationsHome({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['experience_locations_all'],
    queryFn: getAllExperienceLocations,
  });
  const [orderedLocations, setOrderedLocations] = useState<ExperienceLocation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExperienceLocation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOrderedLocations(locations));
    return () => cancelAnimationFrame(frame);
  }, [locations]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExperienceLocationFields>();
  const formActions = { register, errors };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['experience_locations_all'] });
    queryClient.invalidateQueries({ queryKey: ['experience_locations'] });
    queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
  };

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: (fields: ExperienceLocationFields) =>
      editing
        ? updateExperienceLocation(editing.id, {
            name: fields.name,
            description: fields.description || undefined,
            sort_order: Number(fields.sort_order) || 0,
            is_active: fields.is_active,
          })
        : createExperienceLocation({
            name: fields.name,
            description: fields.description || undefined,
            sort_order: Number(fields.sort_order) || 0,
          }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setEditing(null);
      setSubmitError(null);
      reset();
    },
    onError: (error) =>
      setSubmitError(error instanceof Error ? error.message : String(error)),
  });

  const { mutate: remove } = useMutation({
    mutationFn: deleteExperienceLocation,
    onSuccess: invalidate,
    onError: (error) => alert(error instanceof Error ? error.message : String(error)),
  });

  const { mutate: saveOrder, isPending: isSavingOrder } = useMutation({
    mutationFn: reorderExperienceLocations,
    onSuccess: invalidate,
  });

  const hasOrderChanges = useMemo(
    () =>
      orderedLocations.length === locations.length &&
      orderedLocations.some((location, index) => location.id !== locations[index]?.id),
    [locations, orderedLocations],
  );

  function openNew() {
    setEditing(null);
    setSubmitError(null);
    reset({ name: '', description: '', sort_order: 0, is_active: true });
    setShowForm(true);
  }

  function openEdit(location: ExperienceLocation) {
    setEditing(location);
    setSubmitError(null);
    reset({
      name: location.name,
      description: location.description ?? '',
      sort_order: location.sort_order,
      is_active: location.is_active,
    });
    setShowForm(true);
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        {!embedded && (
          <div>
            <h1 className={styles.pageTitle}>Destinations</h1>
            <p className={styles.pageSubtitle}>
              Manage the waterfront destinations customers use to find beach houses and stays.
            </p>
          </div>
        )}
        {embedded && (
          <p className={styles.pageSubtitle}>
            Customer-facing waterfront areas used to discover beach houses and stays.
          </p>
        )}
        <Button variant="primary" onClick={openNew}>
          <Plus size={16} /> Add Destination
        </Button>
      </div>

      {!embedded && (
        <div className={styles.tabs}>
          <div className={`${styles.tab} ${styles.tabActive}`}>
            <MapPinned size={15} /> Destinations
            <span className={styles.tabBadge}>{locations.length}</span>
          </div>
        </div>
      )}

      <div className={styles.list}>
        {isLoading && <p>Loading experience locations…</p>}
        {!isLoading && locations.length === 0 && (
          <div className={styles.routesHint}>
            <MapPinned size={18} />
            <p>Add your first destination, then assign it to one or more beach houses.</p>
          </div>
        )}
        {orderedLocations.length > 0 && (
          <>
            <Reorder.Group
              axis="y"
              values={orderedLocations}
              onReorder={setOrderedLocations}
              className={styles.reorderGroup}
            >
              {orderedLocations.map((location, index) => (
                <Reorder.Item
                  key={location.id}
                  value={location}
                  className={styles.listRow}
                >
                  <span className={styles.dragHandle}><GripVertical size={16} /></span>
                  <div className={styles.listRowContent}>
                    <strong className={styles.listRowName}>{location.name}</strong>
                    {location.description && <p className={styles.listRowMeta}>{location.description}</p>}
                  </div>
                  <div className={styles.listRowMeta2}>
                    {!location.is_active && <span className={styles.inactiveBadge}>Inactive</span>}
                    <span className={styles.sortOrder}>#{index + 1}</span>
                  </div>
                  <div className={styles.listRowActions}>
                    <button className={styles.iconBtn} onClick={() => openEdit(location)} title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => {
                        if (confirm(`Delete experience location "${location.name}"? Beach houses will remain but lose this destination.`)) {
                          remove(location.id);
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
            {hasOrderChanges && (
              <div className={styles.modalActions}>
                <Button
                  variant="primary"
                  onClick={() => saveOrder(orderedLocations.map((item) => item.id))}
                  disabled={isSavingOrder}
                >
                  {isSavingOrder ? 'Saving order…' : 'Save Display Order'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(event) =>
              !isSaving && event.target === event.currentTarget && setShowForm(false)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>
                    {editing ? 'Edit Destination' : 'Add Destination'}
                  </h2>
                  <button className={styles.closeBtn} onClick={() => setShowForm(false)} disabled={isSaving}>
                    <X />
                  </button>
                </div>
                <form className={styles.modalForm} onSubmit={handleSubmit((fields) => save(fields))}>
                  <FormInput
                    id="name"
                    label="Destination Name"
                    formActions={formActions}
                    disabled={isSaving}
                    placeholder="e.g. Ilashe Beach"
                  />
                  <FormInput
                    id="description"
                    label="Description (optional)"
                    formActions={formActions}
                    disabled={isSaving}
                    required={false}
                    placeholder="Short customer-facing area description"
                  />
                  <div className={styles.formRow}>
                    <FormInput
                      id="sort_order"
                      type="number"
                      label="Display Order"
                      formActions={formActions}
                      disabled={isSaving}
                      required={false}
                      placeholder="0"
                    />
                    <fieldset className={styles.toggleFieldset}>
                      <label className={styles.toggleLabel}>
                        <input type="checkbox" className={styles.toggleCheckbox} {...register('is_active')} disabled={isSaving} />
                        Active — show in customer filters
                      </label>
                    </fieldset>
                  </div>
                  {submitError && <p className={styles.submitError}>{submitError}</p>}
                  <div className={styles.modalActions}>
                    <Button variant="ghost" type="button" onClick={() => setShowForm(false)} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button variant="primary" type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving…' : editing ? 'Save Changes' : 'Add Destination'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
