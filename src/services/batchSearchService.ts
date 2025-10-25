import { supabase } from '@/lib/supabase';

export interface BatchSearchFilters {
  search_text?: string;
  status?: string[];
  metal_type?: string[];
  quality_grade?: string[];
  origin_site_id?: string[];
  current_site_id?: string[];
  from_date?: string;
  to_date?: string;
  min_weight?: number;
  max_weight?: number;
  is_on_hold?: boolean;
  has_quality_issues?: boolean;
  has_significant_variance?: boolean;
  tags?: string[];
  transportation_company?: string[];
}

export interface SavedSearch {
  id?: string;
  name: string;
  description?: string;
  filters: BatchSearchFilters;
  user_id: string;
}

export interface BatchComparison {
  batches: any[];
  comparison_fields: string[];
  differences: Record<string, any>;
}

export const batchSearchService = {
  async advancedSearch(filters: BatchSearchFilters, limit: number = 100, offset: number = 0) {
    let query = supabase
      .from('batches')
      .select(`
        *,
        origin_site:sites!batches_origin_site_id_fkey(name, country, site_type),
        current_site:sites!batches_current_site_id_fkey(name, country, site_type),
        created_by_user:user_profiles(full_name, email),
        quality_checks:batch_quality_checks(count),
        alerts:batch_alerts(count),
        tags:batch_tags(tag_name, tag_category)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (filters.search_text) {
      query = query.or(
        `batch_number.ilike.%${filters.search_text}%,comments.ilike.%${filters.search_text}%,sealed_container_id.ilike.%${filters.search_text}%`
      );
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters.metal_type && filters.metal_type.length > 0) {
      query = query.in('metal_type', filters.metal_type);
    }

    if (filters.quality_grade && filters.quality_grade.length > 0) {
      query = query.in('quality_grade', filters.quality_grade);
    }

    if (filters.origin_site_id && filters.origin_site_id.length > 0) {
      query = query.in('origin_site_id', filters.origin_site_id);
    }

    if (filters.current_site_id && filters.current_site_id.length > 0) {
      query = query.in('current_site_id', filters.current_site_id);
    }

    if (filters.from_date) {
      query = query.gte('shipping_date', filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte('shipping_date', filters.to_date);
    }

    if (filters.min_weight !== undefined) {
      query = query.gte('weight_grams', filters.min_weight);
    }

    if (filters.max_weight !== undefined) {
      query = query.lte('weight_grams', filters.max_weight);
    }

    if (filters.is_on_hold !== undefined) {
      query = query.eq('is_on_hold', filters.is_on_hold);
    }

    if (filters.transportation_company && filters.transportation_company.length > 0) {
      query = query.in('transportation_company', filters.transportation_company);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    let filteredData = data || [];

    if (filters.has_quality_issues) {
      const batchIds = filteredData.map(b => b.id);
      const { data: failedChecks } = await supabase
        .from('batch_quality_checks')
        .select('batch_id')
        .in('batch_id', batchIds)
        .eq('passed', false);

      const failedBatchIds = new Set(failedChecks?.map(c => c.batch_id) || []);
      filteredData = filteredData.filter(b => failedBatchIds.has(b.id));
    }

    if (filters.has_significant_variance) {
      const batchIds = filteredData.map(b => b.id);
      const { data: variances } = await supabase
        .from('receiving_records')
        .select('batch_id')
        .in('batch_id', batchIds)
        .eq('is_significant_variance', true);

      const varianceBatchIds = new Set(variances?.map(v => v.batch_id) || []);
      filteredData = filteredData.filter(b => varianceBatchIds.has(b.id));
    }

    if (filters.tags && filters.tags.length > 0) {
      const batchIds = filteredData.map(b => b.id);
      const { data: taggedBatches } = await supabase
        .from('batch_tags')
        .select('batch_id')
        .in('batch_id', batchIds)
        .in('tag_name', filters.tags);

      const taggedBatchIds = new Set(taggedBatches?.map(t => t.batch_id) || []);
      filteredData = filteredData.filter(b => taggedBatchIds.has(b.id));
    }

    return {
      data: filteredData,
      count: filteredData.length,
      total: count || 0,
    };
  },

  async saveSearch(search: SavedSearch) {
    const { data, error } = await supabase
      .from('saved_batch_searches')
      .insert({
        name: search.name,
        description: search.description,
        filters: search.filters,
        user_id: search.user_id,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getSavedSearches(userId: string) {
    const { data, error } = await supabase
      .from('saved_batch_searches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async deleteSavedSearch(searchId: string, userId: string) {
    const { error } = await supabase
      .from('saved_batch_searches')
      .delete()
      .eq('id', searchId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },

  async compareBatches(batchIds: string[]): Promise<BatchComparison> {
    const { data, error } = await supabase
      .from('batches')
      .select(`
        *,
        origin_site:sites!batches_origin_site_id_fkey(name),
        current_site:sites!batches_current_site_id_fkey(name),
        quality_checks:batch_quality_checks(*),
        receiving_records(*),
        refining_records(*)
      `)
      .in('id', batchIds);

    if (error) throw error;

    const comparisonFields = [
      'batch_number',
      'status',
      'metal_type',
      'quality_grade',
      'weight_grams',
      'expected_purity',
      'origin_site',
      'current_site',
      'shipping_date',
      'transportation_company',
    ];

    const differences: Record<string, any> = {};

    comparisonFields.forEach(field => {
      const values = data?.map(batch => {
        if (field === 'origin_site' || field === 'current_site') {
          return batch[field]?.name;
        }
        return batch[field];
      });

      const uniqueValues = [...new Set(values)];
      if (uniqueValues.length > 1) {
        differences[field] = uniqueValues;
      }
    });

    return {
      batches: data || [],
      comparison_fields: comparisonFields,
      differences,
    };
  },

  async exportBatches(filters: BatchSearchFilters, format: 'csv' | 'json' = 'csv') {
    const { data } = await this.advancedSearch(filters, 10000);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    const headers = [
      'Batch Number',
      'Status',
      'Metal Type',
      'Weight (g)',
      'Weight (oz)',
      'Quality Grade',
      'Origin Site',
      'Current Site',
      'Shipping Date',
      'Transportation Company',
      'Created At',
    ];

    const rows = data?.map(batch => [
      batch.batch_number,
      batch.status,
      batch.metal_type,
      batch.weight_grams,
      batch.weight_ounces,
      batch.quality_grade || 'N/A',
      batch.origin_site?.name || 'N/A',
      batch.current_site?.name || 'N/A',
      batch.shipping_date,
      batch.transportation_company || 'N/A',
      new Date(batch.created_at).toLocaleString(),
    ]);

    const csv = [
      headers.join(','),
      ...(rows?.map(row => row.join(',')) || []),
    ].join('\n');

    return csv;
  },

  async getBatchGroups(groupBy: 'origin_site' | 'metal_type' | 'status' | 'quality_grade') {
    const { data, error } = await supabase
      .from('batches')
      .select(`
        ${groupBy},
        count,
        weight_grams.sum()
      `)
      .not(groupBy, 'is', null);

    if (error) throw error;

    const groups: Record<string, any> = {};

    data?.forEach((item: any) => {
      const key = item[groupBy];
      if (!groups[key]) {
        groups[key] = {
          name: key,
          count: 0,
          total_weight: 0,
        };
      }
      groups[key].count += item.count || 1;
      groups[key].total_weight += item.sum || 0;
    });

    return Object.values(groups);
  },

  async getRelatedBatches(batchId: string) {
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('origin_site_id, shipping_date, metal_type')
      .eq('id', batchId)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) return [];

    const { data: splits, error: splitsError } = await supabase
      .from('batch_splits')
      .select(`
        child_batch_id,
        child_batch:batches!batch_splits_child_batch_id_fkey(*)
      `)
      .eq('parent_batch_id', batchId);

    const { data: merges, error: mergesError } = await supabase
      .from('batch_merges')
      .select('source_batch_ids')
      .eq('target_batch_id', batchId);

    const shippingDate = new Date(batch.shipping_date);
    const fromDate = new Date(shippingDate);
    fromDate.setDate(fromDate.getDate() - 7);
    const toDate = new Date(shippingDate);
    toDate.setDate(toDate.getDate() + 7);

    const { data: nearby, error: nearbyError } = await supabase
      .from('batches')
      .select('*')
      .eq('origin_site_id', batch.origin_site_id)
      .eq('metal_type', batch.metal_type)
      .gte('shipping_date', fromDate.toISOString().split('T')[0])
      .lte('shipping_date', toDate.toISOString().split('T')[0])
      .neq('id', batchId)
      .limit(10);

    return {
      split_batches: splits || [],
      merged_from: merges?.[0]?.source_batch_ids || [],
      nearby_shipments: nearby || [],
    };
  },
};
