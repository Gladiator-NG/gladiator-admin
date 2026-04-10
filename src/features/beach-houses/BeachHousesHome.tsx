import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  ImagePlus,
  Home,
  Users,
  Bed,
  Bath,
  TrendingUp,
  BarChart2,
  Calendar,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { BeachHouse } from '../../services/apiBeachHouse';
import {
  uploadAndSaveImages,
  updateImagePositions,
  deleteBeachHouseImage,
  setCoverImage as apiSetCoverImage,
} from '../../services/apiBeachHouse';
import FormInput from '../../ui/formElements/FormInput';
import Button from '../../ui/Button';
import EditImageGrid from '../../ui/EditImageGrid';
import type { EditableImage } from '../../ui/EditImageGrid';
import { MetricCard } from '../../ui/MetricCard';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import { slugify, formatPrice } from '../../utils/format';
import { useBeachHouses } from './useBeachHouses';
import { useCreateBeachHouse } from './useCreateBeachHouse';
import { useUpdateBeachHouse } from './useUpdateBeachHouse';
import { useDeleteBeachHouse } from './useDeleteBeachHouse';
import { useToggleBeachHouseActive } from './useToggleBeachHouseActive';
import styles from './BeachHousesHome.module.css';

// ── Period types ──────────────────────────────────────

type PeriodMode = 'monthly' | 'yearly' | 'custom';
type SortKey = 'newest' | 'name_asc' | 'price_asc' | 'price_desc';
type StatusFilter = 'all' | 'active' | 'inactive';

// ── Form field interfaces ─────────────────────────────

interface HouseFields {
  name: string;
  slug: string;
  description: string;
  location: string;
  address: string;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  price_per_night: number;
  check_in_time: string;
  check_out_time: string;
  amenities: string;
  is_active: boolean;
}

// ── Image edit helper ────────────────────────────────

async function applyImageEdits(
  house: BeachHouse,
  editableImages: EditableImage[],
): Promise<void> {
  const original = house.images ?? [];
  const originalIds = original.map((i) => i.id);
  const currentExistingIds = editableImages
    .filter(
      (i): i is Extract<EditableImage, { kind: 'existing' }> =>
        i.kind === 'existing',
    )
    .map((i) => i.id);

  // Delete removed existing images
  const removedIds = originalIds.filter(
    (id) => !currentExistingIds.includes(id),
  );
  await Promise.all(
    removedIds.map((id) => {
      const img = original.find((i) => i.id === id)!;
      return deleteBeachHouseImage({ imageId: id, imageUrl: img.image_url });
    }),
  );

  // Upload new staged files
  const newImages = editableImages.filter(
    (i): i is Extract<EditableImage, { kind: 'new' }> => i.kind === 'new',
  );
  const uploaded =
    newImages.length > 0
      ? await uploadAndSaveImages(
          house.id,
          newImages.map((i) => i.file),
        )
      : [];

  // Build ordered ID list and update all positions
  let newIdx = 0;
  const orderedIds = editableImages.map((img) =>
    img.kind === 'existing' ? img.id : uploaded[newIdx++].id,
  );
  if (orderedIds.length > 0) {
    await updateImagePositions(
      orderedIds.map((id, position) => ({ id, position })),
    );
  }

  // Update cover if changed
  const coverImg = editableImages.find((i) => i.isCover);
  if (coverImg) {
    const coverId =
      coverImg.kind === 'existing'
        ? coverImg.id
        : uploaded[newImages.findIndex((i) => i.key === coverImg.key)]?.id;
    if (coverId && coverId !== house.cover_image_id) {
      await apiSetCoverImage({ beachHouseId: house.id, imageId: coverId });
    }
  }
}

// ── Sub-components ────────────────────────────────────

function CoverPhoto({ house }: { house: BeachHouse }) {
  const cover =
    house.images?.find((img) => img.id === house.cover_image_id) ??
    house.images?.[0];

  if (!cover) {
    return (
      <div className={styles.coverPlaceholder}>
        <Home size={32} />
      </div>
    );
  }

  return (
    <img src={cover.image_url} alt={house.name} className={styles.coverImg} />
  );
}

// ── Main component ────────────────────────────────────

function BeachHousesHome() {
  const queryClient = useQueryClient();
  const { beachHouses, isLoading, error } = useBeachHouses();
  const { create, isPending: isCreating } = useCreateBeachHouse();
  const { update, isPending: isUpdating } = useUpdateBeachHouse();
  const { remove, isPending: isDeleting } = useDeleteBeachHouse();
  const { toggle: toggleActive, isPending: isToggling } =
    useToggleBeachHouseActive();

  // URL is the source of truth for all filter/sort state
  const [searchParams, setSearchParams] = useSearchParams();
  function sp(updates: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }

  const search = searchParams.get('q') ?? '';
  const periodMode = (searchParams.get('period') ?? 'monthly') as PeriodMode;
  const customFrom = searchParams.get('from') ?? '';
  const customTo = searchParams.get('to') ?? '';
  const sortKey = (searchParams.get('sort') ?? 'newest') as SortKey;
  const statusFilter = (searchParams.get('status') ?? 'all') as StatusFilter;
  const highlightedId = searchParams.get('highlight');

  // Scroll to highlighted card and auto-clear after 2.5s
  useEffect(() => {
    if (!highlightedId) return;
    setTimeout(() => {
      document.getElementById(`beach-house-card-${highlightedId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 200);
    const t = setTimeout(() => sp({ highlight: null }), 2500);
    return () => clearTimeout(t);
  }, [highlightedId]);

  const [showCreate, setShowCreate] = useState(false);
  const [isCreateBusy, setIsCreateBusy] = useState(false);
  const [createImages, setCreateImages] = useState<EditableImage[]>([]);
  const [createImageError, setCreateImageError] = useState<string | null>(null);
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(
    null,
  );

  const [editingHouse, setEditingHouse] = useState<BeachHouse | null>(null);
  const [isEditBusy, setIsEditBusy] = useState(false);
  const [editableImages, setEditableImages] = useState<EditableImage[]>([]);
  const [editImageError, setEditImageError] = useState<string | null>(null);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);

  const [deletingHouse, setDeletingHouse] = useState<BeachHouse | null>(null);
  const [managingImages, setManagingImages] = useState<BeachHouse | null>(null);
  const [manageEditableImages, setManageEditableImages] = useState<
    EditableImage[]
  >([]);
  const [isSavingManage, setIsSavingManage] = useState(false);
  const [manageSubmitError, setManageSubmitError] = useState<string | null>(
    null,
  );

  // ── Portfolio metrics ──────────────────────────────
  // Revenue uses dummy booking data (18 booked nights/month per active house)
  // until the bookings feature is built.
  const DUMMY_NIGHTLY_OCCUPANCY = 18; // nights per month

  const periodNights = useMemo(() => {
    if (periodMode === 'monthly') return DUMMY_NIGHTLY_OCCUPANCY;
    if (periodMode === 'yearly') return DUMMY_NIGHTLY_OCCUPANCY * 12;
    // custom: derive nights from date range
    if (customFrom && customTo) {
      const from = new Date(customFrom);
      const to = new Date(customTo);
      const days = Math.max(
        0,
        Math.round((to.getTime() - from.getTime()) / 86_400_000),
      );
      // scale: assume same 18/30 occupancy rate over the span
      return Math.round((days / 30) * DUMMY_NIGHTLY_OCCUPANCY);
    }
    return DUMMY_NIGHTLY_OCCUPANCY;
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
    const total = beachHouses.length;
    const active = beachHouses.filter((h) => h.is_active).length;
    const inactive = total - active;
    const totalCapacity = beachHouses.reduce(
      (sum, h) => sum + (h.max_guests ?? 0),
      0,
    );
    const estRevenue = beachHouses
      .filter((h) => h.is_active && h.price_per_night)
      .reduce((sum, h) => sum + (h.price_per_night ?? 0) * periodNights, 0);
    return { total, active, inactive, totalCapacity, estRevenue };
  }, [beachHouses, periodNights]);

  // ── Filtered + sorted list ───────────────────────────────
  const filtered = useMemo(() => {
    let list = beachHouses.filter((h) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        h.name.toLowerCase().includes(q) ||
        h.location?.toLowerCase().includes(q) ||
        h.slug.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && h.is_active) ||
        (statusFilter === 'inactive' && !h.is_active);
      return matchesSearch && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === 'name_asc') return a.name.localeCompare(b.name);
      if (sortKey === 'price_asc')
        return (a.price_per_night ?? 0) - (b.price_per_night ?? 0);
      if (sortKey === 'price_desc')
        return (b.price_per_night ?? 0) - (a.price_per_night ?? 0);
      // newest: default order from API (created_at desc)
      return 0;
    });

    return list;
  }, [beachHouses, search, statusFilter, sortKey]);

  // ── Create form ──────────────────────────────────────
  const {
    register: createRegister,
    handleSubmit: createHandleSubmit,
    formState: { errors: createErrors },
    reset: resetCreate,
    setValue: setCreateValue,
  } = useForm<HouseFields>({ defaultValues: { is_active: true } });
  const createFormActions = { register: createRegister, errors: createErrors };

  function handleCreateNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCreateValue('slug', slugify(e.target.value), { shouldValidate: false });
  }

  function openCreate() {
    resetCreate({ is_active: true });
    setCreateImages([]);
    setCreateImageError(null);
    setCreateSubmitError(null);
    setShowCreate(true);
  }

  async function handleCreateSubmit(data: HouseFields) {
    if (createImages.length < 4) {
      setCreateImageError('Please add at least 4 photos before saving.');
      return;
    }
    setCreateImageError(null);
    setCreateSubmitError(null);
    setIsCreateBusy(true);

    create(
      {
        ...data,
        amenities: data.amenities
          ? data.amenities
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
        max_guests: Number(data.max_guests) || undefined,
        bedrooms: Number(data.bedrooms) || undefined,
        bathrooms: Number(data.bathrooms) || undefined,
        price_per_night: Number(data.price_per_night) || undefined,
      },
      {
        onSuccess: async (newHouse) => {
          try {
            const newImgs = createImages.filter(
              (i): i is Extract<EditableImage, { kind: 'new' }> =>
                i.kind === 'new',
            );
            const files = newImgs.map((f) => f.file);
            const saved = await uploadAndSaveImages(newHouse.id, files);
            const coverIdx = newImgs.findIndex((f) => f.isCover);
            if (coverIdx >= 0 && saved[coverIdx]) {
              await apiSetCoverImage({
                beachHouseId: newHouse.id,
                imageId: saved[coverIdx].id,
              });
            }
            await queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
            // Everything succeeded — close and reset
            setShowCreate(false);
            resetCreate();
            setCreateImages([]);
            setCreateImageError(null);
            setCreateSubmitError(null);
          } catch (err) {
            setCreateSubmitError(
              err instanceof Error
                ? err.message
                : 'Failed to upload photos. Please try again.',
            );
          } finally {
            setIsCreateBusy(false);
          }
        },
        onError: (err: Error) => {
          setCreateSubmitError(err.message);
          setIsCreateBusy(false);
        },
      },
    );
  }

  // ── Edit form ────────────────────────────────────────
  const {
    register: editRegister,
    handleSubmit: editHandleSubmit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<HouseFields>();
  const editFormActions = { register: editRegister, errors: editErrors };

  function openEdit(house: BeachHouse) {
    setEditingHouse(house);
    const sorted = (house.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position);
    setEditableImages(
      sorted.map((img) => ({
        kind: 'existing',
        id: img.id,
        image_url: img.image_url,
        isCover: img.id === house.cover_image_id,
      })),
    );
    setEditImageError(null);
    setEditSubmitError(null);
    resetEdit({
      name: house.name,
      slug: house.slug,
      description: house.description ?? '',
      location: house.location ?? '',
      address: house.address ?? '',
      max_guests: house.max_guests ?? ('' as unknown as number),
      bedrooms: house.bedrooms ?? ('' as unknown as number),
      bathrooms: house.bathrooms ?? ('' as unknown as number),
      price_per_night: house.price_per_night ?? ('' as unknown as number),
      check_in_time: house.check_in_time ?? '',
      check_out_time: house.check_out_time ?? '',
      amenities: house.amenities?.join(', ') ?? '',
      is_active: house.is_active,
    });
  }

  function handleEditSubmit(data: HouseFields) {
    if (!editingHouse) return;

    if (editableImages.length < 4) {
      setEditImageError('At least 4 photos are required.');
      return;
    }
    setEditImageError(null);
    setEditSubmitError(null);
    setIsEditBusy(true);

    update(
      {
        id: editingHouse.id,
        ...data,
        amenities: data.amenities
          ? data.amenities
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
        max_guests: Number(data.max_guests) || undefined,
        bedrooms: Number(data.bedrooms) || undefined,
        bathrooms: Number(data.bathrooms) || undefined,
        price_per_night: Number(data.price_per_night) || undefined,
      },
      {
        onSuccess: async () => {
          try {
            await applyImageEdits(editingHouse, editableImages);
            await queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
            setEditingHouse(null);
            setEditableImages([]);
            setEditImageError(null);
            setEditSubmitError(null);
          } catch (err) {
            setEditSubmitError(
              err instanceof Error
                ? err.message
                : 'Failed to save photos. Please try again.',
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
  function handleToggleActive(house: BeachHouse) {
    toggleActive({ id: house.id, is_active: !house.is_active });
  }
  // ── Delete ───────────────────────────────────────────
  function handleDelete() {
    if (!deletingHouse) return;
    remove(deletingHouse.id, { onSuccess: () => setDeletingHouse(null) });
  }

  // ── Image management (manage images modal) ───────────

  function openManageImages(house: BeachHouse) {
    const sorted = (house.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position);
    setManageEditableImages(
      sorted.map((img) => ({
        kind: 'existing',
        id: img.id,
        image_url: img.image_url,
        isCover: img.id === house.cover_image_id,
      })),
    );
    setManageSubmitError(null);
    setManagingImages(house);
  }

  async function handleSaveManageImages() {
    if (!managingImages) return;
    setIsSavingManage(true);
    setManageSubmitError(null);
    try {
      await applyImageEdits(managingImages, manageEditableImages);
      await queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
      setManagingImages(null);
      setManageEditableImages([]);
    } catch (err) {
      setManageSubmitError(
        err instanceof Error
          ? err.message
          : 'Failed to save changes. Please try again.',
      );
    } finally {
      setIsSavingManage(false);
    }
  }

  // ── Shared form fields ───────────────────────────────
  function HouseFormFields({
    formActions,
    disabled,
    onNameChange,
  }: {
    formActions: typeof createFormActions;
    disabled: boolean;
    onNameChange?: React.ChangeEventHandler<HTMLInputElement>;
  }) {
    return (
      <>
        <div className={styles.formRow}>
          <FormInput
            id="name"
            label="Name"
            formActions={formActions}
            disabled={disabled}
            onChange={onNameChange}
          />
          <FormInput
            id="slug"
            label="Slug"
            placeholder="auto-generated"
            formActions={formActions}
            disabled
          />
        </div>
        <FormInput
          id="description"
          type="textarea"
          label="Description"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
        <div className={styles.formRow}>
          <FormInput
            id="location"
            label="Location"
            formActions={formActions}
            disabled={disabled}
            required={false}
          />
          <FormInput
            id="address"
            label="Address"
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
            id="bedrooms"
            type="number"
            label="Bedrooms"
            formActions={formActions}
            disabled={disabled}
            required={false}
          />
          <FormInput
            id="bathrooms"
            type="number"
            label="Bathrooms"
            formActions={formActions}
            disabled={disabled}
            required={false}
          />
        </div>
        <div className={styles.formRow}>
          <FormInput
            id="price_per_night"
            type="number"
            label="Price per Night (₦)"
            formActions={formActions}
            disabled={disabled}
            required={false}
          />
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
        </div>
        <div className={styles.formRow}>
          <FormInput
            id="check_in_time"
            label="Check-in Time"
            placeholder="e.g. 3:00 PM"
            formActions={formActions}
            disabled={disabled}
            required={false}
          />
          <FormInput
            id="check_out_time"
            label="Check-out Time"
            placeholder="e.g. 11:00 AM"
            formActions={formActions}
            disabled={disabled}
            required={false}
          />
        </div>
        <FormInput
          id="amenities"
          label="Amenities"
          placeholder="Pool, WiFi, Generator, AC (comma-separated)"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
      </>
    );
  }

  // ── Render ───────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Beach Houses</h1>
        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by name or location…"
              value={search}
              onChange={(e) => sp({ q: e.target.value })}
            />
          </div>
          <Button
            variant="primary"
            onClick={openCreate}
            className={styles.addBtn}
          >
            <Plus size={16} />
            Add Beach House
          </Button>
        </div>
      </div>

      {error && <p className={styles.errorMsg}>Error: {error.message}</p>}
      {isLoading && <p className={styles.emptyMsg}>Loading beach houses…</p>}

      {/* ── Metrics section ── */}
      {!isLoading && !error && beachHouses.length > 0 && (
        <div className={styles.metricsSection}>
          {/* Period controls */}
          <div className={styles.metricsHeader}>
            <div className={styles.periodPills}>
              {(['monthly', 'yearly', 'custom'] as PeriodMode[]).map((m) => (
                <button
                  key={m}
                  className={`${styles.periodPill} ${periodMode === m ? styles.periodPillActive : ''}`}
                  onClick={() => sp({ period: m, from: null, to: null })}
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
                  onChange={(e) => sp({ from: e.target.value })}
                />
                <span className={styles.dateSep}>to</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => sp({ to: e.target.value })}
                />
              </div>
            )}

            <p className={styles.periodLabel}>{periodLabel}</p>
          </div>

          {/* Cards */}
          <div className={styles.metrics}>
            <MetricCard
              label="Total Properties"
              value={metrics.total}
              icon={<Home size={18} />}
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
                    portfolio
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
                  ? `~${Math.round(metrics.totalCapacity / metrics.total)} guests avg / property`
                  : 'across all properties'
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
                  Sample data · {periodNights} nights
                </span>
              }
            />
          </div>
        </div>
      )}

      {/* ── Divider + cards toolbar ── */}
      {!isLoading && !error && beachHouses.length > 0 && (
        <div className={styles.sectionDivider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerLabel}>
            {filtered.length}{' '}
            {filtered.length === 1 ? 'property' : 'properties'}
          </span>
          <div className={styles.dividerLine} />
        </div>
      )}

      {!isLoading && !error && beachHouses.length > 0 && (
        <div className={styles.cardsToolbar}>
          {/* Sort */}
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
                  onClick={() => sp({ sort: key })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
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
                  onClick={() => sp({ status: key })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <p className={styles.emptyMsg}>No beach houses found.</p>
      )}

      {/* Card grid */}
      {!isLoading && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((house) => (
            <div
                key={house.id}
                id={`beach-house-card-${house.id}`}
                className={`${styles.card} ${highlightedId === house.id ? styles.cardHighlighted : ''}`}
              >
              <div className={styles.cardCover}>
                <CoverPhoto house={house} />
              </div>

              <div className={styles.cardBody}>
                <h3 className={styles.cardName}>{house.name}</h3>
                {house.location && (
                  <p className={styles.cardLocation}>{house.location}</p>
                )}

                <div className={styles.cardStats}>
                  {house.max_guests != null && (
                    <span className={styles.stat}>
                      <Users size={13} />
                      {house.max_guests} guests
                    </span>
                  )}
                  {house.bedrooms != null && (
                    <span className={styles.stat}>
                      <Bed size={13} />
                      {house.bedrooms} bed{house.bedrooms !== 1 ? 's' : ''}
                    </span>
                  )}
                  {house.bathrooms != null && (
                    <span className={styles.stat}>
                      <Bath size={13} />
                      {house.bathrooms} bath{house.bathrooms !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {house.price_per_night != null && (
                  <p className={styles.cardPrice}>
                    {formatPrice(house.price_per_night)}
                    <span> / night</span>
                  </p>
                )}

                {house.amenities?.length > 0 && (
                  <div className={styles.amenities}>
                    {house.amenities.slice(0, 3).map((a) => (
                      <span key={a} className={styles.amenityTag}>
                        {a}
                      </span>
                    ))}
                    {house.amenities.length > 3 && (
                      <span className={styles.amenityMore}>
                        +{house.amenities.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <button
                  className={styles.footerBtn}
                  title="Manage images"
                  onClick={() => openManageImages(house)}
                >
                  <ImagePlus size={15} />
                  <span>{house.images?.length ?? 0} photos</span>
                </button>
                <div className={styles.footerActions}>
                  <button
                    className={`${styles.toggleBtn} ${house.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive}`}
                    title={house.is_active ? 'Set inactive' : 'Set active'}
                    onClick={() => handleToggleActive(house)}
                    disabled={isToggling}
                  >
                    <span className={styles.toggleTrack}>
                      <span className={styles.toggleThumb} />
                    </span>
                    <span>{house.is_active ? 'Active' : 'Inactive'}</span>
                  </button>
                  <button
                    className={styles.actionBtn}
                    title="Edit"
                    onClick={() => openEdit(house)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    title="Delete"
                    onClick={() => setDeletingHouse(house)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create modal ── */}
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
                    {isCreating ? 'Creating beach house…' : 'Uploading photos…'}
                  </p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Add Beach House</h2>
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
                  <HouseFormFields
                    formActions={createFormActions}
                    disabled={isCreateBusy}
                    onNameChange={handleCreateNameChange}
                  />
                  <EditImageGrid
                    images={createImages}
                    onChange={setCreateImages}
                    max={6}
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

      {/* ── Edit modal ── */}
      <AnimatePresence>
        {editingHouse && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isEditBusy &&
              e.target === e.currentTarget &&
              setEditingHouse(null)
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
                  <h2 className={styles.modalTitle}>Edit Beach House</h2>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setEditingHouse(null)}
                    disabled={isEditBusy}
                  >
                    <X />
                  </button>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={editHandleSubmit(handleEditSubmit)}
                >
                  <HouseFormFields
                    formActions={editFormActions}
                    disabled={isEditBusy}
                  />
                  <EditImageGrid
                    images={editableImages}
                    onChange={setEditableImages}
                    max={6}
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
                      onClick={() => setEditingHouse(null)}
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

      {/* ── Delete confirm ── */}
      <AnimatePresence>
        {deletingHouse && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              e.target === e.currentTarget && setDeletingHouse(null)
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
                <h2 className={styles.confirmTitle}>Delete Beach House?</h2>
                <p className={styles.confirmText}>
                  Are you sure you want to delete{' '}
                  <strong>{deletingHouse.name}</strong>? All images will also be
                  removed. This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setDeletingHouse(null)}
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

      {/* ── Image manager modal ── */}
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
                  max={6}
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

export default BeachHousesHome;
