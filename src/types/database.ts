export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sites: {
        Row: {
          id: string
          name: string
          site_type: 'factory' | 'airport' | 'refinery'
          country: 'GN' | 'CI' | 'ML'
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          site_type: 'factory' | 'airport' | 'refinery'
          country: 'GN' | 'CI' | 'ML'
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          site_type?: 'factory' | 'airport' | 'refinery'
          country?: 'GN' | 'CI' | 'ML'
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      batches: {
        Row: {
          id: string
          batch_number: string
          status: string
          origin_site_id: string | null
          current_site_id: string | null
          weight_grams: number
          weight_ounces: number
          shipping_date: string
          comments: string | null
          transportation_company: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          batch_number: string
          status?: string
          origin_site_id?: string | null
          current_site_id?: string | null
          weight_grams: number
          weight_ounces: number
          shipping_date: string
          comments?: string | null
          transportation_company?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          batch_number?: string
          status?: string
          origin_site_id?: string | null
          current_site_id?: string | null
          weight_grams?: number
          weight_ounces?: number
          shipping_date?: string
          comments?: string | null
          transportation_company?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          country: string
          address: string | null
          contact_person: string | null
          tax_id: string | null
          payment_terms: string
          credit_limit: number
          status: 'active' | 'inactive' | 'pending'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          country: string
          address?: string | null
          contact_person?: string | null
          tax_id?: string | null
          payment_terms?: string
          credit_limit?: number
          status?: 'active' | 'inactive' | 'pending'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          country?: string
          address?: string | null
          contact_person?: string | null
          tax_id?: string | null
          payment_terms?: string
          credit_limit?: number
          status?: 'active' | 'inactive' | 'pending'
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          sale_number: string
          customer_id: string
          batch_id: string | null
          quantity_oz: number
          london_am_rate: number
          freight_cost: number
          other_costs: number
          gross_proceeds: number
          net_proceeds: number
          royalties: number
          final_proceeds: number
          status: string
          created_by: string | null
          created_at: string
          approved_by: string | null
          approved_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          sale_number: string
          customer_id: string
          batch_id?: string | null
          quantity_oz: number
          london_am_rate: number
          freight_cost?: number
          other_costs?: number
          gross_proceeds: number
          net_proceeds: number
          royalties: number
          final_proceeds: number
          status?: string
          created_by?: string | null
          created_at?: string
          approved_by?: string | null
          approved_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          sale_number?: string
          customer_id?: string
          batch_id?: string | null
          quantity_oz?: number
          london_am_rate?: number
          freight_cost?: number
          other_costs?: number
          gross_proceeds?: number
          net_proceeds?: number
          royalties?: number
          final_proceeds?: number
          status?: string
          created_by?: string | null
          created_at?: string
          approved_by?: string | null
          approved_at?: string | null
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          user_email: string | null
          action: string
          module: string
          details: string
          ip_address: string | null
          status: 'success' | 'failed' | 'warning'
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_email?: string | null
          action: string
          module: string
          details: string
          ip_address?: string | null
          status?: 'success' | 'failed' | 'warning'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          user_email?: string | null
          action?: string
          module?: string
          details?: string
          ip_address?: string | null
          status?: 'success' | 'failed' | 'warning'
          created_at?: string
        }
      }
      exchange_rates: {
        Row: {
          id: string
          rate_date: string
          base_currency: string
          target_currency: string
          rate: number
          open_rate: number | null
          close_rate: number | null
          high_rate: number | null
          low_rate: number | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rate_date: string
          base_currency?: string
          target_currency: string
          rate: number
          open_rate?: number | null
          close_rate?: number | null
          high_rate?: number | null
          low_rate?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rate_date?: string
          base_currency?: string
          target_currency?: string
          rate?: number
          open_rate?: number | null
          close_rate?: number | null
          high_rate?: number | null
          low_rate?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
      }
      gold_prices: {
        Row: {
          id: string
          price_date: string
          london_am_rate: number
          london_pm_rate: number | null
          opening_price: number | null
          closing_price: number | null
          high_price: number | null
          low_price: number | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          price_date: string
          london_am_rate: number
          london_pm_rate?: number | null
          opening_price?: number | null
          closing_price?: number | null
          high_price?: number | null
          low_price?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          price_date?: string
          london_am_rate?: number
          london_pm_rate?: number | null
          opening_price?: number | null
          closing_price?: number | null
          high_price?: number | null
          low_price?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          notification_type: string
          title: string
          message: string
          entity_type: string | null
          entity_id: string | null
          is_read: boolean
          priority: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          notification_type: string
          title: string
          message: string
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          priority?: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          notification_type?: string
          title?: string
          message?: string
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          priority?: string
          created_at?: string
          read_at?: string | null
        }
      }
      analytics_cache: {
        Row: {
          id: string
          cache_key: string
          cache_type: string
          data: Json
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cache_key: string
          cache_type: string
          data: Json
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cache_key?: string
          cache_type?: string
          data?: Json
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_exchange_rate: {
        Args: { p_target_currency: string }
        Returns: number
      }
      get_current_gold_price: {
        Args: Record<string, never>
        Returns: number
      }
      calculate_rate_change: {
        Args: { p_currency: string; p_days: number }
        Returns: {
          current_rate: number
          previous_rate: number
          change_amount: number
          change_percentage: number
        }[]
      }
      cleanup_expired_cache: {
        Args: Record<string, never>
        Returns: number
      }
      refresh_sales_analytics: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
