import { useState, useEffect, useRef } from 'react';
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
  weight_ounces?: number;
  metal_type?: string;
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
  const filtersRef = useRef(filters);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Update filters ref when filters change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  /**
   * Fetch batches from database
   */
  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = filtersRef.current;

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
      if (currentFilters?.statuses && currentFilters.statuses.length > 0) {
        query = query.in('status', currentFilters.statuses);
      }

      if (currentFilters?.miningCompanyId) {
        query = query.eq('mining_company_id', currentFilters.miningCompanyId);
      }

      if (currentFilters?.userId) {
        query = query.eq('created_by', currentFilters.userId);
      }

      if (currentFilters?.batchId) {
        query = query.eq('id', currentFilters.batchId);
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
  };

  /**
   * Set up realtime subscription
   */
  useEffect(() => {
    // Initial fetch
    fetchBatches();

    // Clean up previous channel if exists
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

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
            const newBatch = payload.new as Batch;
            if (shouldIncludeBatch(newBatch, filtersRef.current)) {
              setBatches(prev => [newBatch, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedBatch = payload.new as Batch;
            setBatches(prev => {
              if (!shouldIncludeBatch(updatedBatch, filtersRef.current)) {
                return prev.filter(b => b.id !== updatedBatch.id);
              }
              return prev.map(b => b.id === updatedBatch.id ? updatedBatch : b);
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setBatches(prev => prev.filter(b => b.id !== deletedId));
          }

          // Refetch to get complete data with relations
          setTimeout(() => fetchBatches(), 100);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Realtime subscription status: ${status}`);
      });

    channelRef.current = realtimeChannel;

    // Cleanup
    return () => {
      console.log('🔌 Unsubscribing from realtime channel');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [
    filters?.batchId,
    filters?.statuses?.join(','),
    filters?.miningCompanyId,
    filters?.userId,
  ]);

  return {
    batches,
    loading,
    error,
    refetch: fetchBatches,
    channel: channelRef.current,
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
