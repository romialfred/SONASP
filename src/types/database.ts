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
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          role: 'factory' | 'airport' | 'refinery' | 'customer' | 'management'
          is_active: boolean
          two_factor_enabled: boolean
          two_factor_secret: string | null
          backup_codes: string[] | null
          language: 'en' | 'fr'
          email_notifications: boolean
          batch_notifications: boolean
          approval_notifications: boolean
          last_login_at: string | null
          last_login_ip: string | null
          failed_login_attempts: number
          locked_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          role?: 'factory' | 'airport' | 'refinery' | 'customer' | 'management'
          is_active?: boolean
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          backup_codes?: string[] | null
          language?: 'en' | 'fr'
          email_notifications?: boolean
          batch_notifications?: boolean
          approval_notifications?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          role?: 'factory' | 'airport' | 'refinery' | 'customer' | 'management'
          is_active?: boolean
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          backup_codes?: string[] | null
          language?: 'en' | 'fr'
          email_notifications?: boolean
          batch_notifications?: boolean
          approval_notifications?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_site_assignments: {
        Row: {
          id: string
          user_id: string
          site_id: string
          is_primary: boolean
          assigned_by: string | null
          assigned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          site_id: string
          is_primary?: boolean
          assigned_by?: string | null
          assigned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          site_id?: string
          is_primary?: boolean
          assigned_by?: string | null
          assigned_at?: string
        }
      }
      user_permissions: {
        Row: {
          id: string
          user_id: string
          permission: string
          resource: string
          granted_by: string | null
          granted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          permission: string
          resource: string
          granted_by?: string | null
          granted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          permission?: string
          resource?: string
          granted_by?: string | null
          granted_at?: string
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          session_token: string
          ip_address: string | null
          user_agent: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_token: string
          ip_address?: string | null
          user_agent?: string | null
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_token?: string
          ip_address?: string | null
          user_agent?: string | null
          expires_at?: string
          created_at?: string
        }
      }
      security_events: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          ip_address: string | null
          user_agent: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: string
          ip_address?: string | null
          user_agent?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          event_type?: string
          ip_address?: string | null
          user_agent?: string | null
          details?: Json | null
          created_at?: string
        }
      }
      batch_status_history: {
        Row: {
          id: string
          batch_id: string
          status: string
          changed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          status: string
          changed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          status?: string
          changed_by?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      receiving_records: {
        Row: {
          id: string
          batch_id: string
          site_id: string
          expected_weight_grams: number
          received_weight_grams: number
          variance_grams: number
          variance_percentage: number
          received_by: string | null
          reconciled: boolean
          reconciliation_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          site_id: string
          expected_weight_grams: number
          received_weight_grams: number
          variance_grams: number
          variance_percentage: number
          received_by?: string | null
          reconciled?: boolean
          reconciliation_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          site_id?: string
          expected_weight_grams?: number
          received_weight_grams?: number
          variance_grams?: number
          variance_percentage?: number
          received_by?: string | null
          reconciled?: boolean
          reconciliation_notes?: string | null
          created_at?: string
        }
      }
      refining_records: {
        Row: {
          id: string
          batch_id: string
          pre_melt_weight_grams: number
          post_melt_weight_grams: number
          fineness_percentage: number
          metal_retained_percentage: number
          final_fine_grams: number
          final_fine_ounces: number
          processed_by: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          pre_melt_weight_grams: number
          post_melt_weight_grams: number
          fineness_percentage: number
          metal_retained_percentage: number
          final_fine_grams: number
          final_fine_ounces: number
          processed_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          pre_melt_weight_grams?: number
          post_melt_weight_grams?: number
          fineness_percentage?: number
          metal_retained_percentage?: number
          final_fine_grams?: number
          final_fine_ounces?: number
          processed_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          sale_id: string
          amount: number
          currency: string
          exchange_rate: number
          expected_payment_date: string | null
          actual_payment_date: string | null
          bank_reference: string | null
          payment_proof_url: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          amount: number
          currency: string
          exchange_rate: number
          expected_payment_date?: string | null
          actual_payment_date?: string | null
          bank_reference?: string | null
          payment_proof_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          amount?: number
          currency?: string
          exchange_rate?: number
          expected_payment_date?: string | null
          actual_payment_date?: string | null
          bank_reference?: string | null
          payment_proof_url?: string | null
          status?: string
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
      log_security_event: {
        Args: {
          p_user_id: string | null
          p_event_type: string
          p_ip_address?: string | null
          p_user_agent?: string | null
          p_details?: Json | null
        }
        Returns: void
      }
      user_has_permission: {
        Args: {
          p_user_id: string
          p_permission: string
          p_resource: string
        }
        Returns: boolean
      }
      get_user_sites: {
        Args: { p_user_id: string }
        Returns: {
          site_id: string
          site_name: string
          site_type: string
          is_primary: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
