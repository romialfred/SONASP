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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
