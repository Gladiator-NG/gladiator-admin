import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Search,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Profile } from '../../services/apiProfile';
import FormInput from '../../ui/formElements/FormInput';
import Button from '../../ui/Button';
import { useUsers } from './useUsers';
import { useUpdateUser } from './useUpdateUser';
import { useDeleteUser } from './useDeleteUser';
import { useCreateUser } from './useCreateUser';
import { useUser } from '../authentication/useUser';
import styles from './UsersHome.module.css';

const ROLES = ['Admin', 'Staff'] as const;

// ── Edit form fields ──────────────────────────────────
interface EditFields {
  role: string;
}

// ── Create form fields ────────────────────────────────
interface CreateFields {
  email: string;
  fullName: string;
  role: string;
}

// ── Role badge ────────────────────────────────────────
function RoleBadge({ role }: { role: string | null }) {
  const r = role?.toLowerCase() ?? '';
  const cls = r.includes('admin')
    ? styles.badgeAdmin
    : r.includes('staff')
      ? styles.badgeStaff
      : styles.badgeNone;
  return <span className={`${styles.badge} ${cls}`}>{role ?? 'No role'}</span>;
}

// ── Avatar ────────────────────────────────────────────
function UserAvatar({ name }: { name: string | null }) {
  const initial = name?.charAt(0).toUpperCase() ?? '?';
  return <div className={styles.avatar}>{initial}</div>;
}

function UsersHome() {
  const { users, isLoading, error: usersError } = useUsers();
  const { update, isPending: isUpdating } = useUpdateUser();
  const { remove, isPending: isDeleting } = useDeleteUser();
  const { create, isPending: isCreating, error: createError } = useCreateUser();
  const { user: currentUser } = useUser();

  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // URL is the source of truth for search + highlight state
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
  const highlightedId = searchParams.get('highlight');

  // Scroll to highlighted row and auto-clear after 2.5s
  useEffect(() => {
    if (!highlightedId) return;
    setTimeout(() => {
      document.getElementById(`user-row-${highlightedId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 200);
    const t = setTimeout(() => sp({ highlight: null }), 2500);
    return () => clearTimeout(t);
  }, [highlightedId]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    );
  }, [users, search]);

  // ── Edit form ──────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetEditForm,
  } = useForm<EditFields>();
  const formActions = { register, errors };

  function openEdit(user: Profile) {
    setEditingUser(user);
    resetEditForm({
      role: user.role ?? 'Staff',
    });
  }

  function closeEdit() {
    setEditingUser(null);
  }

  function handleEditSubmit(data: EditFields) {
    if (!editingUser) return;
    update(
      { userId: editingUser.id, role: data.role },
      { onSuccess: closeEdit },
    );
  }

  // ── Create form ────────────────────────────────────
  const {
    register: createRegister,
    handleSubmit: createHandleSubmit,
    formState: { errors: createErrors },
    reset: resetCreateForm,
  } = useForm<CreateFields>({ defaultValues: { role: 'Staff' } });
  const createFormActions = { register: createRegister, errors: createErrors };

  function openCreate() {
    resetCreateForm({ email: '', fullName: '', role: 'Staff' });
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
  }

  function handleCreateSubmit(data: CreateFields) {
    create(
      { email: data.email, fullName: data.fullName, role: data.role },
      { onSuccess: closeCreate },
    );
  }

  // ── Delete confirm ─────────────────────────────────
  function handleDelete() {
    if (!deletingUser) return;
    remove(deletingUser.id, { onSuccess: () => setDeletingUser(null) });
  }

  const joinedDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Users</h1>
        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by name or role…"
              value={search}
              onChange={(e) => sp({ q: e.target.value })}
            />
          </div>
          <Button
            variant="primary"
            type="button"
            onClick={openCreate}
            className={styles.addUserBtn}
          >
            <UserPlus size={16} />
            Add User
          </Button>
        </div>
      </div>

      {/* Table — desktop / tablet */}
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th className={styles.colJoined}>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersError && (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  Error: {usersError.message}
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  Loading users…
                </td>
              </tr>
            )}
            {!isLoading && !usersError && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  No users found.
                </td>
              </tr>
            )}
            {filtered.map((user) => (
              <tr
                key={user.id}
                id={`user-row-${user.id}`}
                className={`${styles.tableRow} ${highlightedId === user.id ? styles.tableRowHighlighted : ''}`}
              >
                <td>
                  <div className={styles.userCell}>
                    <UserAvatar name={user.full_name} />
                    <div>
                      <div className={styles.userName}>
                        {user.full_name ?? '—'}
                      </div>
                      <div className={styles.userId}>
                        {user.id.slice(0, 8)}…
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <RoleBadge role={user.role} />
                </td>
                <td className={styles.colJoined}>
                  {joinedDate(user.created_at)}
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className={styles.actionBtn}
                      title={
                        user.id === currentUser?.id
                          ? 'Cannot edit your own account'
                          : 'Edit user'
                      }
                      onClick={() => openEdit(user)}
                      disabled={user.id === currentUser?.id}
                    >
                      <Pencil />
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      title={
                        user.id === currentUser?.id
                          ? 'Cannot delete your own account'
                          : 'Delete user'
                      }
                      onClick={() => setDeletingUser(user)}
                      disabled={user.id === currentUser?.id}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile card list */}
        <div className={styles.mobileList}>
          {isLoading && <p className={styles.empty}>Loading users…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className={styles.empty}>No users found.</p>
          )}
          {filtered.map((user) => (
            <div key={user.id} className={styles.mobileCard}>
              <UserAvatar name={user.full_name} />
              <div className={styles.mobileCardInfo}>
                <span className={styles.userName}>{user.full_name ?? '—'}</span>
                <RoleBadge role={user.role} />
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.actionBtn}
                  title={
                    user.id === currentUser?.id
                      ? 'Cannot edit your own account'
                      : 'Edit'
                  }
                  onClick={() => openEdit(user)}
                  disabled={user.id === currentUser?.id}
                >
                  <Pencil />
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  title={
                    user.id === currentUser?.id
                      ? 'Cannot delete your own account'
                      : 'Delete'
                  }
                  onClick={() => setDeletingUser(user)}
                  disabled={user.id === currentUser?.id}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Edit modal ── */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            className={styles.modalBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && closeEdit()}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Edit User</h2>
                <button
                  className={styles.modalCloseBtn}
                  onClick={closeEdit}
                  aria-label="Close"
                >
                  <X />
                </button>
              </div>

              <form
                className={styles.modalForm}
                onSubmit={handleSubmit(handleEditSubmit)}
              >
                <div className={styles.userInfo}>
                  <UserAvatar name={editingUser.full_name} />
                  <div>
                    <div className={styles.userName}>
                      {editingUser.full_name ?? '—'}
                    </div>
                    <div className={styles.userId}>
                      {editingUser.id.slice(0, 8)}…
                    </div>
                  </div>
                </div>
                <FormInput
                  id="role"
                  type="select"
                  label="Role"
                  formActions={formActions}
                  disabled={isUpdating}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </FormInput>
                <div className={styles.modalActions}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={closeEdit}
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={isUpdating}>
                    {isUpdating ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirm ── */}
      <AnimatePresence>
        {deletingUser && (
          <motion.div
            className={styles.modalBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) =>
              e.target === e.currentTarget && setDeletingUser(null)
            }
          >
            <motion.div
              className={styles.confirmModal}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className={styles.confirmIcon}>
                <AlertTriangle />
              </div>
              <h2 className={styles.confirmTitle}>Remove User?</h2>
              <p className={styles.confirmText}>
                Are you sure you want to remove{' '}
                <strong>{deletingUser.full_name ?? 'this user'}</strong>? This
                action cannot be undone.
              </p>
              <div className={styles.confirmActions}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setDeletingUser(null)}
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
                  {isDeleting ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create modal ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className={styles.modalBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && closeCreate()}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Add User</h2>
                <button
                  className={styles.modalCloseBtn}
                  onClick={closeCreate}
                  aria-label="Close"
                >
                  <X />
                </button>
              </div>

              <form
                className={styles.modalForm}
                onSubmit={createHandleSubmit(handleCreateSubmit)}
              >
                <FormInput
                  id="fullName"
                  label="Full Name"
                  formActions={createFormActions}
                  disabled={isCreating}
                />
                <FormInput
                  id="email"
                  type="email"
                  label="Email"
                  formActions={createFormActions}
                  disabled={isCreating}
                />
                <FormInput
                  id="role"
                  type="select"
                  label="Role"
                  formActions={createFormActions}
                  disabled={isCreating}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </FormInput>
                <div className={styles.defaultPasswordNotice}>
                  <span>
                    Default password: <strong>newGladiator123</strong>
                  </span>
                  <span>
                    The user will be advised to update their password on first
                    login.
                  </span>
                </div>
                {createError && (
                  <p className={styles.modalError}>{createError.message}</p>
                )}
                <div className={styles.modalActions}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={closeCreate}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating…' : 'Create User'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default UsersHome;
