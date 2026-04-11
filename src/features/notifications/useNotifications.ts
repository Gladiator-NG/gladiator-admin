import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import supabase from '../../services/supabase';
import {
  getNotifications,
  getNotificationPreferences,
  markNotificationRead,
  markAllNotificationsRead,
  upsertNotificationPreferences,
} from '../../services/apiNotifications';

export function useNotifications() {
  const queryClient = useQueryClient();
  // Unique per-mount channel name avoids React StrictMode double-subscribe crash
  const channelName = useRef(`notif_${Math.random().toString(36).slice(2, 9)}`);

  const { data: notifications = [], isPending } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchOnWindowFocus: true,
  });

  // Realtime: refetch instantly when any new notification is inserted
  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const { mutate: markRead } = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      queryClient.setQueryData(['notifications'], (old: typeof notifications) =>
        old.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const { mutate: markAllRead } = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      queryClient.setQueryData(['notifications'], (old: typeof notifications) =>
        old.map((n) => ({ ...n, is_read: true })),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return { notifications, unreadCount, markRead, markAllRead, isPending };
}

export function useNotificationPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences, isPending } = useQuery({
    queryKey: ['notification_preferences'],
    queryFn: getNotificationPreferences,
  });

  const { mutate: savePreferences, isPending: isSaving } = useMutation({
    mutationFn: upsertNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences'] });
    },
  });

  return {
    preferences,
    savePreferences,
    isPending,
    isSaving,
  };
}
