import supabase from './supabase';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_id: string | null;
  entity_type: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  is_read: boolean;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  notif_new_booking: boolean;
  notif_booking_status: boolean;
  notif_new_boat: boolean;
  notif_new_beach_house: boolean;
  notif_new_customer: boolean;
  notif_new_user: boolean;
  notif_delete_booking: boolean;
  notif_delete_customer: boolean;
  notif_delete_boat: boolean;
  notif_delete_beach_house: boolean;
  notif_delete_user: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_notifications: true,
  notif_new_booking: true,
  notif_booking_status: true,
  notif_new_boat: true,
  notif_new_beach_house: true,
  notif_new_customer: true,
  notif_new_user: true,
  notif_delete_booking: true,
  notif_delete_customer: true,
  notif_delete_boat: true,
  notif_delete_beach_house: true,
  notif_delete_user: true,
};

export async function getNotifications(): Promise<AppNotification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [notifRes, readsRes] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', user.id),
  ]);

  const readIds = new Set(
    (readsRes.data ?? []).map(
      (r: { notification_id: string }) => r.notification_id,
    ),
  );

  return (notifRes.data ?? []).map((n) => ({
    ...n,
    is_read: readIds.has(n.id),
  })) as AppNotification[];
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notification_reads')
    .upsert(
      { user_id: user.id, notification_id: notificationId },
      { onConflict: 'user_id,notification_id' },
    );
}

export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: all } = await supabase.from('notifications').select('id');
  if (!all?.length) return;

  await supabase.from('notification_reads').upsert(
    all.map((n: { id: string }) => ({
      user_id: user.id,
      notification_id: n.id,
    })),
    { onConflict: 'user_id,notification_id' },
  );
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...DEFAULT_PREFERENCES };

  const { data } = await supabase
    .from('notification_preferences')
    .select(
      'email_notifications, notif_new_booking, notif_booking_status, notif_new_boat, notif_new_beach_house, notif_new_customer, notif_new_user, notif_delete_booking, notif_delete_customer, notif_delete_boat, notif_delete_beach_house, notif_delete_user',
    )
    .eq('user_id', user.id)
    .single();

  if (!data) return { ...DEFAULT_PREFERENCES };

  return {
    email_notifications: data.email_notifications ?? true,
    notif_new_booking: data.notif_new_booking ?? true,
    notif_booking_status: data.notif_booking_status ?? true,
    notif_new_boat: data.notif_new_boat ?? true,
    notif_new_beach_house: data.notif_new_beach_house ?? true,
    notif_new_customer: data.notif_new_customer ?? true,
    notif_new_user: data.notif_new_user ?? true,
    notif_delete_booking: data.notif_delete_booking ?? true,
    notif_delete_customer: data.notif_delete_customer ?? true,
    notif_delete_boat: data.notif_delete_boat ?? true,
    notif_delete_beach_house: data.notif_delete_beach_house ?? true,
    notif_delete_user: data.notif_delete_user ?? true,
  };
}

export async function upsertNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('notification_preferences').upsert(
    {
      // Only include fields that were provided — upsert only updates specified columns
      ...prefs,
      user_id: user.id,
      email: user.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}

export interface ActivityLogInput {
  type: string;
  title: string;
  message: string;
  entity_id?: string | null;
  entity_type?: string | null;
  actor_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Insert an activity-log entry visible to all users.
 * Called from admin UI hooks after successful mutations.
 */
export async function insertActivityLog(
  input: ActivityLogInput,
): Promise<void> {
  await supabase.from('notifications').insert({
    type: input.type,
    title: input.title,
    message: input.message,
    entity_id: input.entity_id ?? null,
    entity_type: input.entity_type ?? null,
    actor_name: input.actor_name ?? null,
    metadata: input.metadata ?? null,
  });
}
