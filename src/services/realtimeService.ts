import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type SubscriptionCallback<T = any> = (payload: T) => void;

export class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  subscribeToBatches(
    onInsert?: SubscriptionCallback,
    onUpdate?: SubscriptionCallback,
    onDelete?: SubscriptionCallback
  ) {
    const channelName = 'batches-channel';

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'batches' },
        (payload) => onInsert?.(payload)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'batches' },
        (payload) => onUpdate?.(payload)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'batches' },
        (payload) => onDelete?.(payload)
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  subscribeToSales(
    onInsert?: SubscriptionCallback,
    onUpdate?: SubscriptionCallback,
    onDelete?: SubscriptionCallback
  ) {
    const channelName = 'sales-channel';

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales' },
        (payload) => onInsert?.(payload)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sales' },
        (payload) => onUpdate?.(payload)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'sales' },
        (payload) => onDelete?.(payload)
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  subscribeToPayments(
    onInsert?: SubscriptionCallback,
    onUpdate?: SubscriptionCallback
  ) {
    const channelName = 'payments-channel';

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        (payload) => onInsert?.(payload)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments' },
        (payload) => onUpdate?.(payload)
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  subscribeToReceiving(
    siteId: string,
    onInsert?: SubscriptionCallback,
    onUpdate?: SubscriptionCallback
  ) {
    const channelName = `receiving-${siteId}`;

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'receiving_records',
          filter: `receiving_site_id=eq.${siteId}`,
        },
        (payload) => onInsert?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'receiving_records',
          filter: `receiving_site_id=eq.${siteId}`,
        },
        (payload) => onUpdate?.(payload)
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  subscribeToAuditLogs(
    userId: string,
    onInsert?: SubscriptionCallback
  ) {
    const channelName = `audit-${userId}`;

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onInsert?.(payload)
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  unsubscribeAll() {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

export const realtimeService = new RealtimeService();
