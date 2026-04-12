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
} from '../../services/apiTransport';
import type { Location, TransportRoute } from '../../services/apiTransport';
import { formatPrice } from '../../utils/format';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import FormInput from '../../ui/formElements/FormInput';
import Button from '../../ui/Button';
import { useSettings, useUpdateSetting } from '../settings/useSettings';
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
  price_per_trip: number;
  duration_hours: number;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useAllLocations() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['locations_all'],
    queryFn: getAllLocations,
  });
  return { locations: data, isLoading, error };
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['locations_all'] });
    queryClient.invalidateQueries({ queryKey: ['locations'] });
    queryClient.invalidateQueries({ queryKey: ['transport_routes_all'] });
    queryClient.invalidateQueries({ queryKey: ['transport_routes'] });
  };

  // ── Active tab ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'locations' | 'routes' | 'curfew'>(
    'locations',
  );

  // ── Curfew settings ─────────────────────────────────────────────────────
  const { settings } = useSettings();
  const { updateSetting, isPending: isSavingCurfew } = useUpdateSetting();
  const [curfewInput, setCurfewInput] = useState<string>('');

  useEffect(() => {
    if (settings?.boat_curfew_time) {
      setCurfewInput(settings.boat_curfew_time);
    }
  }, [settings?.boat_curfew_time]);

  function handleCurfewSave() {
    if (!curfewInput) return;
    updateSetting({ key: 'boat_curfew_time', value: curfewInput });
  }

  // ── Location create/edit ────────────────────────────────────────────────
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [orderedLocations, setOrderedLocations] = useState<Location[]>([]);

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

  const { mutate: removeLocation } = useMutation({
    mutationFn: deleteLocation,
    onSuccess: invalidate,
    onError: (err) => alert(err instanceof Error ? err.message : String(err)),
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
        from_location_id: data.from_location_id,
        to_location_id: data.to_location_id,
        price_per_trip:
          data.price_per_trip != null ? Number(data.price_per_trip) : null,
        duration_hours:
          data.duration_hours != null ? Number(data.duration_hours) : null,
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

  const { mutate: removeRoute } = useMutation({
    mutationFn: deleteTransportRoute,
    onSuccess: invalidate,
    onError: (err) => alert(err instanceof Error ? err.message : String(err)),
  });

  function openNewRoute() {
    setEditingRoute(null);
    resetRoute({
      from_location_id: '',
      to_location_id: '',
      price_per_trip: undefined,
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
      price_per_trip: route.price_per_trip ?? undefined,
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
          <h1 className={styles.pageTitle}>Transport Locations</h1>
          <p className={styles.pageSubtitle}>
            Manage the jetties and drop-off points used for transport bookings,
            and set prices between them.
          </p>
        </div>
        <div
          className={styles.headerActionWrap}
          style={{ visibility: activeTab === 'curfew' ? 'hidden' : 'visible' }}
        >
          <Button
            variant="primary"
            onClick={activeTab === 'locations' ? openNewLocation : openNewRoute}
          >
            <Plus size={16} />
            {activeTab === 'locations' ? 'Add Location' : 'Add Route'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'locations' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('locations')}
        >
          <MapPin size={15} />
          Locations
          <span className={styles.tabBadge}>{locations.length}</span>
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
          Transport Curfew
        </button>
      </div>

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
                        if (
                          confirm(
                            `Delete location "${loc.name}"? This cannot be undone.`,
                          )
                        )
                          removeLocation(loc.id);
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
                No routes configured yet. Add a route to set the per-person
                price between two locations — the booking form will then
                auto-calculate the fare (× passenger count, minimum 4) when a
                customer selects those stops.
              </p>
            </div>
          )}
          {routes.map((route) => (
            <div key={route.id} className={`${styles.listRow} ${styles.routeRow}`}>
              <div className={styles.routeMain}>
                <div className={styles.routeHeaderRow}>
                  <div className={styles.routeLabel}>
                    <span className={styles.routeFrom}>
                      {route.from_location?.name ?? '—'}
                    </span>
                    <span className={styles.routeArrow}>→</span>
                    <span className={styles.routeTo}>
                      {route.to_location?.name ?? '—'}
                    </span>
                  </div>
                  <div className={`${styles.listRowActions} ${styles.routeActions}`}>
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
                        if (confirm('Delete this route?')) removeRoute(route.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className={styles.routeMetaRow}>
                  <div className={styles.routePrice}>
                    {route.price_per_trip != null ? (
                      <>
                        {formatPrice(route.price_per_trip)}
                        <span className={styles.routePriceUnit}>/person</span>
                      </>
                    ) : (
                      <span className={styles.routePriceUnset}>Price not set</span>
                    )}
                  </div>
                  {route.duration_hours != null && (
                    <div className={styles.routeDuration}>
                      <span className={styles.routePriceUnit}>
                        {route.duration_hours}hr one-way
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
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
              <p className={styles.curfewCardTitle}>Boat Curfew Time</p>
              <p className={styles.curfewCardHint}>
                Boats cannot be booked if the cruise (plus 1&nbsp;hr buffer)
                ends after this time. Leave blank to disable the curfew.
              </p>
              <div className={styles.curfewRow}>
                <input
                  type="time"
                  className={styles.curfewInput}
                  value={curfewInput}
                  onChange={(e) => setCurfewInput(e.target.value)}
                  disabled={isSavingCurfew}
                />
                <Button
                  variant="primary"
                  onClick={handleCurfewSave}
                  disabled={isSavingCurfew || !curfewInput}
                >
                  {isSavingCurfew ? 'Saving…' : 'Save'}
                </Button>
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
                    {editingLocation ? 'Edit Location' : 'Add Location'}
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
                    label="Location Name"
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
                          : 'Add Location'}
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
                    id="price_per_trip"
                    type="number"
                    label="Price per Person (₦)"
                    formActions={routeFormActions}
                    disabled={isSavingRoute}
                    placeholder="e.g. 25000"
                  />
                  <FormInput
                    id="duration_hours"
                    type="number"
                    label="One-way Trip Duration (hours)"
                    formActions={routeFormActions}
                    disabled={isSavingRoute}
                    required={false}
                    placeholder="e.g. 2"
                    min={0.5}
                    step={0.5}
                  />
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
    </div>
  );
}

export default LocationsHome;
