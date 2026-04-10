import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  ImagePlus,
  Anchor,
  Users,
  BedDouble,
  TrendingUp,
  BarChart2,
  Calendar,
  ArrowUpDown,
  SlidersHorizontal,
  Truck,
  Clock,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Boat } from '../../services/apiBoat';
import {
  uploadAndSaveBoatImages,
  updateBoatImagePositions,
  deleteBoatImage,
  setBoatCoverImage,
} from '../../services/apiBoat';
import FormInput from '../../ui/formElements/FormInput';
import Button from '../../ui/Button';
import EditImageGrid from '../../ui/EditImageGrid';
import type { EditableImage } from '../../ui/EditImageGrid';
import { MetricCard } from '../../ui/MetricCard';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import { slugify, formatPrice } from '../../utils/format';
import { useBoats } from './useBoats';
import { useCreateBoat } from './useCreateBoat';
import { useUpdateBoat } from './useUpdateBoat';
import { useDeleteBoat } from './useDeleteBoat';
import { useToggleBoatActive } from './useToggleBoatActive';
import styles from './BoatsHome.module.css';

// ── Period / sort types ───────────────────────────────

type PeriodMode = 'monthly' | 'yearly' | 'custom';
type SortKey = 'newest' | 'name_asc' | 'price_asc' | 'price_desc';
type StatusFilter = 'all' | 'active' | 'inactive';

// ── Helpers ─────────────────────────────────────────

function parseBoatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('23505') || msg.includes('duplicate key')) {
    return 'A boat with this name already exists. Please choose a different name.';
  }
  return msg;
}

// ── Form fields ───────────────────────────────────────

interface BoatFields {
  name: string;
  slug: string;
  description: string;
  location: string;
  pickup_location: string;
  max_guests: number;
  cabins: number;
  boat_type: string;
  price_per_hour: number;
  is_active: boolean;
  min_booking_hours: number;
  max_booking_hours: number;
  is_available_for_transport: boolean;
}

// ── Image edit helper ─────────────────────────────────

async function applyBoatImageEdits(
  boat: Boat,
  editableImages: EditableImage[],
): Promise<void> {
  const original = boat.images ?? [];
  const originalIds = original.map((i) => i.id);
  const currentExistingIds = editableImages
    .filter(
      (i): i is Extract<EditableImage, { kind: 'existing' }> =>
        i.kind === 'existing',
    )
    .map((i) => i.id);

  const removedIds = originalIds.filter(
    (id) => !currentExistingIds.includes(id),
  );
  await Promise.all(
    removedIds.map((id) => {
      const img = original.find((i) => i.id === id)!;
      return deleteBoatImage({ imageId: id, imageUrl: img.image_url });
    }),
  );

  const newImages = editableImages.filter(
    (i): i is Extract<EditableImage, { kind: 'new' }> => i.kind === 'new',
  );
  const uploaded =
    newImages.length > 0
      ? await uploadAndSaveBoatImages(
          boat.id,
          newImages.map((i) => i.file),
        )
      : [];

  let newIdx = 0;
  const orderedIds = editableImages.map((img) =>
    img.kind === 'existing' ? img.id : uploaded[newIdx++].id,
  );
  if (orderedIds.length > 0) {
    await updateBoatImagePositions(
      orderedIds.map((id, position) => ({ id, position })),
    );
  }

  const coverImg = editableImages.find((i) => i.isCover);
  if (coverImg) {
    const coverId =
      coverImg.kind === 'existing'
        ? coverImg.id
        : uploaded[newImages.findIndex((i) => i.key === coverImg.key)]?.id;
    if (coverId && coverId !== boat.cover_image_id) {
      await setBoatCoverImage({ boatId: boat.id, imageId: coverId });
    }
  }
}

// ── CoverPhoto ────────────────────────────────────────

function CoverPhoto({ boat }: { boat: Boat }) {
  const cover =
    boat.images?.find((img) => img.id === boat.cover_image_id) ??
    boat.images?.[0];
  if (!cover) {
    return (
      <div className={styles.coverPlaceholder}>
        <Anchor size={32} />
      </div>
    );
  }
  return (
    <img src={cover.image_url} alt={boat.name} className={styles.coverImg} />
  );
}

// ── Boat form fields ──────────────────────────────────

function BoatFormFields({
  formActions,
  disabled,
  onNameChange,
}: {
  formActions: {
    register: ReturnType<typeof useForm<BoatFields>>['register'];
    errors: ReturnType<typeof useForm<BoatFields>>['formState']['errors'];
  };
  disabled?: boolean;
  onNameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <div className={styles.formRow}>
        <FormInput
          id="name"
          label="Boat Name"
          formActions={formActions}
          disabled={disabled}
          onChange={onNameChange}
        />
        <FormInput id="slug" label="Slug" formActions={formActions} disabled />
      </div>
      <div className={styles.formRow}>
        <FormInput
          id="location"
          label="Location"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
        <FormInput
          id="pickup_location"
          label="Pickup Location"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
      </div>
      <div className={styles.formRow3}>
        <FormInput
          id="max_guests"
          type="number"
          label="Max Guests"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
        <FormInput
          id="cabins"
          type="number"
          label="Cabins"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
        <FormInput
          id="boat_type"
          type="select"
          label="Boat Type"
          formActions={formActions}
          disabled={disabled}
          required={false}
        >
          <option value="">Select type…</option>
          <option value="Yacht">Yacht</option>
          <option value="Speedboat">Speedboat</option>
          <option value="Catamaran">Catamaran</option>
          <option value="Sailboat">Sailboat</option>
          <option value="Pontoon">Pontoon</option>
          <option value="Houseboat">Houseboat</option>
          <option value="Jet Ski">Jet Ski</option>
          <option value="Fishing Boat">Fishing Boat</option>
          <option value="Ferry">Ferry</option>
        </FormInput>
      </div>
      <div className={styles.formRow3}>
        <FormInput
          id="price_per_hour"
          type="number"
          label="Price per Hour (₦)"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
        <FormInput
          id="min_booking_hours"
          type="number"
          label="Min Hours"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
        <FormInput
          id="max_booking_hours"
          type="number"
          label="Max Hours"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
      </div>
      <div className={styles.formRow}>
        <FormInput
          id="is_active"
          type="select"
          label="Status"
          formActions={formActions}
          disabled={disabled}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </FormInput>
        <FormInput
          id="is_available_for_transport"
          type="select"
          label="Available for Transport"
          formActions={formActions}
          disabled={disabled}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </FormInput>
      </div>
      <FormInput
        id="description"
        type="textarea"
        label="Description"
        formActions={formActions}
        disabled={disabled}
        required={false}
      />
    </>
  );
}

// ── Main component ────────────────────────────────────

function BoatsHome() {
  const queryClient = useQueryClient();
  const { boats, isLoading, error } = useBoats();
  const { create, isPending: isCreating } = useCreateBoat();
  const { update, isPending: isUpdating } = useUpdateBoat();
  const { remove, isPending: isDeleting } = useDeleteBoat();
  const { toggle: toggleActive, isPending: isToggling } = useToggleBoatActive();

  const [search, setSearch] = useState('');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [isCreateBusy, setIsCreateBusy] = useState(false);
  const [createImages, setCreateImages] = useState<EditableImage[]>([]);
  const [createImageError, setCreateImageError] = useState<string | null>(null);
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(
    null,
  );

  const [editingBoat, setEditingBoat] = useState<Boat | null>(null);
  const [isEditBusy, setIsEditBusy] = useState(false);
  const [editableImages, setEditableImages] = useState<EditableImage[]>([]);
  const [editImageError, setEditImageError] = useState<string | null>(null);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);

  const [deletingBoat, setDeletingBoat] = useState<Boat | null>(null);
  const [managingImages, setManagingImages] = useState<Boat | null>(null);
  const [manageEditableImages, setManageEditableImages] = useState<
    EditableImage[]
  >([]);
  const [isSavingManage, setIsSavingManage] = useState(false);
  const [manageSubmitError, setManageSubmitError] = useState<string | null>(
    null,
  );

  // ── Revenue period (dummy: 4 hrs/day × 15 days = 60 hrs/month) ──
  const DUMMY_HOURS_PER_MONTH = 60;

  const periodHours = useMemo(() => {
    if (periodMode === 'monthly') return DUMMY_HOURS_PER_MONTH;
    if (periodMode === 'yearly') return DUMMY_HOURS_PER_MONTH * 12;
    if (customFrom && customTo) {
      const days = Math.max(
        0,
        Math.round(
          (new Date(customTo).getTime() - new Date(customFrom).getTime()) /
            86_400_000,
        ),
      );
      return Math.round((days / 30) * DUMMY_HOURS_PER_MONTH);
    }
    return DUMMY_HOURS_PER_MONTH;
  }, [periodMode, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    if (periodMode === 'monthly') return 'This month';
    if (periodMode === 'yearly') return 'This year';
    if (customFrom && customTo) {
      const fmt = (s: string) =>
        new Date(s).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: '2-digit',
        });
      return `${fmt(customFrom)} – ${fmt(customTo)}`;
    }
    return 'Custom range';
  }, [periodMode, customFrom, customTo]);

  const metrics = useMemo(() => {
    const total = boats.length;
    const active = boats.filter((b) => b.is_active).length;
    const inactive = total - active;
    const totalCapacity = boats.reduce(
      (sum, b) => sum + (b.max_guests ?? 0),
      0,
    );
    const estRevenue = boats
      .filter((b) => b.is_active && b.price_per_hour)
      .reduce((sum, b) => sum + (b.price_per_hour ?? 0) * periodHours, 0);
    return { total, active, inactive, totalCapacity, estRevenue };
  }, [boats, periodHours]);

  const filtered = useMemo(() => {
    let list = boats.filter((b) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.location?.toLowerCase().includes(q) ||
        b.boat_type?.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && b.is_active) ||
        (statusFilter === 'inactive' && !b.is_active);
      return matchesSearch && matchesStatus;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'name_asc') return a.name.localeCompare(b.name);
      if (sortKey === 'price_asc')
        return (a.price_per_hour ?? 0) - (b.price_per_hour ?? 0);
      if (sortKey === 'price_desc')
        return (b.price_per_hour ?? 0) - (a.price_per_hour ?? 0);
      return 0;
    });
    return list;
  }, [boats, search, statusFilter, sortKey]);

  // ── Create form ─────────────────────────────────────
  const {
    register: createRegister,
    handleSubmit: createHandleSubmit,
    formState: { errors: createErrors },
    reset: resetCreate,
    setValue: setCreateValue,
  } = useForm<BoatFields>({
    defaultValues: { is_active: true, is_available_for_transport: false },
  });
  const createFormActions = { register: createRegister, errors: createErrors };

  function handleCreateNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCreateValue('slug', slugify(e.target.value), { shouldValidate: false });
  }

  function openCreate() {
    resetCreate({ is_active: true, is_available_for_transport: false });
    setCreateImages([]);
    setCreateImageError(null);
    setCreateSubmitError(null);
    setShowCreate(true);
  }

  async function handleCreateSubmit(data: BoatFields) {
    if (createImages.length < 1) {
      setCreateImageError('Please add at least 1 photo.');
      return;
    }
    setCreateImageError(null);
    setCreateSubmitError(null);
    setIsCreateBusy(true);

    create(
      {
        ...data,
        max_guests: Number(data.max_guests) || undefined,
        cabins: Number(data.cabins) || undefined,
        price_per_hour: Number(data.price_per_hour) || undefined,
        min_booking_hours: Number(data.min_booking_hours) || undefined,
        max_booking_hours: Number(data.max_booking_hours) || undefined,
        is_available_for_transport:
          String(data.is_available_for_transport) === 'true',
      },
      {
        onSuccess: async (newBoat) => {
          try {
            const newImgs = createImages.filter(
              (i): i is Extract<EditableImage, { kind: 'new' }> =>
                i.kind === 'new',
            );
            const saved = await uploadAndSaveBoatImages(
              newBoat.id,
              newImgs.map((f) => f.file),
            );
            const coverIdx = newImgs.findIndex((f) => f.isCover);
            if (coverIdx >= 0 && saved[coverIdx]) {
              await setBoatCoverImage({
                boatId: newBoat.id,
                imageId: saved[coverIdx].id,
              });
            }
            await queryClient.invalidateQueries({ queryKey: ['boats'] });
            setShowCreate(false);
            resetCreate();
            setCreateImages([]);
          } catch (err) {
            setCreateSubmitError(parseBoatError(err));
          } finally {
            setIsCreateBusy(false);
          }
        },
        onError: (err: Error) => {
          setCreateSubmitError(parseBoatError(err));
          setIsCreateBusy(false);
        },
      },
    );
  }

  // ── Edit form ───────────────────────────────────────
  const {
    register: editRegister,
    handleSubmit: editHandleSubmit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<BoatFields>();
  const editFormActions = { register: editRegister, errors: editErrors };

  function openEdit(boat: Boat) {
    setEditingBoat(boat);
    const sorted = (boat.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position);
    setEditableImages(
      sorted.map((img) => ({
        kind: 'existing',
        id: img.id,
        image_url: img.image_url,
        isCover: img.id === boat.cover_image_id,
      })),
    );
    setEditImageError(null);
    setEditSubmitError(null);
    resetEdit({
      name: boat.name,
      slug: boat.slug,
      description: boat.description ?? '',
      location: boat.location ?? '',
      pickup_location: boat.pickup_location ?? '',
      max_guests: boat.max_guests ?? ('' as unknown as number),
      cabins: boat.cabins ?? ('' as unknown as number),
      boat_type: boat.boat_type ?? '',
      price_per_hour: boat.price_per_hour ?? ('' as unknown as number),
      is_active: boat.is_active,
      min_booking_hours: boat.min_booking_hours ?? ('' as unknown as number),
      max_booking_hours: boat.max_booking_hours ?? ('' as unknown as number),
      is_available_for_transport: boat.is_available_for_transport,
    });
  }

  function handleEditSubmit(data: BoatFields) {
    if (!editingBoat) return;
    if (editableImages.length < 1) {
      setEditImageError('At least 1 photo is required.');
      return;
    }
    setEditImageError(null);
    setEditSubmitError(null);
    setIsEditBusy(true);

    update(
      {
        id: editingBoat.id,
        ...data,
        max_guests: Number(data.max_guests) || undefined,
        cabins: Number(data.cabins) || undefined,
        price_per_hour: Number(data.price_per_hour) || undefined,
        min_booking_hours: Number(data.min_booking_hours) || undefined,
        max_booking_hours: Number(data.max_booking_hours) || undefined,
        is_available_for_transport:
          String(data.is_available_for_transport) === 'true',
      },
      {
        onSuccess: async (updatedBoat) => {
          try {
            await applyBoatImageEdits(updatedBoat, editableImages);
            await queryClient.invalidateQueries({ queryKey: ['boats'] });
            setEditingBoat(null);
          } catch (err) {
            setEditSubmitError(
              err instanceof Error ? err.message : 'Failed to save photos.',
            );
          } finally {
            setIsEditBusy(false);
          }
        },
        onError: (err: Error) => {
          setEditSubmitError(err.message);
          setIsEditBusy(false);
        },
      },
    );
  }

  // ── Delete ──────────────────────────────────────────
  function handleDelete() {
    if (!deletingBoat) return;
    remove(deletingBoat.id, { onSuccess: () => setDeletingBoat(null) });
  }

  function handleToggleActive(boat: Boat) {
    toggleActive({ id: boat.id, is_active: !boat.is_active });
  }

  // ── Manage images ───────────────────────────────────
  function openManageImages(boat: Boat) {
    setManagingImages(boat);
    const sorted = (boat.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position);
    setManageEditableImages(
      sorted.map((img) => ({
        kind: 'existing',
        id: img.id,
        image_url: img.image_url,
        isCover: img.id === boat.cover_image_id,
      })),
    );
    setManageSubmitError(null);
  }

  async function handleSaveManageImages() {
    if (!managingImages) return;
    setIsSavingManage(true);
    setManageSubmitError(null);
    try {
      await applyBoatImageEdits(managingImages, manageEditableImages);
      await queryClient.invalidateQueries({ queryKey: ['boats'] });
      setManagingImages(null);
    } catch (err) {
      setManageSubmitError(
        err instanceof Error ? err.message : 'Failed to save photos.',
      );
    } finally {
      setIsSavingManage(false);
    }
  }

  // ── Render ──────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Boats</h1>
        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by name or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            onClick={openCreate}
            className={styles.addBtn}
          >
            <Plus size={16} />
            Add Boat
          </Button>
        </div>
      </div>

      {error && <p className={styles.errorMsg}>Error: {error.message}</p>}
      {isLoading && <p className={styles.emptyMsg}>Loading boats…</p>}

      {/* Metrics */}
      {!isLoading && !error && boats.length > 0 && (
        <div className={styles.metricsSection}>
          <div className={styles.metricsHeader}>
            <div className={styles.periodPills}>
              {(['monthly', 'yearly', 'custom'] as PeriodMode[]).map((m) => (
                <button
                  key={m}
                  className={`${styles.periodPill} ${periodMode === m ? styles.periodPillActive : ''}`}
                  onClick={() => setPeriodMode(m)}
                >
                  {m === 'monthly' && 'Monthly'}
                  {m === 'yearly' && 'Yearly'}
                  {m === 'custom' && (
                    <>
                      <Calendar size={13} />
                      Custom
                    </>
                  )}
                </button>
              ))}
            </div>
            {periodMode === 'custom' && (
              <div className={styles.customRange}>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span className={styles.dateSep}>to</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            )}
            <p className={styles.periodLabel}>{periodLabel}</p>
          </div>

          <div className={styles.metrics}>
            <MetricCard
              label="Total Boats"
              value={metrics.total}
              icon={<Anchor size={18} />}
              accent="var(--color-ocean-blue)"
              iconBg="rgba(47,140,202,0.1)"
              sub={
                metrics.inactive > 0
                  ? `${metrics.inactive} inactive`
                  : 'All listed'
              }
            />
            <MetricCard
              label="Active Listings"
              value={metrics.active}
              icon={<BarChart2 size={18} />}
              accent="#16a34a"
              iconBg="rgba(22,163,74,0.1)"
              sub={
                metrics.total > 0 ? (
                  <span
                    className={`${styles.metricBadge} ${styles.metricBadgeGreen}`}
                  >
                    {Math.round((metrics.active / metrics.total) * 100)}% of
                    fleet
                  </span>
                ) : null
              }
            />
            <MetricCard
              label="Total Capacity"
              value={metrics.totalCapacity}
              icon={<Users size={18} />}
              accent="#7c3aed"
              iconBg="rgba(124,58,237,0.1)"
              sub={
                metrics.total > 0
                  ? `~${Math.round(metrics.totalCapacity / metrics.total)} guests avg / boat`
                  : 'across all boats'
              }
            />
            <MetricCard
              label="Est. Revenue"
              value={metrics.estRevenue}
              renderValue={(v) => (v > 0 ? formatPrice(v) : '—')}
              icon={<TrendingUp size={18} />}
              featured
              sub={
                <span
                  className={`${styles.metricBadge} ${styles.metricBadgeSample}`}
                >
                  Sample data · {periodHours} hrs
                </span>
              }
            />
          </div>
        </div>
      )}

      {/* Divider */}
      {!isLoading && !error && boats.length > 0 && (
        <div className={styles.sectionDivider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerLabel}>
            {filtered.length} {filtered.length === 1 ? 'boat' : 'boats'}
          </span>
          <div className={styles.dividerLine} />
        </div>
      )}

      {/* Cards toolbar */}
      {!isLoading && !error && boats.length > 0 && (
        <div className={styles.cardsToolbar}>
          <div className={styles.toolbarGroup}>
            <ArrowUpDown size={14} className={styles.toolbarIcon} />
            <span className={styles.toolbarGroupLabel}>Sort</span>
            <div className={styles.sortPills}>
              {(
                [
                  { key: 'newest', label: 'Newest' },
                  { key: 'name_asc', label: 'Name A–Z' },
                  { key: 'price_asc', label: 'Price ↑' },
                  { key: 'price_desc', label: 'Price ↓' },
                ] as { key: SortKey; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.sortPill} ${sortKey === key ? styles.sortPillActive : ''}`}
                  onClick={() => setSortKey(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.toolbarGroup}>
            <SlidersHorizontal size={14} className={styles.toolbarIcon} />
            <span className={styles.toolbarGroupLabel}>Status</span>
            <div className={styles.sortPills}>
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'inactive', label: 'Inactive' },
                ] as { key: StatusFilter; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.sortPill} ${statusFilter === key ? styles.sortPillActive : ''}`}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <p className={styles.emptyMsg}>No boats found.</p>
      )}

      {/* Card grid */}
      {!isLoading && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((boat) => (
            <div key={boat.id} className={styles.card}>
              <div className={styles.cardCover}>
                <CoverPhoto boat={boat} />
                {boat.is_available_for_transport && (
                  <span className={styles.transportBadge}>
                    <Truck size={11} />
                    Transport
                  </span>
                )}
              </div>

              <div className={styles.cardBody}>
                <h3 className={styles.cardName}>{boat.name}</h3>
                {boat.location && (
                  <p className={styles.cardLocation}>{boat.location}</p>
                )}
                <div className={styles.cardStats}>
                  {boat.max_guests != null && (
                    <span className={styles.stat}>
                      <Users size={13} />
                      {boat.max_guests} guests
                    </span>
                  )}
                  {boat.cabins != null && (
                    <span className={styles.stat}>
                      <BedDouble size={13} />
                      {boat.cabins} cabin{boat.cabins !== 1 ? 's' : ''}
                    </span>
                  )}
                  {boat.boat_type && (
                    <span className={styles.stat}>
                      <Anchor size={13} />
                      {boat.boat_type}
                    </span>
                  )}
                </div>
                {(boat.min_booking_hours || boat.max_booking_hours) && (
                  <p className={styles.cardBookingHours}>
                    <Clock size={12} />
                    {boat.min_booking_hours && boat.max_booking_hours
                      ? `${boat.min_booking_hours}–${boat.max_booking_hours} hrs`
                      : boat.min_booking_hours
                        ? `Min ${boat.min_booking_hours} hrs`
                        : `Max ${boat.max_booking_hours} hrs`}
                  </p>
                )}
                {boat.price_per_hour != null && (
                  <p className={styles.cardPrice}>
                    {formatPrice(boat.price_per_hour)}
                    <span> / hour</span>
                  </p>
                )}
              </div>

              <div className={styles.cardFooter}>
                <button
                  className={styles.footerBtn}
                  title="Manage images"
                  onClick={() => openManageImages(boat)}
                >
                  <ImagePlus size={15} />
                  <span>{boat.images?.length ?? 0} photos</span>
                </button>
                <div className={styles.footerActions}>
                  <button
                    className={`${styles.toggleBtn} ${boat.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive}`}
                    onClick={() => handleToggleActive(boat)}
                    disabled={isToggling}
                  >
                    <span className={styles.toggleTrack}>
                      <span className={styles.toggleThumb} />
                    </span>
                    <span>{boat.is_active ? 'Active' : 'Inactive'}</span>
                  </button>
                  <button
                    className={styles.actionBtn}
                    title="Edit"
                    onClick={() => openEdit(boat)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    title="Delete"
                    onClick={() => setDeletingBoat(boat)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isCreateBusy &&
              e.target === e.currentTarget &&
              setShowCreate(false)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              {isCreateBusy && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>
                    {isCreating ? 'Creating boat…' : 'Uploading photos…'}
                  </p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Add Boat</h2>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setShowCreate(false)}
                    disabled={isCreateBusy}
                  >
                    <X />
                  </button>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={createHandleSubmit(handleCreateSubmit)}
                >
                  <BoatFormFields
                    formActions={createFormActions}
                    disabled={isCreateBusy}
                    onNameChange={handleCreateNameChange}
                  />
                  <EditImageGrid
                    images={createImages}
                    onChange={setCreateImages}
                    max={8}
                    disabled={isCreateBusy}
                  />
                  {createImageError && (
                    <p className={styles.imageError}>{createImageError}</p>
                  )}
                  {createSubmitError && (
                    <p className={styles.submitError}>{createSubmitError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setShowCreate(false)}
                      disabled={isCreateBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={isCreateBusy}
                    >
                      {isCreating
                        ? 'Creating…'
                        : isCreateBusy
                          ? 'Uploading photos…'
                          : 'Create'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editingBoat && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isEditBusy &&
              e.target === e.currentTarget &&
              setEditingBoat(null)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              {isEditBusy && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>
                    {isUpdating ? 'Saving details…' : 'Saving photos…'}
                  </p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Edit Boat</h2>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setEditingBoat(null)}
                    disabled={isEditBusy}
                  >
                    <X />
                  </button>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={editHandleSubmit(handleEditSubmit)}
                >
                  <BoatFormFields
                    formActions={editFormActions}
                    disabled={isEditBusy}
                  />
                  <EditImageGrid
                    images={editableImages}
                    onChange={setEditableImages}
                    max={8}
                    disabled={isEditBusy}
                  />
                  {editImageError && (
                    <p className={styles.imageError}>{editImageError}</p>
                  )}
                  {editSubmitError && (
                    <p className={styles.submitError}>{editSubmitError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setEditingBoat(null)}
                      disabled={isEditBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={isEditBusy}
                    >
                      {isUpdating
                        ? 'Saving…'
                        : isEditBusy
                          ? 'Saving photos…'
                          : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deletingBoat && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              e.target === e.currentTarget && setDeletingBoat(null)
            }
          >
            <motion.div
              className={`${styles.modal} ${styles.confirmModal}`}
              {...modalAnim}
            >
              <div className={styles.modalBody}>
                <div className={styles.confirmIcon}>
                  <AlertTriangle />
                </div>
                <h2 className={styles.confirmTitle}>Delete Boat?</h2>
                <p className={styles.confirmText}>
                  Are you sure you want to delete{' '}
                  <strong>{deletingBoat.name}</strong>? All images will also be
                  removed. This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setDeletingBoat(null)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image manager modal */}
      <AnimatePresence>
        {managingImages && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isSavingManage &&
              e.target === e.currentTarget &&
              setManagingImages(null)
            }
          >
            <motion.div
              className={`${styles.modal} ${styles.imageModal}`}
              {...modalAnim}
            >
              {isSavingManage && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>Saving photos…</p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>
                    Photos — {managingImages.name}
                  </h2>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setManagingImages(null)}
                    disabled={isSavingManage}
                  >
                    <X />
                  </button>
                </div>
                <EditImageGrid
                  images={manageEditableImages}
                  onChange={setManageEditableImages}
                  max={8}
                  disabled={isSavingManage}
                />
                {manageSubmitError && (
                  <p className={styles.submitError}>{manageSubmitError}</p>
                )}
                <div className={styles.modalActions}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setManagingImages(null)}
                    disabled={isSavingManage}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={handleSaveManageImages}
                    disabled={isSavingManage}
                  >
                    {isSavingManage ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BoatsHome;
