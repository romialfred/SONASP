import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface BatchRealtimeFilters {
  statuses?: string[];
  miningCompanyId?: string;
  userId?: string;
  batchId?: string;
}

export interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  metal_type: string;
  shipping_date: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

/**
 * Custom hook for real-time batch synchronization
 * Subscribes to Supabase Realtime changes on batches table
 */
export function useBatchRealtime(filters?: BatchRealtimeFilters) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  /**
   * Fetch batches from database
   */
  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('batches')
        .select(`
          *,
          mining_company:mining_companies(name, country),
          mine_transport:transport_companies!batches_mine_to_airport_transport_id_fkey(name),
          airport_transport:transport_companies!batches_airport_to_refinery_transport_id_fkey(name),
          refinery:refineries(name, location)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses);
      }

      if (filters?.miningCompanyId) {
        query = query.eq('mining_company_id', filters.miningCompanyId);
      }

      if (filters?.userId) {
        query = query.eq('created_by', filters.userId);
      }

      if (filters?.batchId) {
        query = query.eq('id', filters.batchId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching batches:', fetchError);
        setError(fetchError.message);
        setBatches([]);
      } else {
        setBatches(data || []);
      }
    } catch (err: any) {
      console.error('Error in fetchBatches:', err);
      setError(err?.message || 'Unknown error');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [filters?.statuses, filters?.miningCompanyId, filters?.userId, filters?.batchId]);

  /**
   * Set up realtime subscription
   */
  useEffect(() => {
    // Initial fetch
    fetchBatches();

    // Set up realtime channel
    const channelName = `batches-${filters?.batchId || 'all'}-${Date.now()}`;
    const realtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batches',
          filter: filters?.batchId ? `id=eq.${filters.batchId}` : undefined,
        },
        (payload) => {
          console.log('📡 Realtime update received:', payload);

          if (payload.eventType === 'INSERT') {
            // Check if new batch matches filters
            const newBatch = payload.new as Batch;
            if (shouldIncludeBatch(newBatch, filters)) {
              setBatches(prev => [newBatch, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedBatch = payload.new as Batch;
            setBatches(prev => {
              // Check if batch still matches filters
              if (!shouldIncludeBatch(updatedBatch, filters)) {
                // Remove batch from list if it no longer matches
                return prev.filter(b => b.id !== updatedBatch.id);
              }
              // Update existing batch
              return prev.map(b => b.id === updatedBatch.id ? updatedBatch : b);
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setBatches(prev => prev.filter(b => b.id !== deletedId));
          }

          // Refetch to get complete data with relations
          fetchBatches();
        }
      )
      .subscribe((status) => {
        console.log(`📡 Realtime subscription status: ${status}`);
      });

    setChannel(realtimeChannel);

    // Cleanup
    return () => {
      console.log('🔌 Unsubscribing from realtime channel');
      realtimeChannel.unsubscribe();
    };
  }, [fetchBatches, filters?.batchId]);

  /**
   * Manual refetch function
   */
  const refetch = useCallback(() => {
    return fetchBatches();
  }, [fetchBatches]);

  return {
    batches,
    loading,
    error,
    refetch,
    channel,
  };
}

/**
 * Helper function to check if a batch matches the filters
 */
function shouldIncludeBatch(batch: Batch, filters?: BatchRealtimeFilters): boolean {
  if (!filters) return true;

  if (filters.statuses && filters.statuses.length > 0) {
    if (!filters.statuses.includes(batch.status)) {
      return false;
    }
  }

  if (filters.miningCompanyId) {
    if (batch.mining_company_id !== filters.miningCompanyId) {
      return false;
    }
  }

  if (filters.userId) {
    if (batch.created_by !== filters.userId) {
      return false;
    }
  }

  if (filters.batchId) {
    if (batch.id !== filters.batchId) {
      return false;
    }
  }

  return true;
}

/**
 * Hook for single batch realtime updates
 */
export function useSingleBatchRealtime(batchId: string | undefined) {
  const { batches, loading, error, refetch } = useBatchRealtime(
    batchId ? { batchId } : undefined
  );

  return {
    batch: batches[0] || null,
    loading,
    error,
    refetch,
  };
}
