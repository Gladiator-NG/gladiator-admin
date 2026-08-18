import { useState, useEffect, useMemo } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
  Route,
  AlertTriangle,
  Clock,
  GripVertical,
  MapPinned,
  Anchor,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  getAllLocations,
  getAllTransportRoutes,
  createLocation,
  updateLocation,
  reorderLocations,
  deleteLocation,
  upsertTransportRoute,
  deleteTransportRoute,
  saveBoatTransferPrice,
} from '../../services/apiTransport';
import type { Location, TransportRoute } from '../../services/apiTransport';
import { getBoats } from '../../services/apiBoat';
import type { Boat } from '../../services/apiBoat';
import { formatPrice } from '../../utils/format';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import FormInput from '../../ui/formElements/FormInput';
import Button from '../../ui/Button';
import ConfirmDeleteModal from '../../ui/ConfirmDeleteModal';
import { useSettings, useUpdateSetting } from '../settings/useSettings';
import ExperienceLocationsHome from '../experience-locations/ExperienceLocationsHome';
import { getAllExperienceLocations } from '../../services/apiExperienceLocation';
import styles from './LocationsHome.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocationFields {
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

interface RouteFields {
  from_location_id: string;
  to_location_id: string;
  duration_hours: number;
}

const EMPTY_LOCATIONS: Location[] = [];

type DeleteTarget =
  | { kind: 'location'; location: Location }
  | { kind: 'route'; route: TransportRoute };

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useAllLocations() {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['locations_all'],
    queryFn: getAllLocations,
  });
  return { locations: data ?? EMPTY_LOCATIONS, isLoading, error };
}

function useAllRoutes() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['transport_routes_all'],
    queryFn: getAllTransportRoutes,
  });
  return { routes: data, isLoading };
}

// ── Main component ────────────────────────────────────────────────────────────

function LocationsHome() {
  const queryClient = useQueryClient();
  const { locations, isLoading } = useAllLocations();
  const { routes } = useAllRoutes();
  const { data: boats = [] } = useQuery({
    queryKey: ['boats'],
    queryFn: getBoats,
  });
  const { data: destinations = [] } = useQuery({
    queryKey: ['experience_locations_all'],
    queryFn: getAllExperienceLocations,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['locations_all'] });
    queryClient.invalidateQueries({ queryKey: ['locations'] });
    queryClient.invalidateQueries({ queryKey: ['transport_routes_all'] });
    queryClient.invalidateQueries({ queryKey: ['transport_routes'] });
  };

  // ── Active tab ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<
    'locations' | 'destinations' | 'routes' | 'curfew'
  >('locations');

  // ── Curfew settings ─────────────────────────────────────────────────────
  const { settings } = useSettings();
  const { updateSetting, isPending: isSavingCurfew } = useUpdateSetting();
  const [curfewInput, setCurfewInput] = useState<string>('');
  const [curfewReopenInput, setCurfewReopenInput] = useState<string>('08:00');
  const [whatsappInput, setWhatsappInput] = useState<string>('2348000000000');
  const curfewEnabled = settings?.boat_curfew_enabled ?? true;

  useEffect(() => {
    if (settings?.boat_curfew_time) {
      setCurfewInput(settings.boat_curfew_time);
    }
  }, [settings?.boat_curfew_time]);

  useEffect(() => {
    if (settings?.boat_curfew_reopen_time) {
      setCurfewReopenInput(settings.boat_curfew_reopen_time);
    }
  }, [settings?.boat_curfew_reopen_time]);

  useEffect(() => {
    if (settings?.booking_whatsapp_number) {
      setWhatsappInput(settings.booking_whatsapp_number);
    }
  }, [settings?.booking_whatsapp_number]);

  function handleToggleCurfewEnabled() {
    updateSetting({ key: 'boat_curfew_enabled', value: !curfewEnabled });
  }

  // ── Location create/edit ────────────────────────────────────────────────
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [orderedLocations, setOrderedLocations] = useState<Location[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setOrderedLocations(locations);
  }, [locations]);

  const {
    register: locReg,
    handleSubmit: locSubmit,
    reset: resetLoc,
    formState: { errors: locErrors },
  } = useForm<LocationFields>();
  const locFormActions = { register: locReg, errors: locErrors };

  const { mutate: saveLocation, isPending: isSavingLocation } = useMutation({
    mutationFn: (data: LocationFields) =>
      editingLocation
        ? updateLocation(editingLocation.id, {
            name: data.name,
            description: data.description || undefined,
            sort_order: Number(data.sort_order) || 0,
            is_active: data.is_active,
          })
        : createLocation({
            name: data.name,
            description: data.description || undefined,
            sort_order: Number(data.sort_order) || 0,
          }),
    onSuccess: () => {
      invalidate();
      setShowLocationForm(false);
      setEditingLocation(null);
      resetLoc();
      setLocationError(null);
    },
    onError: (err) =>
      setLocationError(err instanceof Error ? err.message : String(err)),
  });

  const { mutate: removeLocation, isPending: isDeletingLocation } = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err) =>
      setDeleteError(err instanceof Error ? err.message : String(err)),
  });

  const {
    mutate: saveLocationOrder,
    isPending: isSavingLocationOrder,
    error: locationOrderError,
  } = useMutation({
    mutationFn: reorderLocations,
    onSuccess: invalidate,
  });

  const hasOrderChanges = useMemo(() => {
    if (orderedLocations.length !== locations.length) return false;
    return orderedLocations.some((loc, idx) => loc.id !== locations[idx]?.id);
  }, [orderedLocations, locations]);

  function persistLocationOrder() {
    if (!hasOrderChanges || isSavingLocationOrder) return;
    saveLocationOrder(orderedLocations.map((loc) => loc.id));
  }

  function openNewLocation() {
    setEditingLocation(null);
    resetLoc({ name: '', description: '', sort_order: 0, is_active: true });
    setLocationError(null);
    setShowLocationForm(true);
  }

  function openEditLocation(loc: Location) {
    setEditingLocation(loc);
    resetLoc({
      name: loc.name,
      description: loc.description ?? '',
      sort_order: loc.sort_order,
      is_active: loc.is_active,
    });
    setLocationError(null);
    setShowLocationForm(true);
  }

  // ── Route create/edit ───────────────────────────────────────────────────
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const {
    register: routeReg,
    handleSubmit: routeSubmit,
    reset: resetRoute,
    formState: { errors: routeErrors },
  } = useForm<RouteFields>();
  const routeFormActions = { register: routeReg, errors: routeErrors };

  const { mutate: saveRoute, isPending: isSavingRoute } = useMutation({
    mutationFn: (data: RouteFields) =>
      upsertTransportRoute({
        id: editingRoute?.id,
        from_location_id: data.from_location_id,
        to_location_id: data.to_location_id,
        duration_hours: Number(data.duration_hours),
        is_active: true,
      }),
    onSuccess: () => {
      invalidate();
      setShowRouteForm(false);
      setEditingRoute(null);
      resetRoute();
      setRouteError(null);
    },
    onError: (err) =>
      setRouteError(err instanceof Error ? err.message : String(err)),
  });

  const [priceModalTarget, setPriceModalTarget] = useState<{
    route: TransportRoute;
    boat: Boat;
  } | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);

  const { mutate: saveTransferPrice, isPending: isSavingTransferPrice } =
    useMutation({
      mutationFn: saveBoatTransferPrice,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['transport_routes_all'] });
        queryClient.invalidateQueries({ queryKey: ['transport_routes'] });
        setPriceModalTarget(null);
        setPriceError(null);
      },
      onError: (err) =>
        setPriceError(err instanceof Error ? err.message : String(err)),
    });

  function openPriceModal(
    route: TransportRoute,
    boat: Boat,
    currentPrice: number | null,
  ) {
    setPriceModalTarget({ route, boat });
    setPriceInput(currentPrice != null ? String(currentPrice) : '');
    setPriceError(null);
  }

  const { mutate: removeRoute, isPending: isDeletingRoute } = useMutation({
    mutationFn: deleteTransportRoute,
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err) =>
      setDeleteError(err instanceof Error ? err.message : String(err)),
  });

  function openNewRoute() {
    setEditingRoute(null);
    resetRoute({
      from_location_id: '',
      to_location_id: '',
      duration_hours: undefined,
    });
    setRouteError(null);
    setShowRouteForm(true);
  }

  function openEditRoute(route: TransportRoute) {
    setEditingRoute(route);
    resetRoute({
      from_location_id: route.from_location_id,
      to_location_id: route.to_location_id,
      duration_hours: route.duration_hours ?? undefined,
    });
    setRouteError(null);
    setShowRouteForm(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Locations</h1>
          <p className={styles.pageSubtitle}>
            Manage operational jetties, customer-facing waterfront destinations,
            and the routes that connect them.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'locations' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('locations')}
        >
          <MapPin size={15} />
          Jetties
          <span className={styles.tabBadge}>{locations.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'destinations' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('destinations')}
        >
          <MapPinned size={15} />
          Destinations
          <span className={styles.tabBadge}>{destinations.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'routes' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          <Route size={15} />
          Pricing Routes
          <span className={styles.tabBadge}>{routes.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'curfew' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('curfew')}
        >
          <Clock size={15} />
          Booking Hours
        </button>
      </div>

      {activeTab === 'destinations' && <ExperienceLocationsHome embedded />}

      {activeTab === 'locations' && (
        <div className={styles.pageHeader}>
          <p className={styles.pageSubtitle}>
            Operational boarding and drop-off points used for yacht cruises and
            boat transfers.
          </p>
          <Button variant="primary" onClick={openNewLocation}>
            <Plus size={16} /> Add Jetty
          </Button>
        </div>
      )}

      {activeTab === 'routes' && (
        <div className={styles.pageHeader}>
          <p className={styles.pageSubtitle}>
            Define directional routes, then set the full price for each boat.
          </p>
          <Button variant="primary" onClick={openNewRoute}>
            <Plus size={16} /> Add Route
          </Button>
        </div>
      )}

      {activeTab === 'curfew' && (
        <div className={styles.pageHeader}>
          <p className={styles.pageSubtitle}>
            Set when online boat bookings pause and where customers can contact
            the team after hours.
          </p>
        </div>
      )}

      {/* ── Locations list ──────────────────────────────────────────────── */}
      {activeTab === 'locations' && (
        <div className={styles.list}>
          {isLoading && <p className={styles.empty}>Loading…</p>}
          {!isLoading && locations.length === 0 && (
            <p className={styles.empty}>
              No locations yet. Add one to get started.
            </p>
          )}
          {!isLoading && locations.length > 0 && (
            <p className={styles.reorderHint}>
              Drag rows to reorder locations. You can still edit Display Order
              in the form if preferred.
            </p>
          )}
          {!isLoading && orderedLocations.length > 0 && (
            <Reorder.Group
              as="div"
              axis="y"
              values={orderedLocations}
              onReorder={setOrderedLocations}
              className={styles.reorderGroup}
            >
              {orderedLocations.map((loc, index) => (
                <Reorder.Item
                  key={loc.id}
                  value={loc}
                  as="div"
                  className={`${styles.listRow} ${styles.draggableRow} ${!loc.is_active ? styles.listRowInactive : ''}`}
                  onDragEnd={persistLocationOrder}
                >
                  <button
                    type="button"
                    className={styles.dragHandle}
                    aria-label={`Drag to reorder ${loc.name}`}
                    title="Drag to reorder"
                  >
                    <GripVertical size={16} />
                  </button>
                  <div className={styles.listRowIcon}>
                    <MapPin size={16} />
                  </div>
                  <div className={styles.listRowContent}>
                    <span className={styles.listRowName}>{loc.name}</span>
                    {loc.description && (
                      <span className={styles.listRowMeta}>
                        {loc.description}
                      </span>
                    )}
                  </div>
                  <div className={styles.listRowMeta2}>
                    {!loc.is_active && (
                      <span className={styles.inactiveBadge}>Inactive</span>
                    )}
                    <span className={styles.sortOrder}>#{index + 1}</span>
                  </div>
                  <div className={styles.listRowActions}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => openEditLocation(loc)}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget({ kind: 'location', location: loc });
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
          {locationOrderError && (
            <p className={styles.submitError}>
              {locationOrderError instanceof Error
                ? locationOrderError.message
                : String(locationOrderError)}
            </p>
          )}
        </div>
      )}

      {/* ── Routes list ─────────────────────────────────────────────────── */}
      {activeTab === 'routes' && (
        <div className={styles.list}>
          {routes.length === 0 && (
            <div className={styles.routesHint}>
              <AlertTriangle size={18} />
              <p>
                No routes configured yet. Add a directional route, then set a
                separate full-transfer price for every eligible boat.
              </p>
            </div>
          )}
          {routes.map((route) => {
            const eligibleBoats = boats.filter(
              (boat) =>
                boat.is_available_for_rental &&
                (boat.jetty_location_id === route.from_location_id ||
                  (!boat.jetty_location_id &&
                    boat.pickup_location === route.from_location?.name)),
            );
            const pricedCount = eligibleBoats.filter((boat) =>
              route.boat_prices?.some(
                (price) => price.boat_id === boat.id && price.is_active,
              ),
            ).length;

            return (
              <div key={route.id} className={styles.routeCard}>
                <div className={styles.routeCardHeader}>
                  <div className={styles.routeCardTitle}>
                    <span className={styles.routeIconBadge}>
                      <Route size={15} />
                    </span>
                    <div className={styles.routeLabel}>
                      <span className={styles.routeFrom}>
                        {route.from_location?.name ?? '—'}
                      </span>
                      <span className={styles.routeArrow}>→</span>
                      <span className={styles.routeTo}>
                        {route.to_location?.name ?? '—'}
                      </span>
                    </div>
                    {eligibleBoats.length > 0 && (
                      <span
                        className={`${styles.routeCoverageBadge} ${
                          pricedCount === eligibleBoats.length
                            ? styles.routeCoverageBadgeComplete
                            : ''
                        }`}
                      >
                        {pricedCount}/{eligibleBoats.length} priced
                      </span>
                    )}
                  </div>
                  <div
                    className={`${styles.listRowActions} ${styles.routeActions}`}
                  >
                    <button
                      className={styles.iconBtn}
                      onClick={() => openEditRoute(route)}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget({ kind: 'route', route });
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className={styles.boatPriceList}>
                  {eligibleBoats.map((boat) => {
                    const savedPrice = route.boat_prices?.find(
                      (price) => price.boat_id === boat.id && price.is_active,
                    );
                    return (
                      <div className={styles.boatPriceRow} key={boat.id}>
                        <div className={styles.boatIdentity}>
                          <span className={styles.boatAvatar}>
                            <Anchor size={14} />
                          </span>
                          <div className={styles.boatIdentityText}>
                            <strong>{boat.name}</strong>
                            <span className={styles.boatCapacity}>
                              <Users size={11} />
                              {boat.max_guests
                                ? `${boat.max_guests} passengers`
                                : 'Capacity not set'}
                            </span>
                          </div>
                        </div>
                        <button
                          className={`${styles.priceDisplay} ${
                            !savedPrice ? styles.priceDisplayUnset : ''
                          }`}
                          onClick={() =>
                            openPriceModal(
                              route,
                              boat,
                              savedPrice?.price ?? null,
                            )
                          }
                          type="button"
                        >
                          {savedPrice ? (
                            <span className={styles.priceValue}>
                              {formatPrice(savedPrice.price)}
                            </span>
                          ) : (
                            <span className={styles.priceUnsetLabel}>
                              Not priced
                            </span>
                          )}
                          <span className={styles.priceEditIcon}>
                            <Pencil size={12} />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                  {eligibleBoats.length === 0 && (
                    <p className={styles.routePriceUnset}>
                      No transfer-enabled boats are assigned to this departure jetty.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Curfew section ──────────────────────────────────────────────── */}
      {activeTab === 'curfew' && (
        <div className={styles.curfewSection}>
          <div className={styles.curfewCard}>
            <div className={styles.curfewCardIcon}>
              <Clock size={20} />
            </div>
            <div className={styles.curfewCardBody}>
              <p className={styles.curfewCardTitle}>Online Boat Booking Hours</p>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={curfewEnabled}
                  onChange={handleToggleCurfewEnabled}
                  disabled={isSavingCurfew}
                  style={{ accentColor: '#007bff' }}
                />
                Enable online booking cutoff
              </label>
              <p className={styles.curfewCardHint}>
                Yacht cruises and boat transfers outside this window move to a
                WhatsApp-assisted booking instead of online checkout.
              </p>
              <div className={styles.curfewFields}>
                <label className={styles.curfewField}>
                  <span>Online booking opens</span>
                  <input
                    type="time"
                    className={styles.curfewInput}
                    value={curfewReopenInput}
                    onChange={(e) => setCurfewReopenInput(e.target.value)}
                    onBlur={() =>
                      updateSetting({
                        key: 'boat_curfew_reopen_time',
                        value: curfewReopenInput,
                      })
                    }
                    disabled={isSavingCurfew || !curfewEnabled}
                  />
                </label>
                <label className={styles.curfewField}>
                  <span>Online booking closes</span>
                  <input
                    type="time"
                    className={styles.curfewInput}
                    value={curfewInput}
                    onChange={(e) => setCurfewInput(e.target.value)}
                    onBlur={() =>
                      updateSetting({
                        key: 'boat_curfew_time',
                        value: curfewInput,
                      })
                    }
                    disabled={isSavingCurfew || !curfewEnabled}
                  />
                </label>
                <label className={`${styles.curfewField} ${styles.curfewFieldFull}`}>
                  <span>WhatsApp number</span>
                  <input
                    type="tel"
                    className={styles.curfewInput}
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    onBlur={() =>
                      updateSetting({
                        key: 'booking_whatsapp_number',
                        value: whatsappInput,
                      })
                    }
                    placeholder="2348000000000"
                    disabled={isSavingCurfew}
                  />
                  <small>Use international format without the + sign.</small>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Location form modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showLocationForm && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isSavingLocation &&
              e.target === e.currentTarget &&
              setShowLocationForm(false)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>
                    {editingLocation ? 'Edit Jetty' : 'Add Jetty'}
                  </h2>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setShowLocationForm(false)}
                    disabled={isSavingLocation}
                  >
                    <X />
                  </button>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={locSubmit((d) => saveLocation(d))}
                >
                  <FormInput
                    id="name"
                    label="Jetty Name"
                    formActions={locFormActions}
                    disabled={isSavingLocation}
                    placeholder="e.g. Victoria Island Jetty"
                  />
                  <FormInput
                    id="description"
                    label="Description (optional)"
                    formActions={locFormActions}
                    disabled={isSavingLocation}
                    required={false}
                    placeholder="Brief note about this location"
                  />
                  <div className={styles.formRow}>
                    <FormInput
                      id="sort_order"
                      type="number"
                      label="Display Order"
                      formActions={locFormActions}
                      disabled={isSavingLocation}
                      required={false}
                      placeholder="0"
                    />
                    <fieldset className={styles.toggleFieldset}>
                      <label className={styles.toggleLabel}>
                        <input
                          type="checkbox"
                          className={styles.toggleCheckbox}
                          {...locReg('is_active')}
                          disabled={isSavingLocation}
                        />
                        Active — show in booking dropdowns
                      </label>
                    </fieldset>
                  </div>
                  {locationError && (
                    <p className={styles.submitError}>{locationError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setShowLocationForm(false)}
                      disabled={isSavingLocation}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={isSavingLocation}
                    >
                      {isSavingLocation
                        ? 'Saving…'
                        : editingLocation
                          ? 'Save Changes'
                          : 'Add Jetty'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Route form modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showRouteForm && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isSavingRoute &&
              e.target === e.currentTarget &&
              setShowRouteForm(false)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>
                    {editingRoute ? 'Edit Route Price' : 'Add Pricing Route'}
                  </h2>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setShowRouteForm(false)}
                    disabled={isSavingRoute}
                  >
                    <X />
                  </button>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={routeSubmit((d) => saveRoute(d))}
                >
                  <div className={styles.formRow}>
                    <FormInput
                      id="from_location_id"
                      type="select"
                      label="From (Pickup)"
                      formActions={routeFormActions}
                      disabled={isSavingRoute}
                    >
                      <option value="">Select location…</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </FormInput>
                    <FormInput
                      id="to_location_id"
                      type="select"
                      label="To (Drop-off)"
                      formActions={routeFormActions}
                      disabled={isSavingRoute}
                    >
                      <option value="">Select location…</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </FormInput>
                  </div>
                  <FormInput
                    id="duration_hours"
                    type="number"
                    label="Boat Downtime (hours)"
                    formActions={routeFormActions}
                    disabled={isSavingRoute}
                    min={0.5}
                    step={0.5}
                    placeholder="e.g. 1.5"
                    validation={{
                      min: {
                        value: 0.5,
                        message: 'Duration must be at least 0.5 hours',
                      },
                    }}
                  />
                  <p className={styles.routeFormHint}>
                    How long the boat should be blocked from other bookings for
                    this route — include the full time it takes out of service,
                    however that plays out for this route. The system uses this
                    to check availability and avoid scheduling clashes with
                    other bookings.
                  </p>
                  <p className={styles.routeFormHint}>
                    Save the route first, then enter the full transfer price for
                    each eligible boat from the route list.
                  </p>
                  {routeError && (
                    <p className={styles.submitError}>{routeError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setShowRouteForm(false)}
                      disabled={isSavingRoute}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={isSavingRoute}
                    >
                      {isSavingRoute
                        ? 'Saving…'
                        : editingRoute
                          ? 'Save Changes'
                          : 'Add Route'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transfer price modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {priceModalTarget && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isSavingTransferPrice &&
              e.target === e.currentTarget &&
              setPriceModalTarget(null)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Transfer Price</h2>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setPriceModalTarget(null)}
                    disabled={isSavingTransferPrice}
                  >
                    <X />
                  </button>
                </div>
                <div className={styles.priceModalRoute}>
                  <span className={styles.priceModalBoat}>
                    <Anchor size={14} />
                    {priceModalTarget.boat.name}
                  </span>
                  <span className={styles.priceModalPath}>
                    {priceModalTarget.route.from_location?.name ?? '—'}
                    <span className={styles.routeArrow}> → </span>
                    {priceModalTarget.route.to_location?.name ?? '—'}
                  </span>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveTransferPrice({
                      route_id: priceModalTarget.route.id,
                      boat_id: priceModalTarget.boat.id,
                      price: priceInput === '' ? null : Number(priceInput),
                    });
                  }}
                >
                  <label className={styles.priceModalLabel}>
                    Full transfer price
                    <div className={styles.priceField}>
                      <span className={styles.priceFieldPrefix}>₦</span>
                      <input
                        autoFocus
                        className={styles.priceFieldInput}
                        disabled={isSavingTransferPrice}
                        min="0"
                        onChange={(e) => setPriceInput(e.target.value)}
                        placeholder="0"
                        type="number"
                        value={priceInput}
                      />
                    </div>
                  </label>
                  {priceError && (
                    <p className={styles.submitError}>{priceError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setPriceModalTarget(null)}
                      disabled={isSavingTransferPrice}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={isSavingTransferPrice}
                    >
                      {isSavingTransferPrice ? 'Saving…' : 'Confirm Price'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        error={deleteError}
        isPending={isDeletingLocation || isDeletingRoute}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (deleteTarget?.kind === 'location') {
            removeLocation(deleteTarget.location.id);
          } else if (deleteTarget?.kind === 'route') {
            removeRoute(deleteTarget.route.id);
          }
        }}
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === 'location'
            ? 'Delete Jetty?'
            : 'Delete Pricing Route?'
        }
      >
        {deleteTarget?.kind === 'location' ? (
          <p>
            Delete <strong>{deleteTarget.location.name}</strong>? Connected
            routes and their per-boat prices will also be removed. This cannot
            be undone.
          </p>
        ) : deleteTarget?.kind === 'route' ? (
          <p>
            Delete the route from{' '}
            <strong>{deleteTarget.route.from_location?.name ?? 'Unknown'}</strong>{' '}
            to <strong>{deleteTarget.route.to_location?.name ?? 'Unknown'}</strong>?
            Its per-boat prices will also be removed. This cannot be undone.
          </p>
        ) : null}
      </ConfirmDeleteModal>
    </div>
  );
}

export default LocationsHome;
