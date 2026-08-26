export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      allowed_status_transitions: {
        Row: {
          created_at: string | null
          description: string
          from_status: string
          id: string
          is_system_transition: boolean | null
          requires_role: string | null
          to_status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          from_status: string
          id?: string
          is_system_transition?: boolean | null
          requires_role?: string | null
          to_status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          from_status?: string
          id?: string
          is_system_transition?: boolean | null
          requires_role?: string | null
          to_status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      annual_budgets: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          mining_company_id: string | null
          site_id: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          mining_company_id?: string | null
          site_id?: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          mining_company_id?: string | null
          site_id?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "annual_budgets_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approver_role: string
          assigned_to: string | null
          comments: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          rejection_reason: string | null
          request_type: string
          requested_at: string | null
          requested_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approver_role: string
          assigned_to?: string | null
          comments?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          rejection_reason?: string | null
          request_type: string
          requested_at?: string | null
          requested_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approver_role?: string
          assigned_to?: string | null
          comments?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          rejection_reason?: string | null
          request_type?: string
          requested_at?: string | null
          requested_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artisanal_site_assignments: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string
          role: string
          site_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone: string
          role: string
          site_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          role?: string
          site_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisanal_site_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "artisanal_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      artisanal_site_productions: {
        Row: {
          artisan_count: number
          created_at: string
          created_by: string | null
          gold_weight_grams: number
          id: string
          notes: string | null
          production_date: string
          revenue_fcfa: number
          site_id: string
          taxes_fcfa: number
        }
        Insert: {
          artisan_count?: number
          created_at?: string
          created_by?: string | null
          gold_weight_grams: number
          id?: string
          notes?: string | null
          production_date: string
          revenue_fcfa?: number
          site_id: string
          taxes_fcfa?: number
        }
        Update: {
          artisan_count?: number
          created_at?: string
          created_by?: string | null
          gold_weight_grams?: number
          id?: string
          notes?: string | null
          production_date?: string
          revenue_fcfa?: number
          site_id?: string
          taxes_fcfa?: number
        }
        Relationships: [
          {
            foreignKeyName: "artisanal_site_productions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "artisanal_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      artisanal_sites: {
        Row: {
          active_miners: number
          area_hectares: number
          authorized_chemicals: string[]
          authorized_miners: number
          average_hole_depth_m: number
          code: string
          created_at: string
          created_by: string | null
          exploitation_type: string
          id: string
          latitude: number
          locality: string
          longitude: number
          name: string
          notes: string | null
          photos: string[]
          province: string
          region: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_miners?: number
          area_hectares: number
          authorized_chemicals?: string[]
          authorized_miners?: number
          average_hole_depth_m?: number
          code: string
          created_at?: string
          created_by?: string | null
          exploitation_type: string
          id?: string
          latitude: number
          locality: string
          longitude: number
          name: string
          notes?: string | null
          photos?: string[]
          province: string
          region: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_miners?: number
          area_hectares?: number
          authorized_chemicals?: string[]
          authorized_miners?: number
          average_hole_depth_m?: number
          code?: string
          created_at?: string
          created_by?: string | null
          exploitation_type?: string
          id?: string
          latitude?: number
          locality?: string
          longitude?: number
          name?: string
          notes?: string | null
          photos?: string[]
          province?: string
          region?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      assay_base_metals: {
        Row: {
          aluminum_ppm: number | null
          calcium_ppm: number | null
          certificate_id: string | null
          chromium_ppm: number | null
          cobalt_ppm: number | null
          copper_ppm: number | null
          created_at: string | null
          id: string
          iron_ppm: number | null
          magnesium_ppm: number | null
          manganese_ppm: number | null
          nickel_ppm: number | null
          notes: string | null
          tin_ppm: number | null
          updated_at: string | null
          zinc_ppm: number | null
        }
        Insert: {
          aluminum_ppm?: number | null
          calcium_ppm?: number | null
          certificate_id?: string | null
          chromium_ppm?: number | null
          cobalt_ppm?: number | null
          copper_ppm?: number | null
          created_at?: string | null
          id?: string
          iron_ppm?: number | null
          magnesium_ppm?: number | null
          manganese_ppm?: number | null
          nickel_ppm?: number | null
          notes?: string | null
          tin_ppm?: number | null
          updated_at?: string | null
          zinc_ppm?: number | null
        }
        Update: {
          aluminum_ppm?: number | null
          calcium_ppm?: number | null
          certificate_id?: string | null
          chromium_ppm?: number | null
          cobalt_ppm?: number | null
          copper_ppm?: number | null
          created_at?: string | null
          id?: string
          iron_ppm?: number | null
          magnesium_ppm?: number | null
          manganese_ppm?: number | null
          nickel_ppm?: number | null
          notes?: string | null
          tin_ppm?: number | null
          updated_at?: string | null
          zinc_ppm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assay_base_metals_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_base_metals_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates_with_shipping"
            referencedColumns: ["id"]
          },
        ]
      }
      assay_certificate_data: {
        Row: {
          certificate_date: string | null
          certificate_id: string
          certificate_number: string | null
          copper_percentage: number | null
          created_at: string | null
          deleterious_elements: Json | null
          extraction_confidence: number | null
          fineness: number | null
          gold_content_gpt: number | null
          gold_content_ozt: number | null
          gold_content_ppm: number | null
          gold_purity_percentage: number | null
          id: string
          iron_percentage: number | null
          is_verified: boolean | null
          laboratory_address: string | null
          laboratory_name: string | null
          moisture_percentage: number | null
          palladium_content_ppm: number | null
          platinum_content_ppm: number | null
          raw_text: string | null
          sample_description: string | null
          sample_id: string | null
          sample_weight_g: number | null
          shipping_preparation_id: string
          silver_content_gpt: number | null
          silver_content_ozt: number | null
          silver_content_ppm: number | null
          silver_purity_percentage: number | null
          total_weight_g: number | null
          updated_at: string | null
          verification_notes: string | null
          zinc_percentage: number | null
        }
        Insert: {
          certificate_date?: string | null
          certificate_id: string
          certificate_number?: string | null
          copper_percentage?: number | null
          created_at?: string | null
          deleterious_elements?: Json | null
          extraction_confidence?: number | null
          fineness?: number | null
          gold_content_gpt?: number | null
          gold_content_ozt?: number | null
          gold_content_ppm?: number | null
          gold_purity_percentage?: number | null
          id?: string
          iron_percentage?: number | null
          is_verified?: boolean | null
          laboratory_address?: string | null
          laboratory_name?: string | null
          moisture_percentage?: number | null
          palladium_content_ppm?: number | null
          platinum_content_ppm?: number | null
          raw_text?: string | null
          sample_description?: string | null
          sample_id?: string | null
          sample_weight_g?: number | null
          shipping_preparation_id: string
          silver_content_gpt?: number | null
          silver_content_ozt?: number | null
          silver_content_ppm?: number | null
          silver_purity_percentage?: number | null
          total_weight_g?: number | null
          updated_at?: string | null
          verification_notes?: string | null
          zinc_percentage?: number | null
        }
        Update: {
          certificate_date?: string | null
          certificate_id?: string
          certificate_number?: string | null
          copper_percentage?: number | null
          created_at?: string | null
          deleterious_elements?: Json | null
          extraction_confidence?: number | null
          fineness?: number | null
          gold_content_gpt?: number | null
          gold_content_ozt?: number | null
          gold_content_ppm?: number | null
          gold_purity_percentage?: number | null
          id?: string
          iron_percentage?: number | null
          is_verified?: boolean | null
          laboratory_address?: string | null
          laboratory_name?: string | null
          moisture_percentage?: number | null
          palladium_content_ppm?: number | null
          platinum_content_ppm?: number | null
          raw_text?: string | null
          sample_description?: string | null
          sample_id?: string | null
          sample_weight_g?: number | null
          shipping_preparation_id?: string
          silver_content_gpt?: number | null
          silver_content_ozt?: number | null
          silver_content_ppm?: number | null
          silver_purity_percentage?: number | null
          total_weight_g?: number | null
          updated_at?: string | null
          verification_notes?: string | null
          zinc_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assay_certificate_data_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_certificate_data_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates_with_shipping"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_certificate_data_certificate_shipping_fkey"
            columns: ["certificate_id", "shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates"
            referencedColumns: ["id", "shipping_preparation_id"]
          },
          {
            foreignKeyName: "assay_certificate_data_certificate_shipping_fkey"
            columns: ["certificate_id", "shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates_with_shipping"
            referencedColumns: ["id", "shipping_preparation_id"]
          },
        ]
      }
      assay_certificates: {
        Row: {
          approval_notes: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          certificate_date: string | null
          certificate_number: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          fineness: number | null
          gold_content_gpt: number | null
          gold_content_percent: number | null
          gold_content_ppm: number | null
          id: string
          issuing_laboratory: string | null
          mime_type: string | null
          palladium_content_ppm: number | null
          parsed_at: string | null
          parsing_error: string | null
          parsing_status: string | null
          platinum_content_ppm: number | null
          purity_percent: number | null
          sample_id: string | null
          sample_weight_grams: number | null
          shipping_preparation_id: string
          silver_content_gpt: number | null
          silver_content_percent: number | null
          silver_content_ppm: number | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          certificate_date?: string | null
          certificate_number?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          fineness?: number | null
          gold_content_gpt?: number | null
          gold_content_percent?: number | null
          gold_content_ppm?: number | null
          id?: string
          issuing_laboratory?: string | null
          mime_type?: string | null
          palladium_content_ppm?: number | null
          parsed_at?: string | null
          parsing_error?: string | null
          parsing_status?: string | null
          platinum_content_ppm?: number | null
          purity_percent?: number | null
          sample_id?: string | null
          sample_weight_grams?: number | null
          shipping_preparation_id: string
          silver_content_gpt?: number | null
          silver_content_percent?: number | null
          silver_content_ppm?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          certificate_date?: string | null
          certificate_number?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          fineness?: number | null
          gold_content_gpt?: number | null
          gold_content_percent?: number | null
          gold_content_ppm?: number | null
          id?: string
          issuing_laboratory?: string | null
          mime_type?: string | null
          palladium_content_ppm?: number | null
          parsed_at?: string | null
          parsing_error?: string | null
          parsing_status?: string | null
          platinum_content_ppm?: number | null
          purity_percent?: number | null
          sample_id?: string | null
          sample_weight_grams?: number | null
          shipping_preparation_id?: string
          silver_content_gpt?: number | null
          silver_content_percent?: number | null
          silver_content_ppm?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assay_certificates_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assay_certificates_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assay_certificates_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assay_certificates_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      assay_deleterious_elements: {
        Row: {
          antimony_ppm: number | null
          arsenic_ppm: number | null
          bismuth_ppm: number | null
          cadmium_ppm: number | null
          certificate_id: string | null
          created_at: string | null
          id: string
          lead_ppm: number | null
          mercury_ppm: number | null
          notes: string | null
          phosphorus_ppm: number | null
          selenium_ppm: number | null
          sulfur_ppm: number | null
          tellurium_ppm: number | null
          updated_at: string | null
        }
        Insert: {
          antimony_ppm?: number | null
          arsenic_ppm?: number | null
          bismuth_ppm?: number | null
          cadmium_ppm?: number | null
          certificate_id?: string | null
          created_at?: string | null
          id?: string
          lead_ppm?: number | null
          mercury_ppm?: number | null
          notes?: string | null
          phosphorus_ppm?: number | null
          selenium_ppm?: number | null
          sulfur_ppm?: number | null
          tellurium_ppm?: number | null
          updated_at?: string | null
        }
        Update: {
          antimony_ppm?: number | null
          arsenic_ppm?: number | null
          bismuth_ppm?: number | null
          cadmium_ppm?: number | null
          certificate_id?: string | null
          created_at?: string | null
          id?: string
          lead_ppm?: number | null
          mercury_ppm?: number | null
          notes?: string | null
          phosphorus_ppm?: number | null
          selenium_ppm?: number | null
          sulfur_ppm?: number | null
          tellurium_ppm?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assay_deleterious_elements_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_deleterious_elements_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates_with_shipping"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: string
          id: string
          ip_address: string | null
          module: string
          status: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details: string
          id?: string
          ip_address?: string | null
          module: string
          status?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string
          id?: string
          ip_address?: string | null
          module?: string
          status?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_trail: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          record_id: string
          table_name: string
          user_email: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id: string
          table_name: string
          user_email?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string
          table_name?: string
          user_email?: string | null
        }
        Relationships: []
      }
      business_rules: {
        Row: {
          description: string | null
          id: string
          rule_category: string
          rule_key: string
          rule_name: string
          rule_value: number
          unit: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          rule_category: string
          rule_key: string
          rule_name: string
          rule_value: number
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          rule_category?: string
          rule_key?: string
          rule_name?: string
          rule_value?: number
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_approvals: {
        Row: {
          action: string
          certificate_data_id: string | null
          certificate_id: string
          changes_made: Json | null
          created_at: string | null
          id: string
          review_notes: string | null
          reviewed_by: string
        }
        Insert: {
          action: string
          certificate_data_id?: string | null
          certificate_id: string
          changes_made?: Json | null
          created_at?: string | null
          id?: string
          review_notes?: string | null
          reviewed_by: string
        }
        Update: {
          action?: string
          certificate_data_id?: string | null
          certificate_id?: string
          changes_made?: Json | null
          created_at?: string | null
          id?: string
          review_notes?: string | null
          reviewed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_approvals_certificate_data_id_fkey"
            columns: ["certificate_data_id"]
            isOneToOne: false
            referencedRelation: "assay_certificate_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_approvals_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_approvals_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates_with_shipping"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_approvals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          commission_percentage: number | null
          created_at: string | null
          created_by: string | null
          customer_tier: string | null
          fixed_amount: number | null
          id: string
          is_active: boolean | null
          max_quantity_oz: number | null
          max_value_usd: number | null
          metal_type: string | null
          min_quantity_oz: number | null
          min_value_usd: number | null
          priority: number | null
          rule_name: string
          rule_type: string
          tier_config: Json | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          commission_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_tier?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          max_quantity_oz?: number | null
          max_value_usd?: number | null
          metal_type?: string | null
          min_quantity_oz?: number | null
          min_value_usd?: number | null
          priority?: number | null
          rule_name: string
          rule_type: string
          tier_config?: Json | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          commission_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_tier?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          max_quantity_oz?: number | null
          max_value_usd?: number | null
          metal_type?: string | null
          min_quantity_oz?: number | null
          min_value_usd?: number | null
          priority?: number | null
          rule_name?: string
          rule_type?: string
          tier_config?: Json | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      customer_accounts_receivable: {
        Row: {
          amount: number
          cleared_at: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          description: string
          id: string
          new_balance: number
          pre_sale_id: string | null
          previous_balance: number | null
          reference_number: string | null
          sale_id: string | null
          status: string | null
          transaction_date: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          cleared_at?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id: string
          description: string
          id?: string
          new_balance: number
          pre_sale_id?: string | null
          previous_balance?: number | null
          reference_number?: string | null
          sale_id?: string | null
          status?: string | null
          transaction_date?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          cleared_at?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string
          description?: string
          id?: string
          new_balance?: number
          pre_sale_id?: string | null
          previous_balance?: number | null
          reference_number?: string | null
          sale_id?: string | null
          status?: string | null
          transaction_date?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_receivable_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_receivable_pre_sale_id_fkey"
            columns: ["pre_sale_id"]
            isOneToOne: false
            referencedRelation: "pre_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_receivable_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_receivable_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      customer_banks: {
        Row: {
          account_number: string | null
          bank_name: string
          city: string
          country: string
          created_at: string | null
          currency: string
          customer_id: string
          iban: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          swift_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          bank_name: string
          city: string
          country: string
          created_at?: string | null
          currency?: string
          customer_id: string
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          bank_name?: string
          city?: string
          country?: string
          created_at?: string | null
          currency?: string
          customer_id?: string
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_banks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contracts: {
        Row: {
          annual_volume_commitment_oz: number | null
          auto_renew: boolean | null
          base_price_adjustment: number | null
          contract_number: string
          contract_terms: string | null
          contract_type: string
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          customer_id: string
          discount_percentage: number | null
          document_url: string | null
          id: string
          maximum_order_oz: number | null
          minimum_order_oz: number | null
          payment_terms: string
          pricing_model: string
          priority_level: number | null
          renewal_notice_days: number | null
          signed_by_company: string | null
          signed_by_customer: string | null
          signed_date: string | null
          special_conditions: string | null
          status: string | null
          updated_at: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          annual_volume_commitment_oz?: number | null
          auto_renew?: boolean | null
          base_price_adjustment?: number | null
          contract_number: string
          contract_terms?: string | null
          contract_type: string
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          customer_id: string
          discount_percentage?: number | null
          document_url?: string | null
          id?: string
          maximum_order_oz?: number | null
          minimum_order_oz?: number | null
          payment_terms: string
          pricing_model: string
          priority_level?: number | null
          renewal_notice_days?: number | null
          signed_by_company?: string | null
          signed_by_customer?: string | null
          signed_date?: string | null
          special_conditions?: string | null
          status?: string | null
          updated_at?: string | null
          valid_from: string
          valid_until: string
        }
        Update: {
          annual_volume_commitment_oz?: number | null
          auto_renew?: boolean | null
          base_price_adjustment?: number | null
          contract_number?: string
          contract_terms?: string | null
          contract_type?: string
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          customer_id?: string
          discount_percentage?: number | null
          document_url?: string | null
          id?: string
          maximum_order_oz?: number | null
          minimum_order_oz?: number | null
          payment_terms?: string
          pricing_model?: string
          priority_level?: number | null
          renewal_notice_days?: number | null
          signed_by_company?: string | null
          signed_by_customer?: string | null
          signed_date?: string | null
          special_conditions?: string | null
          status?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_fx_rates: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          currency_pair: string
          customer_id: string | null
          id: string
          market_rate: number | null
          notes: string | null
          rate_paid: number
          reference_number: string | null
          spread_percentage: number | null
          transaction_date: string
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          currency_pair: string
          customer_id?: string | null
          id?: string
          market_rate?: number | null
          notes?: string | null
          rate_paid: number
          reference_number?: string | null
          spread_percentage?: number | null
          transaction_date: string
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          currency_pair?: string
          customer_id?: string | null
          id?: string
          market_rate?: number | null
          notes?: string | null
          rate_paid?: number
          reference_number?: string | null
          spread_percentage?: number | null
          transaction_date?: string
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_fx_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_fx_rates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company: string | null
          contact_person: string | null
          country: string
          created_at: string | null
          credit_limit: number | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          payment_terms: string | null
          phone: string | null
          status: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          contact_person?: string | null
          country: string
          created_at?: string | null
          credit_limit?: number | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string | null
          credit_limit?: number | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_production: {
        Row: {
          bar_reference: string | null
          bullion_grams: number
          created_at: string | null
          created_by: string | null
          estimated_fineness_pct: number
          estimated_gold_pct: number | null
          estimated_oz: number | null
          estimated_silver_pct: number | null
          id: string
          mining_company_id: string | null
          notes: string | null
          production_date: string
          pure_gold_grams: number | null
          silver_content_grams: number | null
          site_id: string | null
          status: Database["public"]["Enums"]["production_status_v2"]
          status_old_backup: Database["public"]["Enums"]["production_status"]
          updated_at: string | null
        }
        Insert: {
          bar_reference?: string | null
          bullion_grams: number
          created_at?: string | null
          created_by?: string | null
          estimated_fineness_pct: number
          estimated_gold_pct?: number | null
          estimated_oz?: number | null
          estimated_silver_pct?: number | null
          id?: string
          mining_company_id?: string | null
          notes?: string | null
          production_date: string
          pure_gold_grams?: number | null
          silver_content_grams?: number | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["production_status_v2"]
          status_old_backup?: Database["public"]["Enums"]["production_status"]
          updated_at?: string | null
        }
        Update: {
          bar_reference?: string | null
          bullion_grams?: number
          created_at?: string | null
          created_by?: string | null
          estimated_fineness_pct?: number
          estimated_gold_pct?: number | null
          estimated_oz?: number | null
          estimated_silver_pct?: number | null
          id?: string
          mining_company_id?: string | null
          notes?: string | null
          production_date?: string
          pure_gold_grams?: number | null
          silver_content_grams?: number | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["production_status_v2"]
          status_old_backup?: Database["public"]["Enums"]["production_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_production_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      depositors: {
        Row: {
          category: Database["public"]["Enums"]["depositor_category"]
          cellphone: string | null
          created_at: string | null
          email: string
          full_name: string
          group_email: string | null
          id: string
          is_active: boolean | null
          is_backup: boolean | null
          is_primary: boolean | null
          job_title: string
          mining_company_id: string
          notes: string | null
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["depositor_category"]
          cellphone?: string | null
          created_at?: string | null
          email: string
          full_name: string
          group_email?: string | null
          id?: string
          is_active?: boolean | null
          is_backup?: boolean | null
          is_primary?: boolean | null
          job_title: string
          mining_company_id: string
          notes?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["depositor_category"]
          cellphone?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          group_email?: string | null
          id?: string
          is_active?: boolean | null
          is_backup?: boolean | null
          is_primary?: boolean | null
          job_title?: string
          mining_company_id?: string
          notes?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "depositors_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          clicked_at: string | null
          email_type: string
          id: string
          opened_at: string | null
          recipient: string
          sale_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
        }
        Insert: {
          clicked_at?: string | null
          email_type: string
          id?: string
          opened_at?: string | null
          recipient: string
          sale_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          clicked_at?: string | null
          email_type?: string
          id?: string
          opened_at?: string | null
          recipient?: string
          sale_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      expedition_lot_counters: {
        Row: {
          counter: number
          created_at: string | null
          id: string
          mining_company_id: string
          updated_at: string | null
          year: number
        }
        Insert: {
          counter?: number
          created_at?: string | null
          id?: string
          mining_company_id: string
          updated_at?: string | null
          year: number
        }
        Update: {
          counter?: number
          created_at?: string | null
          id?: string
          mining_company_id?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "expedition_lot_counters_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      export_license_documents: {
        Row: {
          description: string | null
          document_name: string
          document_type: string | null
          file_path: string | null
          file_size_kb: number | null
          file_url: string | null
          id: string
          license_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          description?: string | null
          document_name: string
          document_type?: string | null
          file_path?: string | null
          file_size_kb?: number | null
          file_url?: string | null
          id?: string
          license_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          description?: string | null
          document_name?: string
          document_type?: string | null
          file_path?: string | null
          file_size_kb?: number | null
          file_url?: string | null
          id?: string
          license_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_license_documents_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      export_licenses: {
        Row: {
          authorized_quantity_grams: number
          average_sale_price: number | null
          comments: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          issuing_institution: string
          license_number: string
          mining_company_id: string
          notes: string | null
          quota_baseline_used_grams: number
          remaining_quantity_grams: number
          request_date: string
          start_date: string
          status: string | null
          updated_at: string
          updated_by: string | null
          used_quantity_grams: number
        }
        Insert: {
          authorized_quantity_grams: number
          average_sale_price?: number | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          issuing_institution: string
          license_number: string
          mining_company_id: string
          notes?: string | null
          quota_baseline_used_grams?: number
          remaining_quantity_grams: number
          request_date: string
          start_date: string
          status?: string | null
          updated_at?: string
          updated_by?: string | null
          used_quantity_grams?: number
        }
        Update: {
          authorized_quantity_grams?: number
          average_sale_price?: number | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          issuing_institution?: string
          license_number?: string
          mining_company_id?: string
          notes?: string | null
          quota_baseline_used_grams?: number
          remaining_quantity_grams?: number
          request_date?: string
          start_date?: string
          status?: string | null
          updated_at?: string
          updated_by?: string | null
          used_quantity_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "export_licenses_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      forward_rates: {
        Row: {
          adjustment_rate_percentage: number
          created_at: string | null
          currency_pair: string
          forward_days: number
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          market_conditions: string | null
          rate_date: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          adjustment_rate_percentage: number
          created_at?: string | null
          currency_pair?: string
          forward_days: number
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          market_conditions?: string | null
          rate_date: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          adjustment_rate_percentage?: number
          created_at?: string | null
          currency_pair?: string
          forward_days?: number
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          market_conditions?: string | null
          rate_date?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      freight_customs_documents: {
        Row: {
          description: string | null
          document_type: Database["public"]["Enums"]["freight_document_type"]
          file_name: string | null
          file_path: string | null
          file_size: number | null
          freight_customs_operation_id: string
          id: string
          mime_type: string | null
          title: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          description?: string | null
          document_type: Database["public"]["Enums"]["freight_document_type"]
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          freight_customs_operation_id: string
          id?: string
          mime_type?: string | null
          title: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          description?: string | null
          document_type?: Database["public"]["Enums"]["freight_document_type"]
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          freight_customs_operation_id?: string
          id?: string
          mime_type?: string | null
          title?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_freight_operation"
            columns: ["freight_customs_operation_id"]
            isOneToOne: false
            referencedRelation: "freight_customs_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_customs_documents_freight_customs_operation_id_fkey"
            columns: ["freight_customs_operation_id"]
            isOneToOne: false
            referencedRelation: "freight_customs_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_customs_invoice_data: {
        Row: {
          box_type: string | null
          country_of_origin: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          exchange_rate_fcfa_usd: number | null
          freight_customs_operation_id: string
          id: string
          metal_price_cfa_per_kg: number | null
          mine_location: string | null
          mine_name: string | null
          number_of_boxes: number | null
          recipient_address: string | null
          recipient_city: string | null
          recipient_country: string | null
          recipient_name: string | null
          recipient_phone: string | null
          sender_address: string | null
          sender_city: string | null
          sender_country: string | null
          sender_name: string | null
          sender_nif: string | null
          total_value_cfa: number | null
          total_value_usd: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          box_type?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exchange_rate_fcfa_usd?: number | null
          freight_customs_operation_id: string
          id?: string
          metal_price_cfa_per_kg?: number | null
          mine_location?: string | null
          mine_name?: string | null
          number_of_boxes?: number | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_country?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sender_address?: string | null
          sender_city?: string | null
          sender_country?: string | null
          sender_name?: string | null
          sender_nif?: string | null
          total_value_cfa?: number | null
          total_value_usd?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          box_type?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exchange_rate_fcfa_usd?: number | null
          freight_customs_operation_id?: string
          id?: string
          metal_price_cfa_per_kg?: number | null
          mine_location?: string | null
          mine_name?: string | null
          number_of_boxes?: number | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_country?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sender_address?: string | null
          sender_city?: string | null
          sender_country?: string | null
          sender_name?: string | null
          sender_nif?: string | null
          total_value_cfa?: number | null
          total_value_usd?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_freight_operation_invoice"
            columns: ["freight_customs_operation_id"]
            isOneToOne: true
            referencedRelation: "freight_customs_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_customs_invoice_data_freight_customs_operation_id_fkey"
            columns: ["freight_customs_operation_id"]
            isOneToOne: true
            referencedRelation: "freight_customs_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_customs_operations: {
        Row: {
          actual_arrival_date: string | null
          actual_departure_date: string | null
          awb_number: string | null
          created_at: string | null
          created_by: string | null
          customs_approval_date: string | null
          customs_approved_by: string | null
          customs_office: string | null
          customs_officer_name: string | null
          customs_reference_number: string | null
          dispatched_by: string | null
          estimated_arrival_date: string | null
          estimated_departure_date: string | null
          freight_forwarder_contact: string | null
          id: string
          mining_company_id: string
          notes: string | null
          prepared_by: string | null
          reference_number: string
          shipping_preparation_id: string
          status: Database["public"]["Enums"]["freight_customs_status"]
          status_changed_at: string | null
          tracking_number: string | null
          transport_company_id: string | null
          transport_prepared_by: string | null
          updated_at: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          actual_departure_date?: string | null
          awb_number?: string | null
          created_at?: string | null
          created_by?: string | null
          customs_approval_date?: string | null
          customs_approved_by?: string | null
          customs_office?: string | null
          customs_officer_name?: string | null
          customs_reference_number?: string | null
          dispatched_by?: string | null
          estimated_arrival_date?: string | null
          estimated_departure_date?: string | null
          freight_forwarder_contact?: string | null
          id?: string
          mining_company_id: string
          notes?: string | null
          prepared_by?: string | null
          reference_number: string
          shipping_preparation_id: string
          status?: Database["public"]["Enums"]["freight_customs_status"]
          status_changed_at?: string | null
          tracking_number?: string | null
          transport_company_id?: string | null
          transport_prepared_by?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          actual_departure_date?: string | null
          awb_number?: string | null
          created_at?: string | null
          created_by?: string | null
          customs_approval_date?: string | null
          customs_approved_by?: string | null
          customs_office?: string | null
          customs_officer_name?: string | null
          customs_reference_number?: string | null
          dispatched_by?: string | null
          estimated_arrival_date?: string | null
          estimated_departure_date?: string | null
          freight_forwarder_contact?: string | null
          id?: string
          mining_company_id?: string
          notes?: string | null
          prepared_by?: string | null
          reference_number?: string
          shipping_preparation_id?: string
          status?: Database["public"]["Enums"]["freight_customs_status"]
          status_changed_at?: string | null
          tracking_number?: string | null
          transport_company_id?: string | null
          transport_prepared_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_customs_operations_mining_company_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_customs_operations_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_customs_operations_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_customs_operations_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_customs_operations_transport_company_id_fkey"
            columns: ["transport_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_shipment_productions: {
        Row: {
          added_at: string | null
          added_by: string | null
          bar_reference: string | null
          bullion_grams: number | null
          estimated_fineness_pct: number | null
          estimated_silver_pct: number | null
          freight_shipment_id: string
          id: string
          production_date: string | null
          production_id: string
          pure_gold_grams: number | null
          pure_gold_oz: number | null
          silver_content_grams: number | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          bar_reference?: string | null
          bullion_grams?: number | null
          estimated_fineness_pct?: number | null
          estimated_silver_pct?: number | null
          freight_shipment_id: string
          id?: string
          production_date?: string | null
          production_id: string
          pure_gold_grams?: number | null
          pure_gold_oz?: number | null
          silver_content_grams?: number | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          bar_reference?: string | null
          bullion_grams?: number | null
          estimated_fineness_pct?: number | null
          estimated_silver_pct?: number | null
          freight_shipment_id?: string
          id?: string
          production_date?: string | null
          production_id?: string
          pure_gold_grams?: number | null
          pure_gold_oz?: number | null
          silver_content_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_shipment_productions_freight_shipment_id_fkey"
            columns: ["freight_shipment_id"]
            isOneToOne: false
            referencedRelation: "freight_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_shipment_productions_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: true
            referencedRelation: "daily_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_shipment_productions_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: true
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_shipment_signatories: {
        Row: {
          created_at: string | null
          display_order: number
          freight_shipment_id: string
          full_name: string
          id: string
          position: string
          signature_data: string | null
          signed_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          freight_shipment_id: string
          full_name: string
          id?: string
          position: string
          signature_data?: string | null
          signed_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          freight_shipment_id?: string
          full_name?: string
          id?: string
          position?: string
          signature_data?: string | null
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_shipment_signatories_freight_shipment_id_fkey"
            columns: ["freight_shipment_id"]
            isOneToOne: false
            referencedRelation: "freight_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_shipments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          box_type: string | null
          bullion_summary_pdf_path: string | null
          consignment_note_pdf_path: string | null
          created_at: string | null
          created_by: string | null
          customs_invoice_pdf_path: string | null
          deleted_at: string | null
          destination_refinery_id: string | null
          exchange_rate: number
          expedition_number: string | null
          gold_price_usd_per_oz: number
          id: string
          local_currency: string
          mining_company_id: string | null
          notes: string | null
          number_of_boxes: number
          packing_list_pdf_path: string | null
          processed_at: string | null
          processed_by: string | null
          processing_started_at: string | null
          processing_started_by: string | null
          production_count: number | null
          received_at: string | null
          received_by: string | null
          reference_number: string
          refining_notes: string | null
          shipment_date: string
          shipped_at: string | null
          shipped_by: string | null
          shipping_preparation_id: string | null
          status: Database["public"]["Enums"]["freight_shipment_status"]
          stocked_at: string | null
          stocked_by: string | null
          total_bullion_grams: number | null
          total_pure_gold_grams: number | null
          total_pure_gold_oz: number | null
          total_pure_silver_grams: number | null
          total_value_local: number | null
          total_value_usd: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          box_type?: string | null
          bullion_summary_pdf_path?: string | null
          consignment_note_pdf_path?: string | null
          created_at?: string | null
          created_by?: string | null
          customs_invoice_pdf_path?: string | null
          deleted_at?: string | null
          destination_refinery_id?: string | null
          exchange_rate: number
          expedition_number?: string | null
          gold_price_usd_per_oz: number
          id?: string
          local_currency?: string
          mining_company_id?: string | null
          notes?: string | null
          number_of_boxes?: number
          packing_list_pdf_path?: string | null
          processed_at?: string | null
          processed_by?: string | null
          processing_started_at?: string | null
          processing_started_by?: string | null
          production_count?: number | null
          received_at?: string | null
          received_by?: string | null
          reference_number: string
          refining_notes?: string | null
          shipment_date?: string
          shipped_at?: string | null
          shipped_by?: string | null
          shipping_preparation_id?: string | null
          status?: Database["public"]["Enums"]["freight_shipment_status"]
          stocked_at?: string | null
          stocked_by?: string | null
          total_bullion_grams?: number | null
          total_pure_gold_grams?: number | null
          total_pure_gold_oz?: number | null
          total_pure_silver_grams?: number | null
          total_value_local?: number | null
          total_value_usd?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          box_type?: string | null
          bullion_summary_pdf_path?: string | null
          consignment_note_pdf_path?: string | null
          created_at?: string | null
          created_by?: string | null
          customs_invoice_pdf_path?: string | null
          deleted_at?: string | null
          destination_refinery_id?: string | null
          exchange_rate?: number
          expedition_number?: string | null
          gold_price_usd_per_oz?: number
          id?: string
          local_currency?: string
          mining_company_id?: string | null
          notes?: string | null
          number_of_boxes?: number
          packing_list_pdf_path?: string | null
          processed_at?: string | null
          processed_by?: string | null
          processing_started_at?: string | null
          processing_started_by?: string | null
          production_count?: number | null
          received_at?: string | null
          received_by?: string | null
          reference_number?: string
          refining_notes?: string | null
          shipment_date?: string
          shipped_at?: string | null
          shipped_by?: string | null
          shipping_preparation_id?: string | null
          status?: Database["public"]["Enums"]["freight_shipment_status"]
          stocked_at?: string | null
          stocked_by?: string | null
          total_bullion_grams?: number | null
          total_pure_gold_grams?: number | null
          total_pure_gold_oz?: number | null
          total_pure_silver_grams?: number | null
          total_value_local?: number | null
          total_value_usd?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_shipments_destination_refinery_id_fkey"
            columns: ["destination_refinery_id"]
            isOneToOne: false
            referencedRelation: "refineries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_shipments_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_shipments_shipping_company_fkey"
            columns: ["shipping_preparation_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id", "mining_company_id"]
          },
          {
            foreignKeyName: "freight_shipments_shipping_company_fkey"
            columns: ["shipping_preparation_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id", "mining_company_id"]
          },
          {
            foreignKeyName: "freight_shipments_shipping_company_fkey"
            columns: ["shipping_preparation_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id", "mining_company_id"]
          },
        ]
      }
      fx_rate_analysis: {
        Row: {
          amount_paid: number
          amount_with_best_rate: number
          amount_with_customer_rate: number
          analysis_date: string
          base_currency: string
          bceao_rate: number | null
          best_rate: number
          best_rate_source: string
          created_at: string | null
          created_by: string | null
          currency_pair: string
          customer_rate: number
          ecb_rate: number | null
          gain_loss_amount: number
          gain_loss_percentage: number
          id: string
          market_spread: number | null
          notes: string | null
          other_rate: number | null
          other_rate_source: string | null
          payment_currency: string
          payment_id: string
          revolut_rate: number | null
          updated_at: string | null
          virtual_payment_amount: number | null
          virtual_payment_currency: string | null
          worst_rate: number | null
          worst_rate_source: string | null
        }
        Insert: {
          amount_paid: number
          amount_with_best_rate?: number
          amount_with_customer_rate?: number
          analysis_date?: string
          base_currency?: string
          bceao_rate?: number | null
          best_rate: number
          best_rate_source: string
          created_at?: string | null
          created_by?: string | null
          currency_pair: string
          customer_rate: number
          ecb_rate?: number | null
          gain_loss_amount: number
          gain_loss_percentage: number
          id?: string
          market_spread?: number | null
          notes?: string | null
          other_rate?: number | null
          other_rate_source?: string | null
          payment_currency: string
          payment_id: string
          revolut_rate?: number | null
          updated_at?: string | null
          virtual_payment_amount?: number | null
          virtual_payment_currency?: string | null
          worst_rate?: number | null
          worst_rate_source?: string | null
        }
        Update: {
          amount_paid?: number
          amount_with_best_rate?: number
          amount_with_customer_rate?: number
          analysis_date?: string
          base_currency?: string
          bceao_rate?: number | null
          best_rate?: number
          best_rate_source?: string
          created_at?: string | null
          created_by?: string | null
          currency_pair?: string
          customer_rate?: number
          ecb_rate?: number | null
          gain_loss_amount?: number
          gain_loss_percentage?: number
          id?: string
          market_spread?: number | null
          notes?: string | null
          other_rate?: number | null
          other_rate_source?: string | null
          payment_currency?: string
          payment_id?: string
          revolut_rate?: number | null
          updated_at?: string | null
          virtual_payment_amount?: number | null
          virtual_payment_currency?: string | null
          worst_rate?: number | null
          worst_rate_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_rate_analysis_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rate_sources: {
        Row: {
          api_url: string | null
          code: string
          country: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          api_url?: string | null
          code: string
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          api_url?: string | null
          code?: string
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fx_rates_daily: {
        Row: {
          ask_rate: number | null
          bid_rate: number | null
          created_at: string | null
          currency_pair: string
          id: string
          notes: string | null
          rate: number
          rate_date: string
          source_id: string | null
          spread: number | null
          updated_at: string | null
          volume: number | null
        }
        Insert: {
          ask_rate?: number | null
          bid_rate?: number | null
          created_at?: string | null
          currency_pair: string
          id?: string
          notes?: string | null
          rate: number
          rate_date: string
          source_id?: string | null
          spread?: number | null
          updated_at?: string | null
          volume?: number | null
        }
        Update: {
          ask_rate?: number | null
          bid_rate?: number | null
          created_at?: string | null
          currency_pair?: string
          id?: string
          notes?: string | null
          rate?: number
          rate_date?: string
          source_id?: string | null
          spread?: number | null
          updated_at?: string | null
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_daily_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "fx_rate_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates_monthly_aggregated: {
        Row: {
          avg_rate: number
          closing_rate: number | null
          created_at: string | null
          currency_pair: string
          data_points: number | null
          id: string
          max_rate: number
          min_rate: number
          month: number
          opening_rate: number | null
          source_id: string | null
          total_volume: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          avg_rate: number
          closing_rate?: number | null
          created_at?: string | null
          currency_pair: string
          data_points?: number | null
          id?: string
          max_rate: number
          min_rate: number
          month: number
          opening_rate?: number | null
          source_id?: string | null
          total_volume?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          avg_rate?: number
          closing_rate?: number | null
          created_at?: string | null
          currency_pair?: string
          data_points?: number | null
          id?: string
          max_rate?: number
          min_rate?: number
          month?: number
          opening_rate?: number | null
          source_id?: string | null
          total_volume?: number | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_monthly_aggregated_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "fx_rate_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_inventory: {
        Row: {
          certificate_number: string | null
          created_at: string | null
          created_by: string
          entry_date: string
          final_fine_grams: number
          final_fine_oz: number
          fineness_percentage: number
          freight_shipment_id: string | null
          id: string
          metal_retained_percentage: number
          mining_company_id: string | null
          notes: string | null
          processing_location: string | null
          quantity_allocated_oz: number | null
          quantity_available_oz: number
          quantity_sold_oz: number | null
          refinery_id: string | null
          refining_record_id: string | null
          sale_id: string | null
          silver_percentage: number | null
          transaction_type: string
          updated_at: string | null
          variance_with_export_invoice_oz: number | null
          weight_after_melting_grams: number
          weight_before_melting_grams: number
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string | null
          created_by: string
          entry_date?: string
          final_fine_grams: number
          final_fine_oz: number
          fineness_percentage: number
          freight_shipment_id?: string | null
          id?: string
          metal_retained_percentage: number
          mining_company_id?: string | null
          notes?: string | null
          processing_location?: string | null
          quantity_allocated_oz?: number | null
          quantity_available_oz: number
          quantity_sold_oz?: number | null
          refinery_id?: string | null
          refining_record_id?: string | null
          sale_id?: string | null
          silver_percentage?: number | null
          transaction_type: string
          updated_at?: string | null
          variance_with_export_invoice_oz?: number | null
          weight_after_melting_grams: number
          weight_before_melting_grams: number
        }
        Update: {
          certificate_number?: string | null
          created_at?: string | null
          created_by?: string
          entry_date?: string
          final_fine_grams?: number
          final_fine_oz?: number
          fineness_percentage?: number
          freight_shipment_id?: string | null
          id?: string
          metal_retained_percentage?: number
          mining_company_id?: string | null
          notes?: string | null
          processing_location?: string | null
          quantity_allocated_oz?: number | null
          quantity_available_oz?: number
          quantity_sold_oz?: number | null
          refinery_id?: string | null
          refining_record_id?: string | null
          sale_id?: string | null
          silver_percentage?: number | null
          transaction_type?: string
          updated_at?: string | null
          variance_with_export_invoice_oz?: number | null
          weight_after_melting_grams?: number
          weight_before_melting_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "gold_inventory_freight_shipment_id_fkey"
            columns: ["freight_shipment_id"]
            isOneToOne: false
            referencedRelation: "freight_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_inventory_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_inventory_refinery_id_fkey"
            columns: ["refinery_id"]
            isOneToOne: false
            referencedRelation: "refineries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_inventory_refining_record_id_fkey"
            columns: ["refining_record_id"]
            isOneToOne: false
            referencedRelation: "refining_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_inventory_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_inventory_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      gold_prices_daily: {
        Row: {
          average_price: number | null
          created_at: string | null
          currency: string | null
          high_price: number | null
          id: string
          london_am_rate: number
          london_pm_rate: number | null
          low_price: number | null
          notes: string | null
          price_date: string
          source: string | null
          spot_price: number | null
          updated_at: string | null
        }
        Insert: {
          average_price?: number | null
          created_at?: string | null
          currency?: string | null
          high_price?: number | null
          id?: string
          london_am_rate: number
          london_pm_rate?: number | null
          low_price?: number | null
          notes?: string | null
          price_date: string
          source?: string | null
          spot_price?: number | null
          updated_at?: string | null
        }
        Update: {
          average_price?: number | null
          created_at?: string | null
          currency?: string | null
          high_price?: number | null
          id?: string
          london_am_rate?: number
          london_pm_rate?: number | null
          low_price?: number | null
          notes?: string | null
          price_date?: string
          source?: string | null
          spot_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gold_prices_monthly: {
        Row: {
          average_price: number
          closing_price: number | null
          created_at: string | null
          high_price: number
          id: string
          low_price: number
          month: number
          opening_price: number | null
          total_days: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          average_price: number
          closing_price?: number | null
          created_at?: string | null
          high_price: number
          id?: string
          low_price: number
          month: number
          opening_price?: number | null
          total_days?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          average_price?: number
          closing_price?: number | null
          created_at?: string | null
          high_price?: number
          id?: string
          low_price?: number
          month?: number
          opening_price?: number | null
          total_days?: number | null
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      gold_sales_settings: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          effective_date: string
          id: string
          is_active: boolean
          max_stock_percentage: number
          mining_company_id: string
          notes: string | null
          refining_fees_paid_by_customer: boolean
          sale_method: string
          transport_fees_paid_by_customer: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          effective_date?: string
          id?: string
          is_active?: boolean
          max_stock_percentage?: number
          mining_company_id: string
          notes?: string | null
          refining_fees_paid_by_customer?: boolean
          sale_method?: string
          transport_fees_paid_by_customer?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          max_stock_percentage?: number
          mining_company_id?: string
          notes?: string | null
          refining_fees_paid_by_customer?: boolean
          sale_method?: string
          transport_fees_paid_by_customer?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gold_sales_settings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_sales_settings_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          balance_after_oz: number
          balance_before_oz: number
          created_at: string | null
          created_by: string
          freight_shipment_id: string | null
          id: string
          inventory_id: string
          notes: string | null
          quantity_grams: number | null
          quantity_oz: number
          sale_id: string | null
          transaction_date: string | null
          transaction_reference: string | null
          transaction_type: string
        }
        Insert: {
          balance_after_oz: number
          balance_before_oz: number
          created_at?: string | null
          created_by: string
          freight_shipment_id?: string | null
          id?: string
          inventory_id: string
          notes?: string | null
          quantity_grams?: number | null
          quantity_oz: number
          sale_id?: string | null
          transaction_date?: string | null
          transaction_reference?: string | null
          transaction_type: string
        }
        Update: {
          balance_after_oz?: number
          balance_before_oz?: number
          created_at?: string | null
          created_by?: string
          freight_shipment_id?: string | null
          id?: string
          inventory_id?: string
          notes?: string | null
          quantity_grams?: number | null
          quantity_oz?: number
          sale_id?: string | null
          transaction_date?: string | null
          transaction_reference?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_freight_shipment_id_fkey"
            columns: ["freight_shipment_id"]
            isOneToOne: false
            referencedRelation: "freight_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "gold_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      mining_companies: {
        Row: {
          abbreviation: string | null
          address: string | null
          city: string | null
          code: string
          company_type: Database["public"]["Enums"]["company_type_enum"]
          contact_person_email: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          country: string
          created_at: string | null
          created_by: string | null
          default_currency: string | null
          id: string
          is_active: boolean | null
          localite: string | null
          name: string
          notes: string | null
          postal_code: string | null
          province: string | null
          region: string | null
          registration_number: string | null
          tax_id: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          abbreviation?: string | null
          address?: string | null
          city?: string | null
          code: string
          company_type?: Database["public"]["Enums"]["company_type_enum"]
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          country: string
          created_at?: string | null
          created_by?: string | null
          default_currency?: string | null
          id?: string
          is_active?: boolean | null
          localite?: string | null
          name: string
          notes?: string | null
          postal_code?: string | null
          province?: string | null
          region?: string | null
          registration_number?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          abbreviation?: string | null
          address?: string | null
          city?: string | null
          code?: string
          company_type?: Database["public"]["Enums"]["company_type_enum"]
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          country?: string
          created_at?: string | null
          created_by?: string | null
          default_currency?: string | null
          id?: string
          is_active?: boolean | null
          localite?: string | null
          name?: string
          notes?: string | null
          postal_code?: string | null
          province?: string | null
          region?: string | null
          registration_number?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mining_companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_company_documents: {
        Row: {
          created_at: string
          doc_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          mining_company_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          mining_company_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          mining_company_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mining_company_documents_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      monthly_budgets: {
        Row: {
          annual_budget_id: string
          budget_oz: number
          created_at: string | null
          daily_budget_oz: number | null
          days_in_month: number
          id: string
          mining_company_id: string | null
          month: number
          updated_at: string | null
        }
        Insert: {
          annual_budget_id: string
          budget_oz?: number
          created_at?: string | null
          daily_budget_oz?: number | null
          days_in_month?: number
          id?: string
          mining_company_id?: string | null
          month: number
          updated_at?: string | null
        }
        Update: {
          annual_budget_id?: string
          budget_oz?: number
          created_at?: string | null
          daily_budget_oz?: number | null
          days_in_month?: number
          id?: string
          mining_company_id?: string | null
          month?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_budgets_annual_budget_id_fkey"
            columns: ["annual_budget_id"]
            isOneToOne: false
            referencedRelation: "annual_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_budgets_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      password_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_documents: {
        Row: {
          document_name: string
          document_type: string
          document_url: string
          file_size: number | null
          id: string
          is_verified: boolean | null
          mime_type: string | null
          notes: string | null
          payment_id: string
          uploaded_at: string | null
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          document_name: string
          document_type: string
          document_url: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          notes?: string | null
          payment_id: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          document_name?: string
          document_type?: string
          document_url?: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          notes?: string | null
          payment_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          change_type: string
          changed_at: string | null
          changed_by: string | null
          field_changes: Json | null
          id: string
          ip_address: string | null
          new_status: string | null
          notes: string | null
          old_status: string | null
          payment_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          changed_by?: string | null
          field_changes?: Json | null
          id?: string
          ip_address?: string | null
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          payment_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          changed_by?: string | null
          field_changes?: Json | null
          id?: string
          ip_address?: string | null
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          created_at: string | null
          delivery_status: string | null
          id: string
          message: string | null
          opened_at: string | null
          payment_id: string
          reminder_type: string
          responded_at: string | null
          response_notes: string | null
          sent_at: string | null
          sent_by: string | null
          sent_to: string
        }
        Insert: {
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          message?: string | null
          opened_at?: string | null
          payment_id: string
          reminder_type: string
          responded_at?: string | null
          response_notes?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_to: string
        }
        Update: {
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          message?: string | null
          opened_at?: string | null
          payment_id?: string
          reminder_type?: string
          responded_at?: string | null
          response_notes?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_number: string | null
          actual_date: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          auto_credited_at: string | null
          bank_name: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          converted_by: string | null
          converted_to_actual_at: string | null
          created_at: string | null
          created_by: string | null
          currency: string
          customer_bank_id: string | null
          customer_id: string | null
          due_date: string | null
          executed_at: string | null
          executed_by: string | null
          execution_reference_key: string | null
          expected_date: string
          fx_analysis_id: string | null
          fx_rate: number | null
          fx_rate_date: string | null
          fx_rate_source: string | null
          id: string
          invoice_number: string | null
          is_virtual: boolean | null
          mechanism_type: string | null
          notes: string | null
          payment_currency: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_type: string | null
          proof_url: string | null
          received_amount: number | null
          receiving_currency: string | null
          reference_number: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          sale_id: string
          seller_bank_id: string | null
          status: string | null
          transaction_id: string | null
          verified_at: string | null
          verified_by: string | null
          version: number
          virtual_due_date: string | null
        }
        Insert: {
          account_number?: string | null
          actual_date?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          auto_credited_at?: string | null
          bank_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          converted_by?: string | null
          converted_to_actual_at?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          customer_bank_id?: string | null
          customer_id?: string | null
          due_date?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_reference_key?: string | null
          expected_date: string
          fx_analysis_id?: string | null
          fx_rate?: number | null
          fx_rate_date?: string | null
          fx_rate_source?: string | null
          id?: string
          invoice_number?: string | null
          is_virtual?: boolean | null
          mechanism_type?: string | null
          notes?: string | null
          payment_currency?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_type?: string | null
          proof_url?: string | null
          received_amount?: number | null
          receiving_currency?: string | null
          reference_number?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          sale_id: string
          seller_bank_id?: string | null
          status?: string | null
          transaction_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          version?: number
          virtual_due_date?: string | null
        }
        Update: {
          account_number?: string | null
          actual_date?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          auto_credited_at?: string | null
          bank_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          converted_by?: string | null
          converted_to_actual_at?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          customer_bank_id?: string | null
          customer_id?: string | null
          due_date?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_reference_key?: string | null
          expected_date?: string
          fx_analysis_id?: string | null
          fx_rate?: number | null
          fx_rate_date?: string | null
          fx_rate_source?: string | null
          id?: string
          invoice_number?: string | null
          is_virtual?: boolean | null
          mechanism_type?: string | null
          notes?: string | null
          payment_currency?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_type?: string | null
          proof_url?: string | null
          received_amount?: number | null
          receiving_currency?: string | null
          reference_number?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          sale_id?: string
          seller_bank_id?: string | null
          status?: string | null
          transaction_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          version?: number
          virtual_due_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_bank_id_fkey"
            columns: ["customer_bank_id"]
            isOneToOne: false
            referencedRelation: "customer_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_fx_analysis_id_fkey"
            columns: ["fx_analysis_id"]
            isOneToOne: false
            referencedRelation: "fx_rate_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
          {
            foreignKeyName: "payments_seller_bank_id_fkey"
            columns: ["seller_bank_id"]
            isOneToOne: false
            referencedRelation: "stakeholder_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_sales: {
        Row: {
          actual_arrival_date: string | null
          converted_at: string | null
          converted_sale_id: string | null
          created_at: string | null
          created_by: string | null
          customer_approved_at: string | null
          customer_approved_by: string | null
          customer_bank_id: string | null
          customer_id: string
          expected_arrival_date: string | null
          final_proceeds: number
          freight_cost: number | null
          fx_rate: number | null
          gross_proceeds: number
          id: string
          is_converted: boolean | null
          is_internal_sale: boolean | null
          london_am_rate: number
          management_approved_at: string | null
          management_approved_by: string | null
          net_proceeds: number
          notes: string | null
          other_costs: number | null
          payment_date: string | null
          payment_type: string | null
          pre_sale_number: string
          quantity_oz: number
          royalty_amount: number
          royalty_rate: number | null
          sale_date: string | null
          seller_id: string | null
          seller_type: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          converted_at?: string | null
          converted_sale_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_approved_at?: string | null
          customer_approved_by?: string | null
          customer_bank_id?: string | null
          customer_id: string
          expected_arrival_date?: string | null
          final_proceeds: number
          freight_cost?: number | null
          fx_rate?: number | null
          gross_proceeds: number
          id?: string
          is_converted?: boolean | null
          is_internal_sale?: boolean | null
          london_am_rate: number
          management_approved_at?: string | null
          management_approved_by?: string | null
          net_proceeds: number
          notes?: string | null
          other_costs?: number | null
          payment_date?: string | null
          payment_type?: string | null
          pre_sale_number: string
          quantity_oz: number
          royalty_amount: number
          royalty_rate?: number | null
          sale_date?: string | null
          seller_id?: string | null
          seller_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          converted_at?: string | null
          converted_sale_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_approved_at?: string | null
          customer_approved_by?: string | null
          customer_bank_id?: string | null
          customer_id?: string
          expected_arrival_date?: string | null
          final_proceeds?: number
          freight_cost?: number | null
          fx_rate?: number | null
          gross_proceeds?: number
          id?: string
          is_converted?: boolean | null
          is_internal_sale?: boolean | null
          london_am_rate?: number
          management_approved_at?: string | null
          management_approved_by?: string | null
          net_proceeds?: number
          notes?: string | null
          other_costs?: number | null
          payment_date?: string | null
          payment_type?: string | null
          pre_sale_number?: string
          quantity_oz?: number
          royalty_amount?: number
          royalty_rate?: number | null
          sale_date?: string | null
          seller_id?: string | null
          seller_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_sales_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_sales_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
          {
            foreignKeyName: "pre_sales_customer_bank_id_fkey"
            columns: ["customer_bank_id"]
            isOneToOne: false
            referencedRelation: "customer_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_sales_inventory_matches: {
        Row: {
          actual_quantity_oz: number
          created_at: string | null
          id: string
          match_status: string | null
          matched_at: string | null
          matched_by: string | null
          pre_sale_id: string
          pre_sale_quantity_oz: number
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_notes: string | null
          sale_id: string | null
          variance_oz: number | null
          variance_percentage: number | null
        }
        Insert: {
          actual_quantity_oz: number
          created_at?: string | null
          id?: string
          match_status?: string | null
          matched_at?: string | null
          matched_by?: string | null
          pre_sale_id: string
          pre_sale_quantity_oz: number
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_notes?: string | null
          sale_id?: string | null
          variance_oz?: number | null
          variance_percentage?: number | null
        }
        Update: {
          actual_quantity_oz?: number
          created_at?: string | null
          id?: string
          match_status?: string | null
          matched_at?: string | null
          matched_by?: string | null
          pre_sale_id?: string
          pre_sale_quantity_oz?: number
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_notes?: string | null
          sale_id?: string | null
          variance_oz?: number | null
          variance_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_sales_inventory_matches_pre_sale_id_fkey"
            columns: ["pre_sale_id"]
            isOneToOne: true
            referencedRelation: "pre_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_sales_inventory_matches_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_sales_inventory_matches_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      pricing_mechanism_comparisons: {
        Row: {
          created_at: string | null
          forward_14d_adjustment: number | null
          forward_14d_benefit: number | null
          forward_14d_total_value: number | null
          forward_30d_adjustment: number | null
          forward_30d_benefit: number | null
          forward_30d_total_value: number | null
          forward_7d_adjustment: number | null
          forward_7d_benefit: number | null
          forward_7d_total_value: number | null
          gold_trend: string | null
          id: string
          in_process_benefit: number | null
          in_process_estimated_value: number | null
          in_process_refinery_id: string | null
          market_volatility: number | null
          quantity_oz: number
          recommendation_reason: string | null
          recommended_mechanism: string | null
          spot_price_per_oz: number
          spot_total_value: number
          spot_value_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          forward_14d_adjustment?: number | null
          forward_14d_benefit?: number | null
          forward_14d_total_value?: number | null
          forward_30d_adjustment?: number | null
          forward_30d_benefit?: number | null
          forward_30d_total_value?: number | null
          forward_7d_adjustment?: number | null
          forward_7d_benefit?: number | null
          forward_7d_total_value?: number | null
          gold_trend?: string | null
          id?: string
          in_process_benefit?: number | null
          in_process_estimated_value?: number | null
          in_process_refinery_id?: string | null
          market_volatility?: number | null
          quantity_oz: number
          recommendation_reason?: string | null
          recommended_mechanism?: string | null
          spot_price_per_oz: number
          spot_total_value: number
          spot_value_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          forward_14d_adjustment?: number | null
          forward_14d_benefit?: number | null
          forward_14d_total_value?: number | null
          forward_30d_adjustment?: number | null
          forward_30d_benefit?: number | null
          forward_30d_total_value?: number | null
          forward_7d_adjustment?: number | null
          forward_7d_benefit?: number | null
          forward_7d_total_value?: number | null
          gold_trend?: string | null
          id?: string
          in_process_benefit?: number | null
          in_process_estimated_value?: number | null
          in_process_refinery_id?: string | null
          market_volatility?: number | null
          quantity_oz?: number
          recommendation_reason?: string | null
          recommended_mechanism?: string | null
          spot_price_per_oz?: number
          spot_total_value?: number
          spot_value_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_mechanism_comparisons_in_process_refinery_id_fkey"
            columns: ["in_process_refinery_id"]
            isOneToOne: false
            referencedRelation: "refineries_approved"
            referencedColumns: ["id"]
          },
        ]
      }
      production_documents: {
        Row: {
          created_at: string | null
          document_name: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          production_id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_name: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          production_id: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_name?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          production_id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_documents_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_documents_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id"]
          },
        ]
      }
      production_forecasts: {
        Row: {
          budget_oz: number | null
          created_at: string | null
          created_by: string | null
          forecast_date: string
          forecast_oz: number | null
          id: string
          mining_company_id: string | null
          notes: string | null
          period_type: string
          site_id: string | null
          updated_at: string | null
        }
        Insert: {
          budget_oz?: number | null
          created_at?: string | null
          created_by?: string | null
          forecast_date: string
          forecast_oz?: number | null
          id?: string
          mining_company_id?: string | null
          notes?: string | null
          period_type: string
          site_id?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_oz?: number | null
          created_at?: string | null
          created_by?: string | null
          forecast_date?: string
          forecast_oz?: number | null
          id?: string
          mining_company_id?: string | null
          notes?: string | null
          period_type?: string
          site_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_forecasts_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          metadata: Json | null
          new_status: Database["public"]["Enums"]["production_status"]
          notes: string | null
          old_status: Database["public"]["Enums"]["production_status"] | null
          production_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          new_status: Database["public"]["Enums"]["production_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["production_status"] | null
          production_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["production_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["production_status"] | null
          production_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_status_history_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_status_history_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_forecasts: {
        Row: {
          annual_budget_id: string
          created_at: string | null
          created_by: string | null
          daily_forecast_oz: number | null
          days_in_month: number
          forecast_oz: number
          id: string
          mining_company_id: string | null
          month: number
          notes: string | null
          quarter: number
          revision_date: string
          updated_at: string | null
        }
        Insert: {
          annual_budget_id: string
          created_at?: string | null
          created_by?: string | null
          daily_forecast_oz?: number | null
          days_in_month?: number
          forecast_oz?: number
          id?: string
          mining_company_id?: string | null
          month: number
          notes?: string | null
          quarter: number
          revision_date: string
          updated_at?: string | null
        }
        Update: {
          annual_budget_id?: string
          created_at?: string | null
          created_by?: string | null
          daily_forecast_oz?: number | null
          days_in_month?: number
          forecast_oz?: number
          id?: string
          mining_company_id?: string | null
          month?: number
          notes?: string | null
          quarter?: number
          revision_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_forecasts_annual_budget_id_fkey"
            columns: ["annual_budget_id"]
            isOneToOne: false
            referencedRelation: "annual_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarterly_forecasts_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_records: {
        Row: {
          actual_weight_grams: number
          expected_weight_grams: number
          id: string
          is_significant_variance: boolean | null
          received_at: string | null
          received_by: string | null
          receiving_site_id: string | null
          reconciliation_approved_at: string | null
          reconciliation_approved_by: string | null
          reconciliation_comments: string | null
          variance_grams: number
          variance_percentage: number
        }
        Insert: {
          actual_weight_grams: number
          expected_weight_grams: number
          id?: string
          is_significant_variance?: boolean | null
          received_at?: string | null
          received_by?: string | null
          receiving_site_id?: string | null
          reconciliation_approved_at?: string | null
          reconciliation_approved_by?: string | null
          reconciliation_comments?: string | null
          variance_grams: number
          variance_percentage: number
        }
        Update: {
          actual_weight_grams?: number
          expected_weight_grams?: number
          id?: string
          is_significant_variance?: boolean | null
          received_at?: string | null
          received_by?: string | null
          receiving_site_id?: string | null
          reconciliation_approved_at?: string | null
          reconciliation_approved_by?: string | null
          reconciliation_comments?: string | null
          variance_grams?: number
          variance_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "receiving_records_receiving_site_id_fkey"
            columns: ["receiving_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      refineries: {
        Row: {
          capacity_grams_per_month: number | null
          contact_person: string | null
          country: string
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          location: string
          name: string
          phone: string
          updated_at: string | null
        }
        Insert: {
          capacity_grams_per_month?: number | null
          contact_person?: string | null
          country: string
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          location: string
          name: string
          phone: string
          updated_at?: string | null
        }
        Update: {
          capacity_grams_per_month?: number | null
          contact_person?: string | null
          country?: string
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          location?: string
          name?: string
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      refineries_approved: {
        Row: {
          address_line1: string
          address_line2: string | null
          approval_date: string | null
          average_processing_days: number | null
          certification_number: string | null
          city: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          country: string
          created_at: string | null
          id: string
          is_approved: boolean | null
          max_monthly_capacity_oz: number | null
          notes: string | null
          refinery_location: string
          refinery_name: string
          updated_at: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          approval_date?: string | null
          average_processing_days?: number | null
          certification_number?: string | null
          city: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          max_monthly_capacity_oz?: number | null
          notes?: string | null
          refinery_location: string
          refinery_name: string
          updated_at?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          approval_date?: string | null
          average_processing_days?: number | null
          certification_number?: string | null
          city?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          max_monthly_capacity_oz?: number | null
          notes?: string | null
          refinery_location?: string
          refinery_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      refining_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          final_fine_grams: number
          final_fine_ounces: number
          fineness_percentage: number
          id: string
          metal_retained_percentage: number
          post_melting_weight_grams: number
          pre_melting_weight_grams: number
          processed_at: string | null
          processed_by: string | null
          processing_notes: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          final_fine_grams: number
          final_fine_ounces: number
          fineness_percentage: number
          id?: string
          metal_retained_percentage: number
          post_melting_weight_grams: number
          pre_melting_weight_grams: number
          processed_at?: string | null
          processed_by?: string | null
          processing_notes?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          final_fine_grams?: number
          final_fine_ounces?: number
          fineness_percentage?: number
          id?: string
          metal_retained_percentage?: number
          post_melting_weight_grams?: number
          pre_melting_weight_grams?: number
          processed_at?: string | null
          processed_by?: string | null
          processing_notes?: string | null
        }
        Relationships: []
      }
      report_history: {
        Row: {
          download_url: string | null
          error_message: string | null
          file_size: string | null
          format: string
          generated_at: string
          generated_by: string | null
          id: string
          parameters: Json | null
          report_name: string
          report_type: string
          status: string
        }
        Insert: {
          download_url?: string | null
          error_message?: string | null
          file_size?: string | null
          format: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          parameters?: Json | null
          report_name: string
          report_type: string
          status?: string
        }
        Update: {
          download_url?: string | null
          error_message?: string | null
          file_size?: string | null
          format?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          parameters?: Json | null
          report_name?: string
          report_type?: string
          status?: string
        }
        Relationships: []
      }
      sale_pricing_details: {
        Row: {
          base_spot_price: number
          calculation_timestamp: string | null
          created_at: string | null
          final_price_per_oz: number
          forward_adjustment: number | null
          forward_adjustment_percentage: number | null
          id: string
          market_conditions: string | null
          mechanism: string
          sale_id: string
          total_value_usd: number
        }
        Insert: {
          base_spot_price: number
          calculation_timestamp?: string | null
          created_at?: string | null
          final_price_per_oz: number
          forward_adjustment?: number | null
          forward_adjustment_percentage?: number | null
          id?: string
          market_conditions?: string | null
          mechanism: string
          sale_id: string
          total_value_usd: number
        }
        Update: {
          base_spot_price?: number
          calculation_timestamp?: string | null
          created_at?: string | null
          final_price_per_oz?: number
          forward_adjustment?: number | null
          forward_adjustment_percentage?: number | null
          id?: string
          market_conditions?: string | null
          mechanism?: string
          sale_id?: string
          total_value_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_pricing_details_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_pricing_details_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sale_quantity_recommendations: {
        Row: {
          available_stock_oz: number
          avg_price_30d: number | null
          confidence_score: number | null
          created_at: string | null
          current_price_per_oz: number
          gold_trend: string
          id: string
          optimal_timing: string | null
          price_volatility: number | null
          reasoning: string
          recommended_percentage: number
          recommended_quantity_oz: number
          risk_level: string | null
          trend_strength: number | null
        }
        Insert: {
          available_stock_oz: number
          avg_price_30d?: number | null
          confidence_score?: number | null
          created_at?: string | null
          current_price_per_oz: number
          gold_trend: string
          id?: string
          optimal_timing?: string | null
          price_volatility?: number | null
          reasoning: string
          recommended_percentage: number
          recommended_quantity_oz: number
          risk_level?: string | null
          trend_strength?: number | null
        }
        Update: {
          available_stock_oz?: number
          avg_price_30d?: number | null
          confidence_score?: number | null
          created_at?: string | null
          current_price_per_oz?: number
          gold_trend?: string
          id?: string
          optimal_timing?: string | null
          price_volatility?: number | null
          reasoning?: string
          recommended_percentage?: number
          recommended_quantity_oz?: number
          risk_level?: string | null
          trend_strength?: number | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          buyer_notice_days: number | null
          completed_at: string | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_approval_notes: string | null
          customer_approved_at: string | null
          customer_approved_by: string | null
          customer_id: string
          customer_notes: string | null
          customer_rejected_at: string | null
          customer_rejected_by: string | null
          customer_rejection_notes: string | null
          discount_amount: number | null
          discount_percentage: number | null
          final_price_per_oz: number | null
          final_proceeds: number
          forward_days: number | null
          forward_rate_adjustment: number | null
          forward_value_date: string | null
          freight_cost: number | null
          gross_proceeds: number
          id: string
          in_process_refinery_id: string | null
          internal_notes: string | null
          is_internal_sale: boolean | null
          london_am_rate: number
          management_approval_notes: string | null
          management_approved_at: string | null
          management_approved_by: string | null
          management_rejected_at: string | null
          management_rejected_by: string | null
          management_rejection_notes: string | null
          mechanism_type: string | null
          metadata: Json | null
          metal_type: string | null
          net_proceeds: number
          order_type: string | null
          other_costs: number | null
          payment_amount: number | null
          payment_date: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_proof_url: string | null
          payment_received_at: string | null
          payment_schedule_type: string | null
          payment_terms: string | null
          price_adjustment: number | null
          pricing_mechanism: string | null
          quantity_oz: number
          royalty_amount: number
          sale_date: string | null
          sale_number: string
          salesperson_id: string | null
          salesperson_name: string | null
          seller_id: string | null
          seller_type: string | null
          spot_pricing_date: string | null
          spot_value_date: string | null
          status: Database["public"]["Enums"]["sale_status"]
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          buyer_notice_days?: number | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_approval_notes?: string | null
          customer_approved_at?: string | null
          customer_approved_by?: string | null
          customer_id: string
          customer_notes?: string | null
          customer_rejected_at?: string | null
          customer_rejected_by?: string | null
          customer_rejection_notes?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          final_price_per_oz?: number | null
          final_proceeds: number
          forward_days?: number | null
          forward_rate_adjustment?: number | null
          forward_value_date?: string | null
          freight_cost?: number | null
          gross_proceeds: number
          id?: string
          in_process_refinery_id?: string | null
          internal_notes?: string | null
          is_internal_sale?: boolean | null
          london_am_rate: number
          management_approval_notes?: string | null
          management_approved_at?: string | null
          management_approved_by?: string | null
          management_rejected_at?: string | null
          management_rejected_by?: string | null
          management_rejection_notes?: string | null
          mechanism_type?: string | null
          metadata?: Json | null
          metal_type?: string | null
          net_proceeds: number
          order_type?: string | null
          other_costs?: number | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_received_at?: string | null
          payment_schedule_type?: string | null
          payment_terms?: string | null
          price_adjustment?: number | null
          pricing_mechanism?: string | null
          quantity_oz: number
          royalty_amount: number
          sale_date?: string | null
          sale_number: string
          salesperson_id?: string | null
          salesperson_name?: string | null
          seller_id?: string | null
          seller_type?: string | null
          spot_pricing_date?: string | null
          spot_value_date?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          buyer_notice_days?: number | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_approval_notes?: string | null
          customer_approved_at?: string | null
          customer_approved_by?: string | null
          customer_id?: string
          customer_notes?: string | null
          customer_rejected_at?: string | null
          customer_rejected_by?: string | null
          customer_rejection_notes?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          final_price_per_oz?: number | null
          final_proceeds?: number
          forward_days?: number | null
          forward_rate_adjustment?: number | null
          forward_value_date?: string | null
          freight_cost?: number | null
          gross_proceeds?: number
          id?: string
          in_process_refinery_id?: string | null
          internal_notes?: string | null
          is_internal_sale?: boolean | null
          london_am_rate?: number
          management_approval_notes?: string | null
          management_approved_at?: string | null
          management_approved_by?: string | null
          management_rejected_at?: string | null
          management_rejected_by?: string | null
          management_rejection_notes?: string | null
          mechanism_type?: string | null
          metadata?: Json | null
          metal_type?: string | null
          net_proceeds?: number
          order_type?: string | null
          other_costs?: number | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_received_at?: string | null
          payment_schedule_type?: string | null
          payment_terms?: string | null
          price_adjustment?: number | null
          pricing_mechanism?: string | null
          quantity_oz?: number
          royalty_amount?: number
          sale_date?: string | null
          sale_number?: string
          salesperson_id?: string | null
          salesperson_name?: string | null
          seller_id?: string | null
          seller_type?: string | null
          spot_pricing_date?: string | null
          spot_value_date?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "customer_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_in_process_refinery_id_fkey"
            columns: ["in_process_refinery_id"]
            isOneToOne: false
            referencedRelation: "refineries_approved"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_allocations: {
        Row: {
          allocated_by: string | null
          allocated_fine_oz: number | null
          allocated_quantity_oz: number
          allocation_status: string | null
          confirmed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          refining_record_id: string | null
          release_reason: string | null
          released_at: string | null
          reserved_at: string | null
          sale_id: string
          updated_at: string | null
        }
        Insert: {
          allocated_by?: string | null
          allocated_fine_oz?: number | null
          allocated_quantity_oz: number
          allocation_status?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          refining_record_id?: string | null
          release_reason?: string | null
          released_at?: string | null
          reserved_at?: string | null
          sale_id: string
          updated_at?: string | null
        }
        Update: {
          allocated_by?: string | null
          allocated_fine_oz?: number | null
          allocated_quantity_oz?: number
          allocation_status?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          refining_record_id?: string | null
          release_reason?: string | null
          released_at?: string | null
          reserved_at?: string | null
          sale_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_allocations_refining_record_id_fkey"
            columns: ["refining_record_id"]
            isOneToOne: false
            referencedRelation: "refining_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_allocations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_allocations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales_approvals: {
        Row: {
          approval_level: number
          approval_token: string | null
          approval_type: string
          approved_at: string | null
          approver_id: string | null
          approver_name: string | null
          conditions: string | null
          created_at: string | null
          decision_notes: string | null
          id: string
          ip_address: string | null
          last_reminder_at: string | null
          notification_sent_at: string | null
          reminder_count: number | null
          required_approver_id: string | null
          required_approver_role: string | null
          sale_id: string
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          approval_level: number
          approval_token?: string | null
          approval_type: string
          approved_at?: string | null
          approver_id?: string | null
          approver_name?: string | null
          conditions?: string | null
          created_at?: string | null
          decision_notes?: string | null
          id?: string
          ip_address?: string | null
          last_reminder_at?: string | null
          notification_sent_at?: string | null
          reminder_count?: number | null
          required_approver_id?: string | null
          required_approver_role?: string | null
          sale_id: string
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          approval_level?: number
          approval_token?: string | null
          approval_type?: string
          approved_at?: string | null
          approver_id?: string | null
          approver_name?: string | null
          conditions?: string | null
          created_at?: string | null
          decision_notes?: string | null
          id?: string
          ip_address?: string | null
          last_reminder_at?: string | null
          notification_sent_at?: string | null
          reminder_count?: number | null
          required_approver_id?: string | null
          required_approver_role?: string | null
          sale_id?: string
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_approvals_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_approvals_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales_audit_trail: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_role: string | null
          change_reason: string | null
          created_at: string | null
          field_changed: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          sale_id: string
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          actor_role?: string | null
          change_reason?: string | null
          created_at?: string | null
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          sale_id: string
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string | null
          change_reason?: string | null
          created_at?: string | null
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          sale_id?: string
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_audit_trail_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_audit_trail_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales_commissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          basis_amount: number
          calculation_details: Json | null
          commission_amount: number
          commission_rate: number | null
          commission_rule_id: string | null
          commission_type: string
          created_at: string | null
          currency: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          sale_id: string
          salesperson_id: string
          salesperson_name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          basis_amount: number
          calculation_details?: Json | null
          commission_amount: number
          commission_rate?: number | null
          commission_rule_id?: string | null
          commission_type: string
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          sale_id: string
          salesperson_id: string
          salesperson_name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          basis_amount?: number
          calculation_details?: Json | null
          commission_amount?: number
          commission_rate?: number | null
          commission_rule_id?: string | null
          commission_type?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          sale_id?: string
          salesperson_id?: string
          salesperson_name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_commissions_commission_rule_id_fkey"
            columns: ["commission_rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales_documents: {
        Row: {
          access_level: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          document_name: string
          document_number: string | null
          document_type: string
          file_size: number | null
          file_url: string
          id: string
          metadata: Json | null
          mime_type: string | null
          previous_version_id: string | null
          sale_id: string
          status: string | null
          tags: string[] | null
          updated_at: string | null
          uploaded_by: string | null
          valid_until: string | null
          version: number | null
        }
        Insert: {
          access_level?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          document_name: string
          document_number?: string | null
          document_type: string
          file_size?: number | null
          file_url: string
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          previous_version_id?: string | null
          sale_id: string
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string | null
          valid_until?: string | null
          version?: number | null
        }
        Update: {
          access_level?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          document_name?: string
          document_number?: string | null
          document_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          previous_version_id?: string | null
          sale_id?: string
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string | null
          valid_until?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_documents_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales_line_items: {
        Row: {
          allocated_from_refining_id: string | null
          created_at: string | null
          fine_weight_oz: number | null
          fineness_percentage: number | null
          id: string
          line_number: number
          line_total: number
          metal_type: string
          notes: string | null
          quantity_grams: number
          quantity_oz: number
          sale_id: string
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          allocated_from_refining_id?: string | null
          created_at?: string | null
          fine_weight_oz?: number | null
          fineness_percentage?: number | null
          id?: string
          line_number: number
          line_total: number
          metal_type?: string
          notes?: string | null
          quantity_grams: number
          quantity_oz: number
          sale_id: string
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          allocated_from_refining_id?: string | null
          created_at?: string | null
          fine_weight_oz?: number | null
          fineness_percentage?: number | null
          id?: string
          line_number?: number
          line_total?: number
          metal_type?: string
          notes?: string | null
          quantity_grams?: number
          quantity_oz?: number
          sale_id?: string
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_line_items_allocated_from_refining_id_fkey"
            columns: ["allocated_from_refining_id"]
            isOneToOne: false
            referencedRelation: "refining_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_line_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_line_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales_notifications_log: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          delivery_status: string | null
          error_message: string | null
          event_type: string
          id: string
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          recipient_type: string
          retry_count: number | null
          sale_id: string | null
          sent_at: string | null
          subject: string | null
          template_used: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          message: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type: string
          retry_count?: number | null
          sale_id?: string | null
          sent_at?: string | null
          subject?: string | null
          template_used?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type?: string
          retry_count?: number | null
          sale_id?: string | null
          sent_at?: string | null
          subject?: string | null
          template_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_notifications_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_notifications_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales_payment_schedules: {
        Row: {
          amount_due: number
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          due_date: string
          id: string
          installment_number: number
          late_fee: number | null
          notes: string | null
          paid_date: string | null
          payment_id: string | null
          payment_method: string | null
          reminder_sent_at: string | null
          sale_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          due_date: string
          id?: string
          installment_number: number
          late_fee?: number | null
          notes?: string | null
          paid_date?: string | null
          payment_id?: string | null
          payment_method?: string | null
          reminder_sent_at?: string | null
          sale_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          late_fee?: number | null
          notes?: string | null
          paid_date?: string | null
          payment_id?: string | null
          payment_method?: string | null
          reminder_sent_at?: string | null
          sale_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_payment_schedules_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payment_schedules_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payment_schedules_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales_status_transitions: {
        Row: {
          created_at: string | null
          description: string
          description_en: string | null
          id: string
          is_automatic: boolean | null
          notes: string | null
          required_role: string | null
          status_from: string
          status_to: string
          step_number: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          description_en?: string | null
          id?: string
          is_automatic?: boolean | null
          notes?: string | null
          required_role?: string | null
          status_from: string
          status_to: string
          step_number: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          description_en?: string | null
          id?: string
          is_automatic?: boolean | null
          notes?: string | null
          required_role?: string | null
          status_from?: string
          status_to?: string
          step_number?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_reports: {
        Row: {
          created_at: string
          created_by: string | null
          format: string
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          recipients: string[]
          report_type: string
          schedule_day: number | null
          schedule_time: string
          schedule_weekday: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          format?: string
          frequency: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          recipients?: string[]
          report_type: string
          schedule_day?: number | null
          schedule_time?: string
          schedule_weekday?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          recipients?: string[]
          report_type?: string
          schedule_day?: number | null
          schedule_time?: string
          schedule_weekday?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_documents: {
        Row: {
          created_at: string | null
          document_url: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          shipping_preparation_id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_url: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          shipping_preparation_id: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_url?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          shipping_preparation_id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_documents_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_documents_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_documents_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_ingots: {
        Row: {
          created_at: string | null
          gross_weight_grams: number
          id: string
          ingot_box_number: string
          net_weight_grams: number
          seal_number_1: string | null
          seal_number_2: string | null
          shipping_preparation_id: string | null
        }
        Insert: {
          created_at?: string | null
          gross_weight_grams: number
          id?: string
          ingot_box_number: string
          net_weight_grams: number
          seal_number_1?: string | null
          seal_number_2?: string | null
          shipping_preparation_id?: string | null
        }
        Update: {
          created_at?: string | null
          gross_weight_grams?: number
          id?: string
          ingot_box_number?: string
          net_weight_grams?: number
          seal_number_1?: string | null
          seal_number_2?: string | null
          shipping_preparation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_ingots_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_ingots_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_ingots_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_preparations: {
        Row: {
          created_at: string | null
          created_by: string | null
          daily_production_id: string | null
          expedition_lot_number: string | null
          export_license_id: string | null
          freight_company_id: string | null
          id: string
          license_id: string | null
          mining_company_id: string | null
          notes: string | null
          packing_list_document_id: string | null
          packing_list_url: string | null
          prepared_at: string | null
          refinery_id: string | null
          seal_number: string | null
          shipped_at: string | null
          shipped_to_address: string | null
          shipped_to_company: string | null
          shipped_to_country: string | null
          status: Database["public"]["Enums"]["shipping_preparation_status"]
          status_old_backup: string | null
          total_boxes: number | null
          total_gross_weight_grams: number | null
          total_net_weight_grams: number | null
          total_weight_oz: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          daily_production_id?: string | null
          expedition_lot_number?: string | null
          export_license_id?: string | null
          freight_company_id?: string | null
          id?: string
          license_id?: string | null
          mining_company_id?: string | null
          notes?: string | null
          packing_list_document_id?: string | null
          packing_list_url?: string | null
          prepared_at?: string | null
          refinery_id?: string | null
          seal_number?: string | null
          shipped_at?: string | null
          shipped_to_address?: string | null
          shipped_to_company?: string | null
          shipped_to_country?: string | null
          status?: Database["public"]["Enums"]["shipping_preparation_status"]
          status_old_backup?: string | null
          total_boxes?: number | null
          total_gross_weight_grams?: number | null
          total_net_weight_grams?: number | null
          total_weight_oz?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          daily_production_id?: string | null
          expedition_lot_number?: string | null
          export_license_id?: string | null
          freight_company_id?: string | null
          id?: string
          license_id?: string | null
          mining_company_id?: string | null
          notes?: string | null
          packing_list_document_id?: string | null
          packing_list_url?: string | null
          prepared_at?: string | null
          refinery_id?: string | null
          seal_number?: string | null
          shipped_at?: string | null
          shipped_to_address?: string | null
          shipped_to_company?: string | null
          shipped_to_country?: string | null
          status?: Database["public"]["Enums"]["shipping_preparation_status"]
          status_old_backup?: string | null
          total_boxes?: number | null
          total_gross_weight_grams?: number | null
          total_net_weight_grams?: number | null
          total_weight_oz?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_export_license_company_fkey"
            columns: ["export_license_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id", "mining_company_id"]
          },
          {
            foreignKeyName: "shipping_preparations_daily_production_id_fkey"
            columns: ["daily_production_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_daily_production_id_fkey"
            columns: ["daily_production_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_export_license_id_fkey"
            columns: ["export_license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_freight_company_id_fkey"
            columns: ["freight_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_refinery_id_fkey_refineries"
            columns: ["refinery_id"]
            isOneToOne: false
            referencedRelation: "refineries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_production_company_fkey"
            columns: ["daily_production_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id", "mining_company_id"]
          },
          {
            foreignKeyName: "shipping_production_company_fkey"
            columns: ["daily_production_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id", "mining_company_id"]
          },
        ]
      }
      shipping_preparations_backup_final: {
        Row: {
          created_at: string | null
          created_by: string | null
          daily_production_id: string | null
          expedition_lot_number: string | null
          id: string | null
          license_id: string | null
          mining_company_id: string | null
          notes: string | null
          packing_list_document_id: string | null
          packing_list_url: string | null
          prepared_at: string | null
          seal_number: string | null
          shipped_at: string | null
          shipped_to_address: string | null
          shipped_to_company: string | null
          shipped_to_country: string | null
          status_old_backup: string | null
          total_boxes: number | null
          total_gross_weight_grams: number | null
          total_net_weight_grams: number | null
          total_weight_oz: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          daily_production_id?: string | null
          expedition_lot_number?: string | null
          id?: string | null
          license_id?: string | null
          mining_company_id?: string | null
          notes?: string | null
          packing_list_document_id?: string | null
          packing_list_url?: string | null
          prepared_at?: string | null
          seal_number?: string | null
          shipped_at?: string | null
          shipped_to_address?: string | null
          shipped_to_company?: string | null
          shipped_to_country?: string | null
          status_old_backup?: string | null
          total_boxes?: number | null
          total_gross_weight_grams?: number | null
          total_net_weight_grams?: number | null
          total_weight_oz?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          daily_production_id?: string | null
          expedition_lot_number?: string | null
          id?: string | null
          license_id?: string | null
          mining_company_id?: string | null
          notes?: string | null
          packing_list_document_id?: string | null
          packing_list_url?: string | null
          prepared_at?: string | null
          seal_number?: string | null
          shipped_at?: string | null
          shipped_to_address?: string | null
          shipped_to_company?: string | null
          shipped_to_country?: string | null
          status_old_backup?: string | null
          total_boxes?: number | null
          total_gross_weight_grams?: number | null
          total_net_weight_grams?: number | null
          total_weight_oz?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_preparations_backup_simple: {
        Row: {
          created_at: string | null
          created_by: string | null
          daily_production_id: string | null
          expedition_lot_number: string | null
          id: string | null
          license_id: string | null
          mining_company_id: string | null
          notes: string | null
          packing_list_document_id: string | null
          packing_list_url: string | null
          prepared_at: string | null
          seal_number: string | null
          shipped_at: string | null
          shipped_to_address: string | null
          shipped_to_company: string | null
          shipped_to_country: string | null
          status_old_backup: string | null
          total_boxes: number | null
          total_gross_weight_grams: number | null
          total_net_weight_grams: number | null
          total_weight_oz: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          daily_production_id?: string | null
          expedition_lot_number?: string | null
          id?: string | null
          license_id?: string | null
          mining_company_id?: string | null
          notes?: string | null
          packing_list_document_id?: string | null
          packing_list_url?: string | null
          prepared_at?: string | null
          seal_number?: string | null
          shipped_at?: string | null
          shipped_to_address?: string | null
          shipped_to_company?: string | null
          shipped_to_country?: string | null
          status_old_backup?: string | null
          total_boxes?: number | null
          total_gross_weight_grams?: number | null
          total_net_weight_grams?: number | null
          total_weight_oz?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          daily_production_id?: string | null
          expedition_lot_number?: string | null
          id?: string | null
          license_id?: string | null
          mining_company_id?: string | null
          notes?: string | null
          packing_list_document_id?: string | null
          packing_list_url?: string | null
          prepared_at?: string | null
          seal_number?: string | null
          shipped_at?: string | null
          shipped_to_address?: string | null
          shipped_to_company?: string | null
          shipped_to_country?: string | null
          status_old_backup?: string | null
          total_boxes?: number | null
          total_gross_weight_grams?: number | null
          total_net_weight_grams?: number | null
          total_weight_oz?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_production_items: {
        Row: {
          created_at: string | null
          daily_production_id: string
          fineness_pct: number
          gross_weight_grams: number
          id: string
          ingot_box_number: string
          net_weight_grams: number
          order_index: number | null
          pure_gold_grams: number
          seal_number_1: string
          seal_number_2: string | null
          shipping_preparation_id: string
        }
        Insert: {
          created_at?: string | null
          daily_production_id: string
          fineness_pct: number
          gross_weight_grams: number
          id?: string
          ingot_box_number: string
          net_weight_grams: number
          order_index?: number | null
          pure_gold_grams: number
          seal_number_1: string
          seal_number_2?: string | null
          shipping_preparation_id: string
        }
        Update: {
          created_at?: string | null
          daily_production_id?: string
          fineness_pct?: number
          gross_weight_grams?: number
          id?: string
          ingot_box_number?: string
          net_weight_grams?: number
          order_index?: number | null
          pure_gold_grams?: number
          seal_number_1?: string
          seal_number_2?: string | null
          shipping_preparation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_production_items_daily_production_id_fkey"
            columns: ["daily_production_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_production_items_daily_production_id_fkey"
            columns: ["daily_production_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_production_items_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_production_items_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_production_items_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_signatories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_index: number | null
          position: string
          shipping_preparation_id: string | null
          signature_data: string | null
          signed_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order_index?: number | null
          position: string
          shipping_preparation_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number | null
          position?: string
          shipping_preparation_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_signatories_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_signatories_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_signatories_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          site_type: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          site_type: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          site_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      snp_account_admin_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          new_values: Json
          previous_values: Json
          target_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          new_values?: Json
          previous_values?: Json
          target_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          new_values?: Json
          previous_values?: Json
          target_id?: string
        }
        Relationships: []
      }
      snp_account_deletion_dependency_registry: {
        Row: {
          classification: string
          column_name: string
          constraint_name: string | null
          delete_action: unknown
          referenced_column_name: string | null
          referenced_schema_name: string | null
          referenced_table_name: string | null
          registered_at: string
          schema_name: string
          source: string
          table_name: string
        }
        Insert: {
          classification: string
          column_name: string
          constraint_name?: string | null
          delete_action?: unknown
          referenced_column_name?: string | null
          referenced_schema_name?: string | null
          referenced_table_name?: string | null
          registered_at?: string
          schema_name: string
          source: string
          table_name: string
        }
        Update: {
          classification?: string
          column_name?: string
          constraint_name?: string | null
          delete_action?: unknown
          referenced_column_name?: string | null
          referenced_schema_name?: string | null
          referenced_table_name?: string | null
          registered_at?: string
          schema_name?: string
          source?: string
          table_name?: string
        }
        Relationships: []
      }
      snp_account_lifecycle_audit: {
        Row: {
          action: string
          actor_id: string
          application_sessions_revoked: number
          authorized_at: string
          db_completed_at: string | null
          external_error_code: string | null
          external_success: boolean | null
          finalized_at: string | null
          id: string
          idempotency_key: string
          payload_hash: string
          previous_active: boolean
          previous_version: number
          reason: string
          request_payload: Json
          result_active: boolean | null
          result_version: number | null
          status: string
          target_id: string
          updated_at: string
        }
        Insert: {
          action: string
          actor_id: string
          application_sessions_revoked?: number
          authorized_at?: string
          db_completed_at?: string | null
          external_error_code?: string | null
          external_success?: boolean | null
          finalized_at?: string | null
          id?: string
          idempotency_key: string
          payload_hash: string
          previous_active: boolean
          previous_version: number
          reason: string
          request_payload: Json
          result_active?: boolean | null
          result_version?: number | null
          status: string
          target_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string
          application_sessions_revoked?: number
          authorized_at?: string
          db_completed_at?: string | null
          external_error_code?: string | null
          external_success?: boolean | null
          finalized_at?: string | null
          id?: string
          idempotency_key?: string
          payload_hash?: string
          previous_active?: boolean
          previous_version?: number
          reason?: string
          request_payload?: Json
          result_active?: boolean | null
          result_version?: number | null
          status?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      snp_achats_audit: {
        Row: {
          acteur_id: string | null
          action: string
          id: number
          objet: string
          objet_id: string
          survenu_le: string
          valeurs_apres: Json | null
          valeurs_avant: Json | null
        }
        Insert: {
          acteur_id?: string | null
          action: string
          id?: number
          objet: string
          objet_id: string
          survenu_le?: string
          valeurs_apres?: Json | null
          valeurs_avant?: Json | null
        }
        Update: {
          acteur_id?: string | null
          action?: string
          id?: number
          objet?: string
          objet_id?: string
          survenu_le?: string
          valeurs_apres?: Json | null
          valeurs_avant?: Json | null
        }
        Relationships: []
      }
      snp_achats_mines: {
        Row: {
          contrat_id: string | null
          cours_once_usd: number | null
          created_at: string
          created_by: string | null
          date_achat: string
          demande_id: string | null
          id: string
          imputation_contractuelle: string | null
          imputation_decidee_le: string | null
          imputation_decidee_par: string | null
          imputation_motif: string | null
          mining_company_id: string
          montant_brut_fcfa: number
          montant_total_fcfa: number
          numero_achat: string | null
          observations: string | null
          origine: string
          periode_debut: string
          periode_fin: string
          prix_once_fcfa: number
          quantite_grammes: number | null
          quantite_imputee_oz: number
          quantite_oz: number
          requisition_id: string | null
          statut: string
          taux_usd_xof: number | null
          taxe_dev_comm_montant_fcfa: number
          taxe_dev_comm_taux: number
          tva_montant_fcfa: number
          tva_taux: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contrat_id?: string | null
          cours_once_usd?: number | null
          created_at?: string
          created_by?: string | null
          date_achat?: string
          demande_id?: string | null
          id?: string
          imputation_contractuelle?: string | null
          imputation_decidee_le?: string | null
          imputation_decidee_par?: string | null
          imputation_motif?: string | null
          mining_company_id: string
          montant_brut_fcfa?: number
          montant_total_fcfa?: number
          numero_achat?: string | null
          observations?: string | null
          origine?: string
          periode_debut: string
          periode_fin: string
          prix_once_fcfa: number
          quantite_grammes?: number | null
          quantite_imputee_oz?: number
          quantite_oz: number
          requisition_id?: string | null
          statut?: string
          taux_usd_xof?: number | null
          taxe_dev_comm_montant_fcfa?: number
          taxe_dev_comm_taux?: number
          tva_montant_fcfa?: number
          tva_taux?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contrat_id?: string | null
          cours_once_usd?: number | null
          created_at?: string
          created_by?: string | null
          date_achat?: string
          demande_id?: string | null
          id?: string
          imputation_contractuelle?: string | null
          imputation_decidee_le?: string | null
          imputation_decidee_par?: string | null
          imputation_motif?: string | null
          mining_company_id?: string
          montant_brut_fcfa?: number
          montant_total_fcfa?: number
          numero_achat?: string | null
          observations?: string | null
          origine?: string
          periode_debut?: string
          periode_fin?: string
          prix_once_fcfa?: number
          quantite_grammes?: number | null
          quantite_imputee_oz?: number
          quantite_oz?: number
          requisition_id?: string | null
          statut?: string
          taux_usd_xof?: number | null
          taxe_dev_comm_montant_fcfa?: number
          taxe_dev_comm_taux?: number
          tva_montant_fcfa?: number
          tva_taux?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_achats_mines_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_achats_mines_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "snp_demandes_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_achats_mines_imputation_decidee_par_fkey"
            columns: ["imputation_decidee_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_achats_mines_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_achats_mines_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "snp_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_alertes_parametres: {
        Row: {
          actif: boolean
          cle: string
          destinataires_roles: string[]
          domaine: string
          gravite: string
          libelle: string
          seuil_jours: number | null
          seuil_pourcentage: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actif?: boolean
          cle: string
          destinataires_roles?: string[]
          domaine: string
          gravite?: string
          libelle: string
          seuil_jours?: number | null
          seuil_pourcentage?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actif?: boolean
          cle?: string
          destinataires_roles?: string[]
          domaine?: string
          gravite?: string
          libelle?: string
          seuil_jours?: number | null
          seuil_pourcentage?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_alertes_parametres_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_analyses_resultats: {
        Row: {
          analyse_id: string
          analyste: string | null
          argent_pct: number | null
          certificat_reference: string | null
          created_at: string
          date_analyse: string | null
          document_chemin: string | null
          enregistre_par: string | null
          id: string
          laboratoire: string
          laboratoire_independant: boolean
          methode: string | null
          observations: string | null
          origine: string
          rang: number
          teneur_pct: number
        }
        Insert: {
          analyse_id: string
          analyste?: string | null
          argent_pct?: number | null
          certificat_reference?: string | null
          created_at?: string
          date_analyse?: string | null
          document_chemin?: string | null
          enregistre_par?: string | null
          id?: string
          laboratoire: string
          laboratoire_independant?: boolean
          methode?: string | null
          observations?: string | null
          origine: string
          rang: number
          teneur_pct: number
        }
        Update: {
          analyse_id?: string
          analyste?: string | null
          argent_pct?: number | null
          certificat_reference?: string | null
          created_at?: string
          date_analyse?: string | null
          document_chemin?: string | null
          enregistre_par?: string | null
          id?: string
          laboratoire?: string
          laboratoire_independant?: boolean
          methode?: string | null
          observations?: string | null
          origine?: string
          rang?: number
          teneur_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_analyses_resultats_analyse_id_fkey"
            columns: ["analyse_id"]
            isOneToOne: false
            referencedRelation: "snp_analyses_teneur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_analyses_resultats_enregistre_par_fkey"
            columns: ["enregistre_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_analyses_teneur: {
        Row: {
          achat_id: string | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          date_declaration: string | null
          date_prelevement: string | null
          decision: string | null
          declaree_par: string | null
          enlevement_id: string | null
          id: string
          justification_retenue: string | null
          lieu_prelevement: string | null
          masse_echantillon_g: number | null
          masse_lot_oz: number | null
          methode_echantillonnage: string | null
          mining_company_id: string | null
          motif_statut: string | null
          numero_echantillon: string | null
          observations: string | null
          reference: string
          requisition_id: string | null
          retenue_le: string | null
          retenue_par: string | null
          statut: string
          teneur_declaree_pct: number
          teneur_retenue_pct: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          achat_id?: string | null
          contrat_id?: string | null
          created_at?: string
          created_by?: string | null
          date_declaration?: string | null
          date_prelevement?: string | null
          decision?: string | null
          declaree_par?: string | null
          enlevement_id?: string | null
          id?: string
          justification_retenue?: string | null
          lieu_prelevement?: string | null
          masse_echantillon_g?: number | null
          masse_lot_oz?: number | null
          methode_echantillonnage?: string | null
          mining_company_id?: string | null
          motif_statut?: string | null
          numero_echantillon?: string | null
          observations?: string | null
          reference: string
          requisition_id?: string | null
          retenue_le?: string | null
          retenue_par?: string | null
          statut?: string
          teneur_declaree_pct: number
          teneur_retenue_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          achat_id?: string | null
          contrat_id?: string | null
          created_at?: string
          created_by?: string | null
          date_declaration?: string | null
          date_prelevement?: string | null
          decision?: string | null
          declaree_par?: string | null
          enlevement_id?: string | null
          id?: string
          justification_retenue?: string | null
          lieu_prelevement?: string | null
          masse_echantillon_g?: number | null
          masse_lot_oz?: number | null
          methode_echantillonnage?: string | null
          mining_company_id?: string | null
          motif_statut?: string | null
          numero_echantillon?: string | null
          observations?: string | null
          reference?: string
          requisition_id?: string | null
          retenue_le?: string | null
          retenue_par?: string | null
          statut?: string
          teneur_declaree_pct?: number
          teneur_retenue_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_analyses_teneur_achat_id_fkey"
            columns: ["achat_id"]
            isOneToOne: false
            referencedRelation: "snp_achats_mines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_analyses_teneur_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_analyses_teneur_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_analyses_teneur_enlevement_id_fkey"
            columns: ["enlevement_id"]
            isOneToOne: false
            referencedRelation: "snp_requisitions_enlevements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_analyses_teneur_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_analyses_teneur_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "snp_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_analyses_teneur_retenue_par_fkey"
            columns: ["retenue_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_analyses_teneur_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_artisan_activities: {
        Row: {
          artisan_id: string
          carte_id: string | null
          created_at: string | null
          created_by: string | null
          date_activite: string
          description: string | null
          devise: string | null
          id: string
          montant: number | null
          quantite_grammes: number | null
          type_activite: string
        }
        Insert: {
          artisan_id: string
          carte_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_activite?: string
          description?: string | null
          devise?: string | null
          id?: string
          montant?: number | null
          quantite_grammes?: number | null
          type_activite: string
        }
        Update: {
          artisan_id?: string
          carte_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_activite?: string
          description?: string | null
          devise?: string | null
          id?: string
          montant?: number | null
          quantite_grammes?: number | null
          type_activite?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisan_activities_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_activities_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_activities_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_activities_carte_id_fkey"
            columns: ["carte_id"]
            isOneToOne: false
            referencedRelation: "snp_cartes_professionnelles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_artisan_documents: {
        Row: {
          artisan_id: string
          chemin_fichier: string
          description: string | null
          id: string
          nom_fichier: string
          taille_fichier: number | null
          type_document: string
          type_mime: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          artisan_id: string
          chemin_fichier: string
          description?: string | null
          id?: string
          nom_fichier: string
          taille_fichier?: number | null
          type_document: string
          type_mime?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          artisan_id?: string
          chemin_fichier?: string
          description?: string | null
          id?: string
          nom_fichier?: string
          taille_fichier?: number | null
          type_document?: string
          type_mime?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisan_documents_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_documents_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_documents_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
        ]
      }
      snp_artisan_factures_definitives: {
        Row: {
          artisan_id: string
          certification_dgi_status: string
          comptoir_organization_id: string | null
          created_at: string | null
          date_echeance: string | null
          date_emission: string | null
          dgi_certified_at: string | null
          dgi_certified_by: string | null
          dgi_document_path: string | null
          dgi_reference: string | null
          emise_par: string | null
          id: string
          montant_autres_taxes: number | null
          montant_brut: number
          montant_net_a_payer: number
          montant_taxe_retenue_source: number | null
          montant_taxe_tva: number | null
          montant_total_taxes: number
          notes: string | null
          numero_facture: string
          pdf_url: string | null
          statut: string | null
          taux_retenue_source: number | null
          taux_tva: number | null
          tax_policy_id: string | null
          updated_at: string | null
          vente_or_id: string
          version: number
        }
        Insert: {
          artisan_id: string
          certification_dgi_status?: string
          comptoir_organization_id?: string | null
          created_at?: string | null
          date_echeance?: string | null
          date_emission?: string | null
          dgi_certified_at?: string | null
          dgi_certified_by?: string | null
          dgi_document_path?: string | null
          dgi_reference?: string | null
          emise_par?: string | null
          id?: string
          montant_autres_taxes?: number | null
          montant_brut: number
          montant_net_a_payer: number
          montant_taxe_retenue_source?: number | null
          montant_taxe_tva?: number | null
          montant_total_taxes: number
          notes?: string | null
          numero_facture: string
          pdf_url?: string | null
          statut?: string | null
          taux_retenue_source?: number | null
          taux_tva?: number | null
          tax_policy_id?: string | null
          updated_at?: string | null
          vente_or_id: string
          version?: number
        }
        Update: {
          artisan_id?: string
          certification_dgi_status?: string
          comptoir_organization_id?: string | null
          created_at?: string | null
          date_echeance?: string | null
          date_emission?: string | null
          dgi_certified_at?: string | null
          dgi_certified_by?: string | null
          dgi_document_path?: string | null
          dgi_reference?: string | null
          emise_par?: string | null
          id?: string
          montant_autres_taxes?: number | null
          montant_brut?: number
          montant_net_a_payer?: number
          montant_taxe_retenue_source?: number | null
          montant_taxe_tva?: number | null
          montant_total_taxes?: number
          notes?: string | null
          numero_facture?: string
          pdf_url?: string | null
          statut?: string | null
          taux_retenue_source?: number | null
          taux_tva?: number | null
          tax_policy_id?: string | null
          updated_at?: string | null
          vente_or_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisan_factures_definitives_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_factures_definitives_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_factures_definitives_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_factures_definitives_comptoir_organization_id_fkey"
            columns: ["comptoir_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_factures_definitives_vente_or_id_fkey"
            columns: ["vente_or_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_ventes_or"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_factures_definitives_vente_or_id_fkey"
            columns: ["vente_or_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["vente_id"]
          },
          {
            foreignKeyName: "snp_artisan_factures_tax_policy_fkey"
            columns: ["tax_policy_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_tax_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_artisan_finance_operation_ledger: {
        Row: {
          actor_id: string
          aggregate_id: string
          capability_code: string
          completed_at: string | null
          comptoir_organization_id: string | null
          created_at: string
          idempotency_key: string
          operation: string
          request_fingerprint: string
          response: Json | null
        }
        Insert: {
          actor_id: string
          aggregate_id: string
          capability_code: string
          completed_at?: string | null
          comptoir_organization_id?: string | null
          created_at?: string
          idempotency_key: string
          operation: string
          request_fingerprint: string
          response?: Json | null
        }
        Update: {
          actor_id?: string
          aggregate_id?: string
          capability_code?: string
          completed_at?: string | null
          comptoir_organization_id?: string | null
          created_at?: string
          idempotency_key?: string
          operation?: string
          request_fingerprint?: string
          response?: Json | null
        }
        Relationships: []
      }
      snp_artisan_moyens_paiement: {
        Row: {
          actif: boolean
          artisan_id: string
          banque: string | null
          code_swift: string | null
          created_at: string
          created_by: string | null
          est_principal: boolean
          id: string
          libelle: string | null
          numero_compte: string | null
          numero_telephone: string | null
          observations: string | null
          titulaire: string
          type: string
          updated_at: string
          updated_by: string | null
          verifie_le: string | null
          verifie_par: string | null
        }
        Insert: {
          actif?: boolean
          artisan_id: string
          banque?: string | null
          code_swift?: string | null
          created_at?: string
          created_by?: string | null
          est_principal?: boolean
          id?: string
          libelle?: string | null
          numero_compte?: string | null
          numero_telephone?: string | null
          observations?: string | null
          titulaire: string
          type: string
          updated_at?: string
          updated_by?: string | null
          verifie_le?: string | null
          verifie_par?: string | null
        }
        Update: {
          actif?: boolean
          artisan_id?: string
          banque?: string | null
          code_swift?: string | null
          created_at?: string
          created_by?: string | null
          est_principal?: boolean
          id?: string
          libelle?: string | null
          numero_compte?: string | null
          numero_telephone?: string | null
          observations?: string | null
          titulaire?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          verifie_le?: string | null
          verifie_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisan_moyens_paiement_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_moyens_paiement_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_moyens_paiement_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
        ]
      }
      snp_artisan_paiements: {
        Row: {
          artisan_id: string
          cancelled_by: string | null
          completed_by: string | null
          comptoir_organization_id: string | null
          created_at: string | null
          date_completion: string | null
          date_paiement: string | null
          date_validation: string | null
          details_paiement: Json | null
          facture_id: string
          failed_by: string | null
          id: string
          montant_paye: number
          montant_taxes_retenues: number
          moyen_paiement_id: string | null
          notes: string | null
          numero_facture: string | null
          preuve_paiement_url: string | null
          recu_paiement_url: string | null
          reference_paiement: string
          statut: string | null
          terminal_reason: string | null
          traite_par: string | null
          type_paiement: string
          updated_at: string | null
          valide_par: string | null
          vente_or_id: string
          version: number
        }
        Insert: {
          artisan_id: string
          cancelled_by?: string | null
          completed_by?: string | null
          comptoir_organization_id?: string | null
          created_at?: string | null
          date_completion?: string | null
          date_paiement?: string | null
          date_validation?: string | null
          details_paiement?: Json | null
          facture_id: string
          failed_by?: string | null
          id?: string
          montant_paye: number
          montant_taxes_retenues?: number
          moyen_paiement_id?: string | null
          notes?: string | null
          numero_facture?: string | null
          preuve_paiement_url?: string | null
          recu_paiement_url?: string | null
          reference_paiement: string
          statut?: string | null
          terminal_reason?: string | null
          traite_par?: string | null
          type_paiement: string
          updated_at?: string | null
          valide_par?: string | null
          vente_or_id: string
          version?: number
        }
        Update: {
          artisan_id?: string
          cancelled_by?: string | null
          completed_by?: string | null
          comptoir_organization_id?: string | null
          created_at?: string | null
          date_completion?: string | null
          date_paiement?: string | null
          date_validation?: string | null
          details_paiement?: Json | null
          facture_id?: string
          failed_by?: string | null
          id?: string
          montant_paye?: number
          montant_taxes_retenues?: number
          moyen_paiement_id?: string | null
          notes?: string | null
          numero_facture?: string | null
          preuve_paiement_url?: string | null
          recu_paiement_url?: string | null
          reference_paiement?: string
          statut?: string | null
          terminal_reason?: string | null
          traite_par?: string | null
          type_paiement?: string
          updated_at?: string | null
          valide_par?: string | null
          vente_or_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisan_paiements_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_paiements_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_paiements_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_paiements_comptoir_organization_id_fkey"
            columns: ["comptoir_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_paiements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_factures_definitives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_paiements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "snp_artisan_paiements_moyen_paiement_id_fkey"
            columns: ["moyen_paiement_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_moyens_paiement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_paiements_vente_or_id_fkey"
            columns: ["vente_or_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_ventes_or"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_paiements_vente_or_id_fkey"
            columns: ["vente_or_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["vente_id"]
          },
        ]
      }
      snp_artisan_tax_policies: {
        Row: {
          community_rate: number
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          policy_code: string
          source_note: string
          vat_rate: number
          withholding_rate: number
        }
        Insert: {
          community_rate: number
          created_at?: string
          effective_from: string
          effective_until?: string | null
          id?: string
          policy_code: string
          source_note: string
          vat_rate: number
          withholding_rate: number
        }
        Update: {
          community_rate?: number
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          policy_code?: string
          source_note?: string
          vat_rate?: number
          withholding_rate?: number
        }
        Relationships: []
      }
      snp_artisan_taxes_retenues: {
        Row: {
          artisan_id: string
          comptabilise_at: string | null
          comptabilise_par: string | null
          compte_comptable: string | null
          comptoir_organization_id: string | null
          created_at: string | null
          date_reversement: string | null
          exercice_fiscal: string | null
          facture_id: string
          id: string
          libelle_taxe: string
          montant_taxe: number
          paiement_id: string
          periode_fiscale: string | null
          reference_comptable: string | null
          reversed_by: string | null
          reversement_reference: string | null
          reversement_started_at: string | null
          reversement_started_by: string | null
          statut_reversement: string | null
          taux_taxe: number
          type_taxe: string
          updated_at: string | null
          vente_or_id: string
          version: number
        }
        Insert: {
          artisan_id: string
          comptabilise_at?: string | null
          comptabilise_par?: string | null
          compte_comptable?: string | null
          comptoir_organization_id?: string | null
          created_at?: string | null
          date_reversement?: string | null
          exercice_fiscal?: string | null
          facture_id: string
          id?: string
          libelle_taxe: string
          montant_taxe: number
          paiement_id: string
          periode_fiscale?: string | null
          reference_comptable?: string | null
          reversed_by?: string | null
          reversement_reference?: string | null
          reversement_started_at?: string | null
          reversement_started_by?: string | null
          statut_reversement?: string | null
          taux_taxe: number
          type_taxe: string
          updated_at?: string | null
          vente_or_id: string
          version?: number
        }
        Update: {
          artisan_id?: string
          comptabilise_at?: string | null
          comptabilise_par?: string | null
          compte_comptable?: string | null
          comptoir_organization_id?: string | null
          created_at?: string | null
          date_reversement?: string | null
          exercice_fiscal?: string | null
          facture_id?: string
          id?: string
          libelle_taxe?: string
          montant_taxe?: number
          paiement_id?: string
          periode_fiscale?: string | null
          reference_comptable?: string | null
          reversed_by?: string | null
          reversement_reference?: string | null
          reversement_started_at?: string | null
          reversement_started_by?: string | null
          statut_reversement?: string | null
          taux_taxe?: number
          type_taxe?: string
          updated_at?: string | null
          vente_or_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisan_taxes_retenues_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_taxes_retenues_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_taxes_retenues_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_taxes_retenues_comptoir_organization_id_fkey"
            columns: ["comptoir_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_taxes_retenues_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_factures_definitives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_taxes_retenues_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "snp_artisan_taxes_retenues_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_paiements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_taxes_retenues_vente_or_id_fkey"
            columns: ["vente_or_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_ventes_or"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_taxes_retenues_vente_or_id_fkey"
            columns: ["vente_or_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["vente_id"]
          },
        ]
      }
      snp_artisan_transactions: {
        Row: {
          artisan_id: string
          created_at: string
          created_by: string | null
          date_transaction: string
          description: string | null
          id: string
          mode_paiement: string | null
          montant_total_fcfa: number
          numero_recu: string | null
          paiement_effectue: boolean | null
          prix_unitaire_fcfa: number
          quantite_grammes: number
          type_transaction: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          artisan_id: string
          created_at?: string
          created_by?: string | null
          date_transaction?: string
          description?: string | null
          id?: string
          mode_paiement?: string | null
          montant_total_fcfa: number
          numero_recu?: string | null
          paiement_effectue?: boolean | null
          prix_unitaire_fcfa: number
          quantite_grammes: number
          type_transaction: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          artisan_id?: string
          created_at?: string
          created_by?: string | null
          date_transaction?: string
          description?: string | null
          id?: string
          mode_paiement?: string | null
          montant_total_fcfa?: number
          numero_recu?: string | null
          paiement_effectue?: boolean | null
          prix_unitaire_fcfa?: number
          quantite_grammes?: number
          type_transaction?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisan_transactions_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_transactions_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_transactions_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
        ]
      }
      snp_artisan_ventes_or: {
        Row: {
          acheteur_comptoir_organization_id: string | null
          acheteur_id: string | null
          artisan_id: string
          comptoir_organization_id: string | null
          created_at: string
          created_by: string | null
          date_vente: string
          facture_definitive_id: string | null
          id: string
          montant_brut_fcfa: number
          montant_total_fcfa: number
          numero_recu: string | null
          observations: string | null
          prix_kg_fcfa: number
          purete_karat: number
          quantite_grammes: number
          reference_vente: string | null
          statut: string | null
          statut_paiement: string | null
          statut_validation: string | null
          taxe_dev_comm_montant_fcfa: number | null
          taxe_dev_comm_taux: number | null
          tva_montant_fcfa: number | null
          tva_taux: number | null
          type_or: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          acheteur_comptoir_organization_id?: string | null
          acheteur_id?: string | null
          artisan_id: string
          comptoir_organization_id?: string | null
          created_at?: string
          created_by?: string | null
          date_vente?: string
          facture_definitive_id?: string | null
          id?: string
          montant_brut_fcfa: number
          montant_total_fcfa: number
          numero_recu?: string | null
          observations?: string | null
          prix_kg_fcfa: number
          purete_karat: number
          quantite_grammes: number
          reference_vente?: string | null
          statut?: string | null
          statut_paiement?: string | null
          statut_validation?: string | null
          taxe_dev_comm_montant_fcfa?: number | null
          taxe_dev_comm_taux?: number | null
          tva_montant_fcfa?: number | null
          tva_taux?: number | null
          type_or: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          acheteur_comptoir_organization_id?: string | null
          acheteur_id?: string | null
          artisan_id?: string
          comptoir_organization_id?: string | null
          created_at?: string
          created_by?: string | null
          date_vente?: string
          facture_definitive_id?: string | null
          id?: string
          montant_brut_fcfa?: number
          montant_total_fcfa?: number
          numero_recu?: string | null
          observations?: string | null
          prix_kg_fcfa?: number
          purete_karat?: number
          quantite_grammes?: number
          reference_vente?: string | null
          statut?: string | null
          statut_paiement?: string | null
          statut_validation?: string | null
          taxe_dev_comm_montant_fcfa?: number | null
          taxe_dev_comm_taux?: number | null
          tva_montant_fcfa?: number | null
          tva_taux?: number | null
          type_or?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisan_ventes_or_acheteur_comptoir_organization_id_fkey"
            columns: ["acheteur_comptoir_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_ventes_or_acheteur_id_fkey"
            columns: ["acheteur_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_ventes_or_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_ventes_or_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_ventes_or_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisan_ventes_or_comptoir_organization_id_fkey"
            columns: ["comptoir_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_ventes_or_facture_definitive_id_fkey"
            columns: ["facture_definitive_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_factures_definitives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisan_ventes_or_facture_definitive_id_fkey"
            columns: ["facture_definitive_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["facture_id"]
          },
        ]
      }
      snp_artisanal_stock_ledger: {
        Row: {
          artisan_id: string | null
          business_reference: string
          created_at: string
          created_by: string
          direction: string
          id: string
          idempotency_key: string
          movement_type: string
          organization_id: string
          quantity_grams: number
          reason: string | null
          reverses_entry_id: string | null
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          artisan_id?: string | null
          business_reference: string
          created_at?: string
          created_by: string
          direction: string
          id?: string
          idempotency_key: string
          movement_type: string
          organization_id: string
          quantity_grams: number
          reason?: string | null
          reverses_entry_id?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          artisan_id?: string | null
          business_reference?: string
          created_at?: string
          created_by?: string
          direction?: string
          id?: string
          idempotency_key?: string
          movement_type?: string
          organization_id?: string
          quantity_grams?: number
          reason?: string | null
          reverses_entry_id?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisanal_stock_ledger_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisanal_stock_ledger_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisanal_stock_ledger_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisanal_stock_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisanal_stock_ledger_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "snp_artisanal_stock_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_artisans_miniers: {
        Row: {
          actif: boolean
          adresse: string | null
          artisanal_site_id: string | null
          chiffre_affaires_fcfa: number
          collecteur_id: string | null
          commune: string | null
          created_at: string | null
          created_by: string | null
          date_delivrance_piece: string | null
          date_expiration_piece: string | null
          date_naissance: string | null
          derniere_transaction_date: string | null
          desactive_le: string | null
          desactive_par: string | null
          email: string | null
          id: string
          lieu_delivrance_piece: string | null
          lieu_naissance: string | null
          motif_desactivation: string | null
          nationalite: string | null
          nom: string | null
          nombre_transactions: number
          numero_carte: string | null
          numero_piece_identite: string | null
          numero_registre_commerce: string | null
          observations: string | null
          pays: string | null
          photo_url: string | null
          piece_identite_url: string | null
          prenoms: string | null
          quantite_or_vendu_grammes: number
          raison_sociale: string | null
          region: string | null
          sexe: string | null
          telephone: string
          telephone_secondaire: string | null
          type_artisan: string
          type_personne: string
          type_piece_identite: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          artisanal_site_id?: string | null
          chiffre_affaires_fcfa?: number
          collecteur_id?: string | null
          commune?: string | null
          created_at?: string | null
          created_by?: string | null
          date_delivrance_piece?: string | null
          date_expiration_piece?: string | null
          date_naissance?: string | null
          derniere_transaction_date?: string | null
          desactive_le?: string | null
          desactive_par?: string | null
          email?: string | null
          id?: string
          lieu_delivrance_piece?: string | null
          lieu_naissance?: string | null
          motif_desactivation?: string | null
          nationalite?: string | null
          nom?: string | null
          nombre_transactions?: number
          numero_carte?: string | null
          numero_piece_identite?: string | null
          numero_registre_commerce?: string | null
          observations?: string | null
          pays?: string | null
          photo_url?: string | null
          piece_identite_url?: string | null
          prenoms?: string | null
          quantite_or_vendu_grammes?: number
          raison_sociale?: string | null
          region?: string | null
          sexe?: string | null
          telephone: string
          telephone_secondaire?: string | null
          type_artisan: string
          type_personne: string
          type_piece_identite?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          artisanal_site_id?: string | null
          chiffre_affaires_fcfa?: number
          collecteur_id?: string | null
          commune?: string | null
          created_at?: string | null
          created_by?: string | null
          date_delivrance_piece?: string | null
          date_expiration_piece?: string | null
          date_naissance?: string | null
          derniere_transaction_date?: string | null
          desactive_le?: string | null
          desactive_par?: string | null
          email?: string | null
          id?: string
          lieu_delivrance_piece?: string | null
          lieu_naissance?: string | null
          motif_desactivation?: string | null
          nationalite?: string | null
          nom?: string | null
          nombre_transactions?: number
          numero_carte?: string | null
          numero_piece_identite?: string | null
          numero_registre_commerce?: string | null
          observations?: string | null
          pays?: string | null
          photo_url?: string | null
          piece_identite_url?: string | null
          prenoms?: string | null
          quantite_or_vendu_grammes?: number
          raison_sociale?: string | null
          region?: string | null
          sexe?: string | null
          telephone?: string
          telephone_secondaire?: string | null
          type_artisan?: string
          type_personne?: string
          type_piece_identite?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_artisans_collecteur_id_fkey"
            columns: ["collecteur_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_artisans_collecteur_id_fkey"
            columns: ["collecteur_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisans_collecteur_id_fkey"
            columns: ["collecteur_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_artisans_miniers_artisanal_site_id_fkey"
            columns: ["artisanal_site_id"]
            isOneToOne: false
            referencedRelation: "artisanal_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_avoirs_achat: {
        Row: {
          created_at: string
          created_by: string | null
          date_avoir: string
          facture_id: string
          id: string
          mining_company_id: string
          montant_fcfa: number
          motif: string
          numero_avoir: string
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_avoir?: string
          facture_id: string
          id?: string
          mining_company_id: string
          montant_fcfa: number
          motif: string
          numero_avoir: string
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_avoir?: string
          facture_id?: string
          id?: string
          mining_company_id?: string
          montant_fcfa?: number
          motif?: string
          numero_avoir?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_avoirs_achat_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "snp_factures_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_achat_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_avoirs_client: {
        Row: {
          annule_le: string | null
          annule_par: string | null
          conciliation_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          devise: string
          id: string
          mining_company_id: string | null
          montant_initial: number
          motif: string
          reference: string
          rembourse_le: string | null
          rembourse_par: string | null
          sale_id_origine: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          annule_le?: string | null
          annule_par?: string | null
          conciliation_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          devise?: string
          id?: string
          mining_company_id?: string | null
          montant_initial: number
          motif: string
          reference: string
          rembourse_le?: string | null
          rembourse_par?: string | null
          sale_id_origine?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          annule_le?: string | null
          annule_par?: string | null
          conciliation_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          devise?: string
          id?: string
          mining_company_id?: string | null
          montant_initial?: number
          motif?: string
          reference?: string
          rembourse_le?: string | null
          rembourse_par?: string | null
          sale_id_origine?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_avoirs_client_annule_par_fkey"
            columns: ["annule_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_client_conciliation_id_fkey"
            columns: ["conciliation_id"]
            isOneToOne: false
            referencedRelation: "snp_conciliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_client_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_client_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_client_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_client_rembourse_par_fkey"
            columns: ["rembourse_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_client_sale_id_origine_fkey"
            columns: ["sale_id_origine"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_client_sale_id_origine_fkey"
            columns: ["sale_id_origine"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      snp_avoirs_imputations: {
        Row: {
          avoir_id: string
          conciliation_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          impute_par: string | null
          montant_impute: number
          motif: string | null
          sale_id: string | null
        }
        Insert: {
          avoir_id: string
          conciliation_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          impute_par?: string | null
          montant_impute: number
          motif?: string | null
          sale_id?: string | null
        }
        Update: {
          avoir_id?: string
          conciliation_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          impute_par?: string | null
          montant_impute?: number
          motif?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_avoirs_imputations_avoir_id_fkey"
            columns: ["avoir_id"]
            isOneToOne: false
            referencedRelation: "snp_avoirs_client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_imputations_conciliation_id_fkey"
            columns: ["conciliation_id"]
            isOneToOne: false
            referencedRelation: "snp_conciliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_imputations_impute_par_fkey"
            columns: ["impute_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_imputations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_avoirs_imputations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      snp_calculs_fiscaux: {
        Row: {
          assiette_retenue: string
          calcule_le: string
          calcule_par: string | null
          code_taxe: string
          contexte_id: string
          contexte_type: string
          devise: string
          formule: string
          id: string
          mining_company_id: string | null
          montant_assiette: number
          montant_obtenu: number
          regle_id: string | null
          regle_provisoire: boolean
          taux_applique: number | null
        }
        Insert: {
          assiette_retenue: string
          calcule_le?: string
          calcule_par?: string | null
          code_taxe: string
          contexte_id: string
          contexte_type: string
          devise?: string
          formule: string
          id?: string
          mining_company_id?: string | null
          montant_assiette: number
          montant_obtenu: number
          regle_id?: string | null
          regle_provisoire?: boolean
          taux_applique?: number | null
        }
        Update: {
          assiette_retenue?: string
          calcule_le?: string
          calcule_par?: string | null
          code_taxe?: string
          contexte_id?: string
          contexte_type?: string
          devise?: string
          formule?: string
          id?: string
          mining_company_id?: string | null
          montant_assiette?: number
          montant_obtenu?: number
          regle_id?: string | null
          regle_provisoire?: boolean
          taux_applique?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_calculs_fiscaux_calcule_par_fkey"
            columns: ["calcule_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_calculs_fiscaux_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_calculs_fiscaux_regle_id_fkey"
            columns: ["regle_id"]
            isOneToOne: false
            referencedRelation: "snp_regles_fiscales"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_capability_catalog: {
        Row: {
          code: string
          created_at: string
          description: string
          domain: string
          label: string
          sensitive: boolean
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          domain: string
          label: string
          sensitive?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          domain?: string
          label?: string
          sensitive?: boolean
        }
        Relationships: []
      }
      snp_carte_statistics: {
        Row: {
          carte_id: string
          derniere_activite: string | null
          id: string
          montant_total: number | null
          nombre_achats: number | null
          nombre_ventes: number | null
          quantite_totale_grammes: number | null
          updated_at: string | null
        }
        Insert: {
          carte_id: string
          derniere_activite?: string | null
          id?: string
          montant_total?: number | null
          nombre_achats?: number | null
          nombre_ventes?: number | null
          quantite_totale_grammes?: number | null
          updated_at?: string | null
        }
        Update: {
          carte_id?: string
          derniere_activite?: string | null
          id?: string
          montant_total?: number | null
          nombre_achats?: number | null
          nombre_ventes?: number | null
          quantite_totale_grammes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_carte_statistics_carte_id_fkey"
            columns: ["carte_id"]
            isOneToOne: true
            referencedRelation: "snp_cartes_professionnelles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_cartes_professionnelles: {
        Row: {
          artisan_id: string
          carte_recto_url: string | null
          carte_verso_url: string | null
          created_at: string | null
          created_by: string | null
          date_emission: string
          date_expiration: string
          date_suspension: string | null
          date_validation: string | null
          id: string
          motif_suspension: string | null
          numero_carte: string
          numero_securite: string | null
          observations: string | null
          qr_code_data: string | null
          qr_code_url: string | null
          statut: string
          suspendue_le: string | null
          suspendue_par: string | null
          updated_at: string | null
          updated_by: string | null
          validee_le: string | null
          validee_par: string | null
        }
        Insert: {
          artisan_id: string
          carte_recto_url?: string | null
          carte_verso_url?: string | null
          created_at?: string | null
          created_by?: string | null
          date_emission?: string
          date_expiration?: string
          date_suspension?: string | null
          date_validation?: string | null
          id?: string
          motif_suspension?: string | null
          numero_carte: string
          numero_securite?: string | null
          observations?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          statut?: string
          suspendue_le?: string | null
          suspendue_par?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validee_le?: string | null
          validee_par?: string | null
        }
        Update: {
          artisan_id?: string
          carte_recto_url?: string | null
          carte_verso_url?: string | null
          created_at?: string | null
          created_by?: string | null
          date_emission?: string
          date_expiration?: string
          date_suspension?: string | null
          date_validation?: string | null
          id?: string
          motif_suspension?: string | null
          numero_carte?: string
          numero_securite?: string | null
          observations?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          statut?: string
          suspendue_le?: string | null
          suspendue_par?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validee_le?: string | null
          validee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_cartes_professionnelles_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_cartes_professionnelles_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_cartes_professionnelles_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
        ]
      }
      snp_collector_accounts: {
        Row: {
          collector_id: string
          comptoir_organization_id: string | null
          id: string
          is_active: boolean
          linked_at: string
          linked_by: string | null
          reason: string
          unlinked_at: string | null
          user_id: string
        }
        Insert: {
          collector_id: string
          comptoir_organization_id?: string | null
          id?: string
          is_active?: boolean
          linked_at?: string
          linked_by?: string | null
          reason: string
          unlinked_at?: string | null
          user_id: string
        }
        Update: {
          collector_id?: string
          comptoir_organization_id?: string | null
          id?: string
          is_active?: boolean
          linked_at?: string
          linked_by?: string | null
          reason?: string
          unlinked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_collector_accounts_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_collector_accounts_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_collector_accounts_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_collector_accounts_comptoir_organization_id_fkey"
            columns: ["comptoir_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_collector_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_collector_artisan_assignments: {
        Row: {
          artisan_id: string
          assigned_by: string | null
          collector_id: string
          comptoir_organization_id: string | null
          created_at: string
          id: string
          reason: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          artisan_id: string
          assigned_by?: string | null
          collector_id: string
          comptoir_organization_id?: string | null
          created_at?: string
          id?: string
          reason: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          artisan_id?: string
          assigned_by?: string | null
          collector_id?: string
          comptoir_organization_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_collector_artisan_assignments_comptoir_organization_id_fkey"
            columns: ["comptoir_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_collector_assignments_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_collector_assignments_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_collector_assignments_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_collector_assignments_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_collector_assignments_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_collector_assignments_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
        ]
      }
      snp_comptes_audit: {
        Row: {
          acteur_id: string
          action: string
          ancien_etat: boolean
          cible_id: string
          cree_le: string
          motif: string
          nouvel_etat: boolean
          uid: string
        }
        Insert: {
          acteur_id: string
          action: string
          ancien_etat: boolean
          cible_id: string
          cree_le?: string
          motif: string
          nouvel_etat: boolean
          uid?: string
        }
        Update: {
          acteur_id?: string
          action?: string
          ancien_etat?: boolean
          cible_id?: string
          cree_le?: string
          motif?: string
          nouvel_etat?: boolean
          uid?: string
        }
        Relationships: []
      }
      snp_comptoir_ventes_sonasp: {
        Row: {
          comptoir_organization_id: string
          created_at: string
          date_vente: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          quantity_grams: number
          reference_vente: string
          reviewed_at: string | null
          reviewed_by: string | null
          sonasp_organization_id: string
          status: string
          submitted_by: string
          total_fcfa: number | null
          unit_price_fcfa: number
          updated_at: string
        }
        Insert: {
          comptoir_organization_id: string
          created_at?: string
          date_vente?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          quantity_grams: number
          reference_vente: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sonasp_organization_id: string
          status?: string
          submitted_by: string
          total_fcfa?: number | null
          unit_price_fcfa: number
          updated_at?: string
        }
        Update: {
          comptoir_organization_id?: string
          created_at?: string
          date_vente?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          quantity_grams?: number
          reference_vente?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sonasp_organization_id?: string
          status?: string
          submitted_by?: string
          total_fcfa?: number | null
          unit_price_fcfa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_comptoir_ventes_sonasp_comptoir_organization_id_fkey"
            columns: ["comptoir_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_comptoir_ventes_sonasp_sonasp_organization_id_fkey"
            columns: ["sonasp_organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_conciliations: {
        Row: {
          analyse_teneur_id: string | null
          assay_certificate_id: string | null
          ca_final: number | null
          ca_initial: number | null
          cloture_le: string | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          date_fixing: string | null
          deductions_contractuelles: number | null
          devise_finale: string | null
          devise_initiale: string | null
          id: string
          mining_company_id: string | null
          motif_statut: string | null
          observations: string | null
          or_fin_final_g: number | null
          or_fin_initial_g: number | null
          poids_final_g: number | null
          poids_initial_g: number | null
          prix_final: number | null
          prix_initial: number | null
          reference: string
          sale_id: string
          soumis_le: string | null
          soumis_par: string | null
          source_analyse_type: string | null
          statut: string
          taux_change_final: number | null
          taux_change_initial: number | null
          teneur_finale_pct: number | null
          teneur_initiale_pct: number | null
          updated_at: string
          updated_by: string | null
          valide_le: string | null
          valide_par: string | null
          version: number
        }
        Insert: {
          analyse_teneur_id?: string | null
          assay_certificate_id?: string | null
          ca_final?: number | null
          ca_initial?: number | null
          cloture_le?: string | null
          contrat_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date_fixing?: string | null
          deductions_contractuelles?: number | null
          devise_finale?: string | null
          devise_initiale?: string | null
          id?: string
          mining_company_id?: string | null
          motif_statut?: string | null
          observations?: string | null
          or_fin_final_g?: number | null
          or_fin_initial_g?: number | null
          poids_final_g?: number | null
          poids_initial_g?: number | null
          prix_final?: number | null
          prix_initial?: number | null
          reference: string
          sale_id: string
          soumis_le?: string | null
          soumis_par?: string | null
          source_analyse_type?: string | null
          statut?: string
          taux_change_final?: number | null
          taux_change_initial?: number | null
          teneur_finale_pct?: number | null
          teneur_initiale_pct?: number | null
          updated_at?: string
          updated_by?: string | null
          valide_le?: string | null
          valide_par?: string | null
          version?: number
        }
        Update: {
          analyse_teneur_id?: string | null
          assay_certificate_id?: string | null
          ca_final?: number | null
          ca_initial?: number | null
          cloture_le?: string | null
          contrat_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date_fixing?: string | null
          deductions_contractuelles?: number | null
          devise_finale?: string | null
          devise_initiale?: string | null
          id?: string
          mining_company_id?: string | null
          motif_statut?: string | null
          observations?: string | null
          or_fin_final_g?: number | null
          or_fin_initial_g?: number | null
          poids_final_g?: number | null
          poids_initial_g?: number | null
          prix_final?: number | null
          prix_initial?: number | null
          reference?: string
          sale_id?: string
          soumis_le?: string | null
          soumis_par?: string | null
          source_analyse_type?: string | null
          statut?: string
          taux_change_final?: number | null
          taux_change_initial?: number | null
          teneur_finale_pct?: number | null
          teneur_initiale_pct?: number | null
          updated_at?: string
          updated_by?: string | null
          valide_le?: string | null
          valide_par?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_conciliations_analyse_teneur_id_fkey"
            columns: ["analyse_teneur_id"]
            isOneToOne: false
            referencedRelation: "snp_analyses_teneur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_assay_certificate_id_fkey"
            columns: ["assay_certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_assay_certificate_id_fkey"
            columns: ["assay_certificate_id"]
            isOneToOne: false
            referencedRelation: "assay_certificates_with_shipping"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
          {
            foreignKeyName: "snp_conciliations_soumis_par_fkey"
            columns: ["soumis_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_conciliations_ecarts: {
        Row: {
          code_taxe: string | null
          conciliation_id: string
          created_at: string
          depasse_seuil: boolean
          ecart_absolu: number | null
          ecart_relatif_pct: number | null
          id: string
          justification: string | null
          parametre: string
          seuil_contractuel_pct: number | null
          unite: string | null
          valeur_definitive: number | null
          valeur_initiale: number | null
        }
        Insert: {
          code_taxe?: string | null
          conciliation_id: string
          created_at?: string
          depasse_seuil?: boolean
          ecart_absolu?: number | null
          ecart_relatif_pct?: number | null
          id?: string
          justification?: string | null
          parametre: string
          seuil_contractuel_pct?: number | null
          unite?: string | null
          valeur_definitive?: number | null
          valeur_initiale?: number | null
        }
        Update: {
          code_taxe?: string | null
          conciliation_id?: string
          created_at?: string
          depasse_seuil?: boolean
          ecart_absolu?: number | null
          ecart_relatif_pct?: number | null
          id?: string
          justification?: string | null
          parametre?: string
          seuil_contractuel_pct?: number | null
          unite?: string | null
          valeur_definitive?: number | null
          valeur_initiale?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_conciliations_ecarts_conciliation_id_fkey"
            columns: ["conciliation_id"]
            isOneToOne: false
            referencedRelation: "snp_conciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_conciliations_operation_ledger: {
        Row: {
          actor_id: string
          aggregate_id: string
          capability_code: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          operation: string
          request_fingerprint: string
          response: Json | null
        }
        Insert: {
          actor_id: string
          aggregate_id: string
          capability_code: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          operation: string
          request_fingerprint: string
          response?: Json | null
        }
        Update: {
          actor_id?: string
          aggregate_id?: string
          capability_code?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          operation?: string
          request_fingerprint?: string
          response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_conciliations_operation_ledger_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_conciliations_versions: {
        Row: {
          acteur_id: string | null
          acteur_role: string | null
          conciliation_id: string
          created_at: string
          id: string
          motif: string
          valeurs_apres: Json
          valeurs_avant: Json
          version: number
        }
        Insert: {
          acteur_id?: string | null
          acteur_role?: string | null
          conciliation_id: string
          created_at?: string
          id?: string
          motif: string
          valeurs_apres: Json
          valeurs_avant: Json
          version: number
        }
        Update: {
          acteur_id?: string | null
          acteur_role?: string | null
          conciliation_id?: string
          created_at?: string
          id?: string
          motif?: string
          valeurs_apres?: Json
          valeurs_avant?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_conciliations_versions_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_conciliations_versions_conciliation_id_fkey"
            columns: ["conciliation_id"]
            isOneToOne: false
            referencedRelation: "snp_conciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_configuration_courriel: {
        Row: {
          actif: boolean
          created_at: string
          created_by: string | null
          derniere_erreur: string | null
          derniere_verification: string | null
          expediteur_courriel: string | null
          expediteur_nom: string
          hote: string | null
          identifiant: string | null
          libelle: string
          mot_de_passe: string | null
          mot_de_passe_modifie_le: string | null
          port: number
          securise: boolean
          uid: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          derniere_erreur?: string | null
          derniere_verification?: string | null
          expediteur_courriel?: string | null
          expediteur_nom?: string
          hote?: string | null
          identifiant?: string | null
          libelle: string
          mot_de_passe?: string | null
          mot_de_passe_modifie_le?: string | null
          port?: number
          securise?: boolean
          uid?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          derniere_erreur?: string | null
          derniere_verification?: string | null
          expediteur_courriel?: string | null
          expediteur_nom?: string
          hote?: string | null
          identifiant?: string | null
          libelle?: string
          mot_de_passe?: string | null
          mot_de_passe_modifie_le?: string | null
          port?: number
          securise?: boolean
          uid?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_configuration_courriel_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_configuration_courriel_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_contrats: {
        Row: {
          approuve_par: string | null
          artisan_id: string | null
          conditions_enlevement: string | null
          conditions_livraison: string | null
          conditions_paiement: string
          confidentialite: string | null
          contrat_parent_id: string | null
          contrat_precedent_id: string | null
          created_at: string
          created_by: string | null
          date_activation: string | null
          date_approbation: string | null
          date_cloture: string | null
          date_debut: string
          date_fin: string
          date_signature: string | null
          date_soumission: string | null
          decote_pct: number
          delai_contestation_jours: number
          delai_paiement_jours: number
          devise_cours: string
          devise_reglement: string
          direction_responsable: string | null
          force_majeure: string | null
          formule_prix: string | null
          frais_contre_expertise: string
          gestionnaire_id: string | null
          id: string
          intitule: string
          laboratoire_independant: string | null
          laboratoire_initial: string | null
          livraison_anticipee_autorisee: boolean
          methode_analyse: string | null
          methode_echantillonnage: string | null
          methode_prix: string
          mining_company_id: string | null
          modalites_pesee: string | null
          motif_statut: string | null
          numero_contrat: string
          obligations_fournisseur: string | null
          obligations_sonasp: string | null
          observations: string | null
          partenaire_libelle: string | null
          partenaire_type: string
          penalites: string | null
          periodicite: string
          plafond_depassement_pct: number
          preavis_reconduction_jours: number | null
          prime_pct: number
          prix_ajuste_sur_teneur: boolean
          prix_fixe_fcfa: number | null
          quantite_maximale: number | null
          quantite_minimale: number | null
          quantite_totale: number | null
          reconduction: string
          reglement_differends: string | null
          report_reliquat: string
          representant_contact: string | null
          representant_partenaire: string | null
          site_id: string | null
          source_cours: string | null
          statut: string
          teneur_faisant_foi: string
          teneur_minimale_pct: number | null
          teneur_reference_pct: number | null
          teneur_tolerance_pct: number
          tolerance_quantite_pct: number
          transfert_propriete: string | null
          type_contrat: string
          unite: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          approuve_par?: string | null
          artisan_id?: string | null
          conditions_enlevement?: string | null
          conditions_livraison?: string | null
          conditions_paiement?: string
          confidentialite?: string | null
          contrat_parent_id?: string | null
          contrat_precedent_id?: string | null
          created_at?: string
          created_by?: string | null
          date_activation?: string | null
          date_approbation?: string | null
          date_cloture?: string | null
          date_debut: string
          date_fin: string
          date_signature?: string | null
          date_soumission?: string | null
          decote_pct?: number
          delai_contestation_jours?: number
          delai_paiement_jours?: number
          devise_cours?: string
          devise_reglement?: string
          direction_responsable?: string | null
          force_majeure?: string | null
          formule_prix?: string | null
          frais_contre_expertise?: string
          gestionnaire_id?: string | null
          id?: string
          intitule: string
          laboratoire_independant?: string | null
          laboratoire_initial?: string | null
          livraison_anticipee_autorisee?: boolean
          methode_analyse?: string | null
          methode_echantillonnage?: string | null
          methode_prix?: string
          mining_company_id?: string | null
          modalites_pesee?: string | null
          motif_statut?: string | null
          numero_contrat: string
          obligations_fournisseur?: string | null
          obligations_sonasp?: string | null
          observations?: string | null
          partenaire_libelle?: string | null
          partenaire_type: string
          penalites?: string | null
          periodicite?: string
          plafond_depassement_pct?: number
          preavis_reconduction_jours?: number | null
          prime_pct?: number
          prix_ajuste_sur_teneur?: boolean
          prix_fixe_fcfa?: number | null
          quantite_maximale?: number | null
          quantite_minimale?: number | null
          quantite_totale?: number | null
          reconduction?: string
          reglement_differends?: string | null
          report_reliquat?: string
          representant_contact?: string | null
          representant_partenaire?: string | null
          site_id?: string | null
          source_cours?: string | null
          statut?: string
          teneur_faisant_foi?: string
          teneur_minimale_pct?: number | null
          teneur_reference_pct?: number | null
          teneur_tolerance_pct?: number
          tolerance_quantite_pct?: number
          transfert_propriete?: string | null
          type_contrat?: string
          unite?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          approuve_par?: string | null
          artisan_id?: string | null
          conditions_enlevement?: string | null
          conditions_livraison?: string | null
          conditions_paiement?: string
          confidentialite?: string | null
          contrat_parent_id?: string | null
          contrat_precedent_id?: string | null
          created_at?: string
          created_by?: string | null
          date_activation?: string | null
          date_approbation?: string | null
          date_cloture?: string | null
          date_debut?: string
          date_fin?: string
          date_signature?: string | null
          date_soumission?: string | null
          decote_pct?: number
          delai_contestation_jours?: number
          delai_paiement_jours?: number
          devise_cours?: string
          devise_reglement?: string
          direction_responsable?: string | null
          force_majeure?: string | null
          formule_prix?: string | null
          frais_contre_expertise?: string
          gestionnaire_id?: string | null
          id?: string
          intitule?: string
          laboratoire_independant?: string | null
          laboratoire_initial?: string | null
          livraison_anticipee_autorisee?: boolean
          methode_analyse?: string | null
          methode_echantillonnage?: string | null
          methode_prix?: string
          mining_company_id?: string | null
          modalites_pesee?: string | null
          motif_statut?: string | null
          numero_contrat?: string
          obligations_fournisseur?: string | null
          obligations_sonasp?: string | null
          observations?: string | null
          partenaire_libelle?: string | null
          partenaire_type?: string
          penalites?: string | null
          periodicite?: string
          plafond_depassement_pct?: number
          preavis_reconduction_jours?: number | null
          prime_pct?: number
          prix_ajuste_sur_teneur?: boolean
          prix_fixe_fcfa?: number | null
          quantite_maximale?: number | null
          quantite_minimale?: number | null
          quantite_totale?: number | null
          reconduction?: string
          reglement_differends?: string | null
          report_reliquat?: string
          representant_contact?: string | null
          representant_partenaire?: string | null
          site_id?: string | null
          source_cours?: string | null
          statut?: string
          teneur_faisant_foi?: string
          teneur_minimale_pct?: number | null
          teneur_reference_pct?: number | null
          teneur_tolerance_pct?: number
          tolerance_quantite_pct?: number
          transfert_propriete?: string | null
          type_contrat?: string
          unite?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_contrats_approuve_par_fkey"
            columns: ["approuve_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_contrats_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_contrats_contrat_parent_id_fkey"
            columns: ["contrat_parent_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_contrat_precedent_id_fkey"
            columns: ["contrat_precedent_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_gestionnaire_id_fkey"
            columns: ["gestionnaire_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_contrats_defauts: {
        Row: {
          actions_correctives: string | null
          contrat_id: string
          created_at: string
          created_by: string | null
          date_detection: string
          decision_finale: string | null
          description: string
          echeance_correction: string | null
          echeance_id: string | null
          gravite: string
          id: string
          montant_concerne_fcfa: number | null
          motif: string | null
          nature: string
          obligation: string | null
          partie_responsable: string
          periode_debut: string | null
          periode_fin: string | null
          quantite_concernee: number | null
          reference: string
          responsable_traitement: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          actions_correctives?: string | null
          contrat_id: string
          created_at?: string
          created_by?: string | null
          date_detection?: string
          decision_finale?: string | null
          description: string
          echeance_correction?: string | null
          echeance_id?: string | null
          gravite?: string
          id?: string
          montant_concerne_fcfa?: number | null
          motif?: string | null
          nature: string
          obligation?: string | null
          partie_responsable?: string
          periode_debut?: string | null
          periode_fin?: string | null
          quantite_concernee?: number | null
          reference: string
          responsable_traitement?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          actions_correctives?: string | null
          contrat_id?: string
          created_at?: string
          created_by?: string | null
          date_detection?: string
          decision_finale?: string | null
          description?: string
          echeance_correction?: string | null
          echeance_id?: string | null
          gravite?: string
          id?: string
          montant_concerne_fcfa?: number | null
          motif?: string | null
          nature?: string
          obligation?: string | null
          partie_responsable?: string
          periode_debut?: string | null
          periode_fin?: string | null
          quantite_concernee?: number | null
          reference?: string
          responsable_traitement?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_contrats_defauts_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_defauts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_defauts_echeance_id_fkey"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats_echeancier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_defauts_responsable_traitement_fkey"
            columns: ["responsable_traitement"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_contrats_documents: {
        Row: {
          categorie: string
          chemin: string
          contrat_id: string
          created_at: string
          created_by: string | null
          date_document: string | null
          date_expiration: string | null
          id: string
          intitule: string
          motif_suppression: string | null
          observations: string | null
          statut: string
          supprime_le: string | null
          supprime_par: string | null
          taille_octets: number | null
          type_mime: string | null
          updated_at: string
          version: number
        }
        Insert: {
          categorie: string
          chemin: string
          contrat_id: string
          created_at?: string
          created_by?: string | null
          date_document?: string | null
          date_expiration?: string | null
          id?: string
          intitule: string
          motif_suppression?: string | null
          observations?: string | null
          statut?: string
          supprime_le?: string | null
          supprime_par?: string | null
          taille_octets?: number | null
          type_mime?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          categorie?: string
          chemin?: string
          contrat_id?: string
          created_at?: string
          created_by?: string | null
          date_document?: string | null
          date_expiration?: string | null
          id?: string
          intitule?: string
          motif_suppression?: string | null
          observations?: string | null
          statut?: string
          supprime_le?: string | null
          supprime_par?: string | null
          taille_octets?: number | null
          type_mime?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_contrats_documents_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_documents_supprime_par_fkey"
            columns: ["supprime_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_contrats_echeancier: {
        Row: {
          annee: number
          contrat_id: string
          created_at: string
          id: string
          mois: number | null
          nature: string
          observations: string | null
          periode_debut: string
          periode_fin: string
          quantite_minimale: number | null
          quantite_prevue: number
          rang: number
          updated_at: string
        }
        Insert: {
          annee: number
          contrat_id: string
          created_at?: string
          id?: string
          mois?: number | null
          nature?: string
          observations?: string | null
          periode_debut: string
          periode_fin: string
          quantite_minimale?: number | null
          quantite_prevue?: number
          rang: number
          updated_at?: string
        }
        Update: {
          annee?: number
          contrat_id?: string
          created_at?: string
          id?: string
          mois?: number | null
          nature?: string
          observations?: string | null
          periode_debut?: string
          periode_fin?: string
          quantite_minimale?: number | null
          quantite_prevue?: number
          rang?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_contrats_echeancier_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_contrats_historique: {
        Row: {
          acteur_id: string | null
          commentaire: string | null
          contrat_id: string
          id: string
          motif: string | null
          statut_apres: string
          statut_avant: string | null
          survenu_le: string
        }
        Insert: {
          acteur_id?: string | null
          commentaire?: string | null
          contrat_id: string
          id?: string
          motif?: string | null
          statut_apres: string
          statut_avant?: string | null
          survenu_le?: string
        }
        Update: {
          acteur_id?: string | null
          commentaire?: string | null
          contrat_id?: string
          id?: string
          motif?: string | null
          statut_apres?: string
          statut_avant?: string | null
          survenu_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_contrats_historique_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_contrats_historique_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_decisions_approbation_audit: {
        Row: {
          actor_id: string
          actor_role: string
          approval_request_id: string | null
          created_at: string
          decision: string
          entity_id: string
          entity_type: string
          id: string
          previous_status: string
          reason: string | null
          resulting_status: string
        }
        Insert: {
          actor_id: string
          actor_role: string
          approval_request_id?: string | null
          created_at?: string
          decision: string
          entity_id: string
          entity_type: string
          id?: string
          previous_status: string
          reason?: string | null
          resulting_status: string
        }
        Update: {
          actor_id?: string
          actor_role?: string
          approval_request_id?: string | null
          created_at?: string
          decision?: string
          entity_id?: string
          entity_type?: string
          id?: string
          previous_status?: string
          reason?: string | null
          resulting_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_decisions_approbation_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_decisions_approbation_audit_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_demandes_achat: {
        Row: {
          conditions_paiement: string
          contrat_id: string | null
          cours_reference_usd: number | null
          created_at: string
          created_by: string | null
          date_limite_reponse: string | null
          date_reponse: string | null
          date_soumission: string | null
          delai_reponse_jours: number
          devise: string
          id: string
          ligne_id: string | null
          mining_company_id: string
          montant_estime_fcfa: number
          motif_modification: string | null
          motif_rejet: string | null
          numero_demande: string
          observations: string | null
          origine: string
          periode_debut: string
          periode_fin: string
          plan_id: string | null
          pourcentage_applique: number | null
          prix_once_fcfa: number
          production_reference_oz: number
          quantite_demandee_oz: number
          repondu_par: string | null
          requisition_id: string | null
          statut: string
          taux_usd_xof: number | null
          titre_pct: number | null
          unite: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conditions_paiement?: string
          contrat_id?: string | null
          cours_reference_usd?: number | null
          created_at?: string
          created_by?: string | null
          date_limite_reponse?: string | null
          date_reponse?: string | null
          date_soumission?: string | null
          delai_reponse_jours?: number
          devise?: string
          id?: string
          ligne_id?: string | null
          mining_company_id: string
          montant_estime_fcfa?: number
          motif_modification?: string | null
          motif_rejet?: string | null
          numero_demande: string
          observations?: string | null
          origine?: string
          periode_debut: string
          periode_fin: string
          plan_id?: string | null
          pourcentage_applique?: number | null
          prix_once_fcfa: number
          production_reference_oz?: number
          quantite_demandee_oz: number
          repondu_par?: string | null
          requisition_id?: string | null
          statut?: string
          taux_usd_xof?: number | null
          titre_pct?: number | null
          unite?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conditions_paiement?: string
          contrat_id?: string | null
          cours_reference_usd?: number | null
          created_at?: string
          created_by?: string | null
          date_limite_reponse?: string | null
          date_reponse?: string | null
          date_soumission?: string | null
          delai_reponse_jours?: number
          devise?: string
          id?: string
          ligne_id?: string | null
          mining_company_id?: string
          montant_estime_fcfa?: number
          motif_modification?: string | null
          motif_rejet?: string | null
          numero_demande?: string
          observations?: string | null
          origine?: string
          periode_debut?: string
          periode_fin?: string
          plan_id?: string | null
          pourcentage_applique?: number | null
          prix_once_fcfa?: number
          production_reference_oz?: number
          quantite_demandee_oz?: number
          repondu_par?: string | null
          requisition_id?: string | null
          statut?: string
          taux_usd_xof?: number | null
          titre_pct?: number | null
          unite?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_demandes_achat_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_demandes_achat_ligne_id_fkey"
            columns: ["ligne_id"]
            isOneToOne: true
            referencedRelation: "snp_plans_achat_lignes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_demandes_achat_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_demandes_achat_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "snp_plans_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_demandes_achat_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "snp_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_demandes_achat_historique: {
        Row: {
          acteur_id: string | null
          acteur_role: string | null
          action: string
          created_at: string
          demande_id: string
          id: string
          motif: string | null
          statut_apres: string | null
          statut_avant: string | null
          valeurs_apres: Json | null
          valeurs_avant: Json | null
        }
        Insert: {
          acteur_id?: string | null
          acteur_role?: string | null
          action: string
          created_at?: string
          demande_id: string
          id?: string
          motif?: string | null
          statut_apres?: string | null
          statut_avant?: string | null
          valeurs_apres?: Json | null
          valeurs_avant?: Json | null
        }
        Update: {
          acteur_id?: string | null
          acteur_role?: string | null
          action?: string
          created_at?: string
          demande_id?: string
          id?: string
          motif?: string | null
          statut_apres?: string | null
          statut_avant?: string | null
          valeurs_apres?: Json | null
          valeurs_avant?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_demandes_achat_historique_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "snp_demandes_achat"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_documents_acces: {
        Row: {
          acteur_id: string | null
          action: string
          chemin: string
          document_id: string | null
          domaine: string
          id: string
          objet_id: string | null
          survenu_le: string
        }
        Insert: {
          acteur_id?: string | null
          action?: string
          chemin: string
          document_id?: string | null
          domaine: string
          id?: string
          objet_id?: string | null
          survenu_le?: string
        }
        Update: {
          acteur_id?: string | null
          action?: string
          chemin?: string
          document_id?: string | null
          domaine?: string
          id?: string
          objet_id?: string | null
          survenu_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_documents_acces_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_export_license_requests: {
        Row: {
          comment: string | null
          created_at: string
          decision_reason: string | null
          desired_export_date: string
          destination: string
          id: string
          license_id: string | null
          mining_company_id: string
          reason: string
          requested_quantity_grams: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decision_reason?: string | null
          desired_export_date: string
          destination: string
          id?: string
          license_id?: string | null
          mining_company_id: string
          reason: string
          requested_quantity_grams: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          decision_reason?: string | null
          desired_export_date?: string
          destination?: string
          id?: string
          license_id?: string | null
          mining_company_id?: string
          reason?: string
          requested_quantity_grams?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_export_license_requests_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_export_license_requests_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_export_license_reservations: {
        Row: {
          id: string
          license_id: string
          mining_company_id: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          reserved_at: string
          reserved_by: string | null
          reserved_grams: number
          shipping_preparation_id: string | null
          shipping_reference: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          license_id: string
          mining_company_id: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string
          reserved_by?: string | null
          reserved_grams: number
          shipping_preparation_id?: string | null
          shipping_reference: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          license_id?: string
          mining_company_id?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string
          reserved_by?: string | null
          reserved_grams?: number
          shipping_preparation_id?: string | null
          shipping_reference?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_export_license_reservations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_export_license_reservations_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_export_license_reservations_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: true
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_export_license_reservations_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: true
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_export_license_reservations_shipping_preparation_id_fkey"
            columns: ["shipping_preparation_id"]
            isOneToOne: true
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_factures_achat: {
        Row: {
          achat_id: string
          certification_date: string | null
          certification_reference: string | null
          conditions_paiement: string
          created_at: string
          created_by: string | null
          date_echeance: string
          date_emission: string
          demande_id: string | null
          devise: string
          facture_remplacee_id: string | null
          id: string
          mining_company_id: string
          montant_ajustements_fcfa: number
          montant_ht_fcfa: number
          montant_paye_fcfa: number
          montant_ttc_fcfa: number
          motif_annulation: string | null
          numero_facture: string
          observations: string | null
          periode_debut: string
          periode_fin: string
          prix_once_fcfa: number
          quantite_oz: number
          retenue_source_fcfa: number
          retenue_source_taux: number
          statut: string
          statut_certification: string
          taxe_dev_comm_montant_fcfa: number
          taxe_dev_comm_taux: number
          titre_pct: number | null
          tva_montant_fcfa: number
          tva_taux: number
          unite: string
          updated_at: string
        }
        Insert: {
          achat_id: string
          certification_date?: string | null
          certification_reference?: string | null
          conditions_paiement?: string
          created_at?: string
          created_by?: string | null
          date_echeance: string
          date_emission?: string
          demande_id?: string | null
          devise?: string
          facture_remplacee_id?: string | null
          id?: string
          mining_company_id: string
          montant_ajustements_fcfa?: number
          montant_ht_fcfa: number
          montant_paye_fcfa?: number
          montant_ttc_fcfa: number
          motif_annulation?: string | null
          numero_facture: string
          observations?: string | null
          periode_debut: string
          periode_fin: string
          prix_once_fcfa: number
          quantite_oz: number
          retenue_source_fcfa?: number
          retenue_source_taux?: number
          statut?: string
          statut_certification?: string
          taxe_dev_comm_montant_fcfa?: number
          taxe_dev_comm_taux?: number
          titre_pct?: number | null
          tva_montant_fcfa?: number
          tva_taux?: number
          unite?: string
          updated_at?: string
        }
        Update: {
          achat_id?: string
          certification_date?: string | null
          certification_reference?: string | null
          conditions_paiement?: string
          created_at?: string
          created_by?: string | null
          date_echeance?: string
          date_emission?: string
          demande_id?: string | null
          devise?: string
          facture_remplacee_id?: string | null
          id?: string
          mining_company_id?: string
          montant_ajustements_fcfa?: number
          montant_ht_fcfa?: number
          montant_paye_fcfa?: number
          montant_ttc_fcfa?: number
          motif_annulation?: string | null
          numero_facture?: string
          observations?: string | null
          periode_debut?: string
          periode_fin?: string
          prix_once_fcfa?: number
          quantite_oz?: number
          retenue_source_fcfa?: number
          retenue_source_taux?: number
          statut?: string
          statut_certification?: string
          taxe_dev_comm_montant_fcfa?: number
          taxe_dev_comm_taux?: number
          titre_pct?: number | null
          tva_montant_fcfa?: number
          tva_taux?: number
          unite?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_factures_achat_achat_id_fkey"
            columns: ["achat_id"]
            isOneToOne: false
            referencedRelation: "snp_achats_mines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_factures_achat_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "snp_demandes_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_factures_achat_facture_remplacee_id_fkey"
            columns: ["facture_remplacee_id"]
            isOneToOne: false
            referencedRelation: "snp_factures_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_factures_achat_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_factures_achat_lignes: {
        Row: {
          created_at: string
          designation: string
          facture_id: string
          id: string
          montant_ht_fcfa: number
          prix_unitaire_fcfa: number
          quantite: number
          rang: number
          titre_pct: number | null
          unite: string
        }
        Insert: {
          created_at?: string
          designation: string
          facture_id: string
          id?: string
          montant_ht_fcfa: number
          prix_unitaire_fcfa: number
          quantite: number
          rang?: number
          titre_pct?: number | null
          unite?: string
        }
        Update: {
          created_at?: string
          designation?: string
          facture_id?: string
          id?: string
          montant_ht_fcfa?: number
          prix_unitaire_fcfa?: number
          quantite?: number
          rang?: number
          titre_pct?: number | null
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_factures_achat_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "snp_factures_achat"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_factures_certification: {
        Row: {
          certification_reference: string | null
          certifiee_le: string | null
          created_at: string
          declenche_par: string | null
          erreur_technique: string | null
          facture_id: string
          fournisseur: string
          id: string
          reponse_code: string | null
          reponse_message: string | null
          requete_empreinte: string | null
          tentative: number
        }
        Insert: {
          certification_reference?: string | null
          certifiee_le?: string | null
          created_at?: string
          declenche_par?: string | null
          erreur_technique?: string | null
          facture_id: string
          fournisseur?: string
          id?: string
          reponse_code?: string | null
          reponse_message?: string | null
          requete_empreinte?: string | null
          tentative?: number
        }
        Update: {
          certification_reference?: string | null
          certifiee_le?: string | null
          created_at?: string
          declenche_par?: string | null
          erreur_technique?: string | null
          facture_id?: string
          fournisseur?: string
          id?: string
          reponse_code?: string | null
          reponse_message?: string | null
          requete_empreinte?: string | null
          tentative?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_factures_certification_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "snp_factures_achat"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_grand_livre_commercial: {
        Row: {
          conciliation_id: string | null
          contrepartie_id: string
          contrepartie_type: string
          created_at: string
          created_by: string | null
          devise: string
          id: string
          idempotency_key: string
          mining_company_id: string | null
          montant: number
          montant_xof: number | null
          motif: string | null
          reverses_entry_id: string | null
          sale_id: string | null
          sens: string
          source_id: string
          source_taux: string | null
          source_type: string
          taux_change: number | null
          taux_horodate: string | null
          type_mouvement: string
        }
        Insert: {
          conciliation_id?: string | null
          contrepartie_id: string
          contrepartie_type: string
          created_at?: string
          created_by?: string | null
          devise?: string
          id?: string
          idempotency_key: string
          mining_company_id?: string | null
          montant: number
          montant_xof?: number | null
          motif?: string | null
          reverses_entry_id?: string | null
          sale_id?: string | null
          sens: string
          source_id: string
          source_taux?: string | null
          source_type: string
          taux_change?: number | null
          taux_horodate?: string | null
          type_mouvement: string
        }
        Update: {
          conciliation_id?: string | null
          contrepartie_id?: string
          contrepartie_type?: string
          created_at?: string
          created_by?: string | null
          devise?: string
          id?: string
          idempotency_key?: string
          mining_company_id?: string | null
          montant?: number
          montant_xof?: number | null
          motif?: string | null
          reverses_entry_id?: string | null
          sale_id?: string | null
          sens?: string
          source_id?: string
          source_taux?: string | null
          source_type?: string
          taux_change?: number | null
          taux_horodate?: string | null
          type_mouvement?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_grand_livre_commercial_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_commercial_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_commercial_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "snp_grand_livre_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_commercial_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_commercial_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      snp_grand_livre_fiscal: {
        Row: {
          calcul_id: string | null
          code_taxe: string
          conciliation_id: string | null
          created_at: string
          created_by: string | null
          devise: string
          exercice: string | null
          facture_id: string | null
          id: string
          idempotency_key: string
          mining_company_id: string
          montant: number
          motif: string | null
          periode: string | null
          regle_id: string | null
          reverses_entry_id: string | null
          sale_id: string | null
          sens: string
          statut_credit: string | null
          type_mouvement: string
        }
        Insert: {
          calcul_id?: string | null
          code_taxe: string
          conciliation_id?: string | null
          created_at?: string
          created_by?: string | null
          devise?: string
          exercice?: string | null
          facture_id?: string | null
          id?: string
          idempotency_key: string
          mining_company_id: string
          montant: number
          motif?: string | null
          periode?: string | null
          regle_id?: string | null
          reverses_entry_id?: string | null
          sale_id?: string | null
          sens: string
          statut_credit?: string | null
          type_mouvement: string
        }
        Update: {
          calcul_id?: string | null
          code_taxe?: string
          conciliation_id?: string | null
          created_at?: string
          created_by?: string | null
          devise?: string
          exercice?: string | null
          facture_id?: string | null
          id?: string
          idempotency_key?: string
          mining_company_id?: string
          montant?: number
          motif?: string | null
          periode?: string | null
          regle_id?: string | null
          reverses_entry_id?: string | null
          sale_id?: string | null
          sens?: string
          statut_credit?: string | null
          type_mouvement?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_grand_livre_fiscal_calcul_id_fkey"
            columns: ["calcul_id"]
            isOneToOne: false
            referencedRelation: "snp_calculs_fiscaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_fiscal_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_fiscal_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_fiscal_regle_id_fkey"
            columns: ["regle_id"]
            isOneToOne: false
            referencedRelation: "snp_regles_fiscales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_fiscal_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "snp_grand_livre_fiscal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_fiscal_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_grand_livre_fiscal_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      snp_modules: {
        Row: {
          code: string
          created_at: string
          description: string | null
          est_actif: boolean | null
          est_visible_menu: boolean | null
          icone: string | null
          id: string
          nom: string
          ordre: number | null
          parent_id: string | null
          permissions_requises: string[] | null
          route: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          est_actif?: boolean | null
          est_visible_menu?: boolean | null
          icone?: string | null
          id?: string
          nom: string
          ordre?: number | null
          parent_id?: string | null
          permissions_requises?: string[] | null
          route?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          est_actif?: boolean | null
          est_visible_menu?: boolean | null
          icone?: string | null
          id?: string
          nom?: string
          ordre?: number | null
          parent_id?: string | null
          permissions_requises?: string[] | null
          route?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_modules_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "snp_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_notifications: {
        Row: {
          chemin: string | null
          cle_dedoublonnage: string | null
          created_at: string
          destinataire_id: string
          emise_par: string | null
          faits: Json | null
          gravite: string
          id: string
          lue: boolean
          lue_le: string | null
          message: string
          objet_domaine: string | null
          objet_id: string | null
          titre: string
          type: string
        }
        Insert: {
          chemin?: string | null
          cle_dedoublonnage?: string | null
          created_at?: string
          destinataire_id: string
          emise_par?: string | null
          faits?: Json | null
          gravite?: string
          id?: string
          lue?: boolean
          lue_le?: string | null
          message: string
          objet_domaine?: string | null
          objet_id?: string | null
          titre: string
          type?: string
        }
        Update: {
          chemin?: string | null
          cle_dedoublonnage?: string | null
          created_at?: string
          destinataire_id?: string
          emise_par?: string | null
          faits?: Json | null
          gravite?: string
          id?: string
          lue?: boolean
          lue_le?: string | null
          message?: string
          objet_domaine?: string | null
          objet_id?: string | null
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_notifications_destinataire_id_fkey"
            columns: ["destinataire_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_notifications_emise_par_fkey"
            columns: ["emise_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_notifications_livraisons: {
        Row: {
          canal: string
          created_at: string
          destinataire: string
          envoye_le: string | null
          id: string
          message_erreur: string | null
          notification_id: string
          statut: string
          tentatives: number
          updated_at: string
        }
        Insert: {
          canal: string
          created_at?: string
          destinataire: string
          envoye_le?: string | null
          id?: string
          message_erreur?: string | null
          notification_id: string
          statut?: string
          tentatives?: number
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          destinataire?: string
          envoye_le?: string | null
          id?: string
          message_erreur?: string | null
          notification_id?: string
          statut?: string
          tentatives?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_notifications_livraisons_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "snp_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_organizations: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          mining_company_id: string | null
          name: string
          organization_type: string
          source_artisan_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          mining_company_id?: string | null
          name: string
          organization_type: string
          source_artisan_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          mining_company_id?: string | null
          name?: string
          organization_type?: string
          source_artisan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_organizations_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_organizations_source_artisan_id_fkey"
            columns: ["source_artisan_id"]
            isOneToOne: false
            referencedRelation: "snp_artisans_miniers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_organizations_source_artisan_id_fkey"
            columns: ["source_artisan_id"]
            isOneToOne: false
            referencedRelation: "v_artisan_paiements_resume"
            referencedColumns: ["artisan_id"]
          },
          {
            foreignKeyName: "snp_organizations_source_artisan_id_fkey"
            columns: ["source_artisan_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["artisan_id"]
          },
        ]
      }
      snp_payment_operation_ledger: {
        Row: {
          actor_id: string
          aggregate_id: string
          capability_code: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          operation: string
          payment_id: string | null
          request_fingerprint: string
          result: Json | null
          sale_id: string | null
        }
        Insert: {
          actor_id: string
          aggregate_id: string
          capability_code: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          operation: string
          payment_id?: string | null
          request_fingerprint: string
          result?: Json | null
          sale_id?: string | null
        }
        Update: {
          actor_id?: string
          aggregate_id?: string
          capability_code?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          operation?: string
          payment_id?: string | null
          request_fingerprint?: string
          result?: Json | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_payment_operation_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_payment_operation_ledger_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_payment_operation_ledger_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      snp_payment_proofs: {
        Row: {
          created_at: string
          customer_id: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          idempotency_key: string
          mime_type: string
          payment_id: string
          request_fingerprint: string
          sale_id: string
          sha256: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          idempotency_key: string
          mime_type: string
          payment_id: string
          request_fingerprint: string
          sale_id: string
          sha256: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          idempotency_key?: string
          mime_type?: string
          payment_id?: string
          request_fingerprint?: string
          sale_id?: string
          sha256?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_payment_proofs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_payment_proofs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_payment_proofs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_payment_proofs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      snp_plans_achat: {
        Row: {
          annee: number
          created_at: string
          created_by: string | null
          date_annulation: string | null
          date_cloture: string | null
          date_soumission: string | null
          date_validation: string | null
          devise: string
          id: string
          mode_repartition: string
          mois: number
          montant_previsionnel_fcfa: number
          motif_annulation: string | null
          numero_plan: string
          observations: string | null
          pourcentage_global: number | null
          prix_once_global_fcfa: number | null
          quantite_cible_oz: number | null
          quantite_repartie_oz: number
          statut: string
          unite: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          annee: number
          created_at?: string
          created_by?: string | null
          date_annulation?: string | null
          date_cloture?: string | null
          date_soumission?: string | null
          date_validation?: string | null
          devise?: string
          id?: string
          mode_repartition?: string
          mois: number
          montant_previsionnel_fcfa?: number
          motif_annulation?: string | null
          numero_plan: string
          observations?: string | null
          pourcentage_global?: number | null
          prix_once_global_fcfa?: number | null
          quantite_cible_oz?: number | null
          quantite_repartie_oz?: number
          statut?: string
          unite?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          annee?: number
          created_at?: string
          created_by?: string | null
          date_annulation?: string | null
          date_cloture?: string | null
          date_soumission?: string | null
          date_validation?: string | null
          devise?: string
          id?: string
          mode_repartition?: string
          mois?: number
          montant_previsionnel_fcfa?: number
          motif_annulation?: string | null
          numero_plan?: string
          observations?: string | null
          pourcentage_global?: number | null
          prix_once_global_fcfa?: number | null
          quantite_cible_oz?: number | null
          quantite_repartie_oz?: number
          statut?: string
          unite?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      snp_plans_achat_lignes: {
        Row: {
          ajustee_manuellement: boolean
          contrat_id: string | null
          cours_reference_usd: number | null
          created_at: string
          deja_engage_oz: number
          depassement_motif: string | null
          depassement_oz: number
          id: string
          mining_company_id: string
          montant_estime_fcfa: number
          observations: string | null
          periode_debut: string
          periode_fin: string
          plan_id: string
          pourcentage_applique: number | null
          prix_once_fcfa: number
          production_declaree_oz: number
          production_eligible_oz: number
          production_validee_oz: number
          quantite_contractuelle_oz: number
          quantite_proposee_oz: number
          reliquat_anterieur_oz: number
          statut: string
          taux_usd_xof: number | null
          titre_moyen_pct: number | null
          updated_at: string
        }
        Insert: {
          ajustee_manuellement?: boolean
          contrat_id?: string | null
          cours_reference_usd?: number | null
          created_at?: string
          deja_engage_oz?: number
          depassement_motif?: string | null
          depassement_oz?: number
          id?: string
          mining_company_id: string
          montant_estime_fcfa?: number
          observations?: string | null
          periode_debut: string
          periode_fin: string
          plan_id: string
          pourcentage_applique?: number | null
          prix_once_fcfa?: number
          production_declaree_oz?: number
          production_eligible_oz?: number
          production_validee_oz?: number
          quantite_contractuelle_oz?: number
          quantite_proposee_oz?: number
          reliquat_anterieur_oz?: number
          statut?: string
          taux_usd_xof?: number | null
          titre_moyen_pct?: number | null
          updated_at?: string
        }
        Update: {
          ajustee_manuellement?: boolean
          contrat_id?: string | null
          cours_reference_usd?: number | null
          created_at?: string
          deja_engage_oz?: number
          depassement_motif?: string | null
          depassement_oz?: number
          id?: string
          mining_company_id?: string
          montant_estime_fcfa?: number
          observations?: string | null
          periode_debut?: string
          periode_fin?: string
          plan_id?: string
          pourcentage_applique?: number | null
          prix_once_fcfa?: number
          production_declaree_oz?: number
          production_eligible_oz?: number
          production_validee_oz?: number
          quantite_contractuelle_oz?: number
          quantite_proposee_oz?: number
          reliquat_anterieur_oz?: number
          statut?: string
          taux_usd_xof?: number | null
          titre_moyen_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_plans_achat_lignes_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_plans_achat_lignes_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_plans_achat_lignes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "snp_plans_achat"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_reglements_achat: {
        Row: {
          banque: string | null
          compte_bancaire_id: string | null
          coordonnees_utilisees: Json | null
          created_at: string
          created_by: string | null
          date_execution: string | null
          date_execution_prevue: string | null
          date_preparation: string | null
          date_rapprochement: string | null
          date_reglement: string
          date_soumission: string | null
          date_validation: string | null
          devise: string
          execute_par: string | null
          id: string
          mining_company_id: string
          mode_reglement: string
          montant_affecte_fcfa: number
          montant_fcfa: number
          motif_rejet: string | null
          objet: string | null
          observations: string | null
          prepare_par: string | null
          preuve_url: string | null
          rapproche_par: string | null
          reception_motif: string | null
          reception_repondu_le: string | null
          reception_repondu_par: string | null
          reception_statut: string
          reference_bancaire: string | null
          reference_interne: string | null
          reference_reglement: string
          soumis_par: string | null
          statut: string
          updated_at: string
          valide_par: string | null
        }
        Insert: {
          banque?: string | null
          compte_bancaire_id?: string | null
          coordonnees_utilisees?: Json | null
          created_at?: string
          created_by?: string | null
          date_execution?: string | null
          date_execution_prevue?: string | null
          date_preparation?: string | null
          date_rapprochement?: string | null
          date_reglement?: string
          date_soumission?: string | null
          date_validation?: string | null
          devise?: string
          execute_par?: string | null
          id?: string
          mining_company_id: string
          mode_reglement?: string
          montant_affecte_fcfa?: number
          montant_fcfa: number
          motif_rejet?: string | null
          objet?: string | null
          observations?: string | null
          prepare_par?: string | null
          preuve_url?: string | null
          rapproche_par?: string | null
          reception_motif?: string | null
          reception_repondu_le?: string | null
          reception_repondu_par?: string | null
          reception_statut?: string
          reference_bancaire?: string | null
          reference_interne?: string | null
          reference_reglement: string
          soumis_par?: string | null
          statut?: string
          updated_at?: string
          valide_par?: string | null
        }
        Update: {
          banque?: string | null
          compte_bancaire_id?: string | null
          coordonnees_utilisees?: Json | null
          created_at?: string
          created_by?: string | null
          date_execution?: string | null
          date_execution_prevue?: string | null
          date_preparation?: string | null
          date_rapprochement?: string | null
          date_reglement?: string
          date_soumission?: string | null
          date_validation?: string | null
          devise?: string
          execute_par?: string | null
          id?: string
          mining_company_id?: string
          mode_reglement?: string
          montant_affecte_fcfa?: number
          montant_fcfa?: number
          motif_rejet?: string | null
          objet?: string | null
          observations?: string | null
          prepare_par?: string | null
          preuve_url?: string | null
          rapproche_par?: string | null
          reception_motif?: string | null
          reception_repondu_le?: string | null
          reception_repondu_par?: string | null
          reception_statut?: string
          reference_bancaire?: string | null
          reference_interne?: string | null
          reference_reglement?: string
          soumis_par?: string | null
          statut?: string
          updated_at?: string
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_reglements_achat_compte_bancaire_id_fkey"
            columns: ["compte_bancaire_id"]
            isOneToOne: false
            referencedRelation: "stakeholder_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_reglements_achat_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_reglements_affectations: {
        Row: {
          affecte_par: string | null
          annulee_par: string | null
          created_at: string
          date_affectation: string
          date_annulation: string | null
          facture_id: string
          id: string
          mode_affectation: string
          montant_affecte_fcfa: number
          motif_annulation: string | null
          observations: string | null
          reglement_id: string
          statut: string
        }
        Insert: {
          affecte_par?: string | null
          annulee_par?: string | null
          created_at?: string
          date_affectation?: string
          date_annulation?: string | null
          facture_id: string
          id?: string
          mode_affectation?: string
          montant_affecte_fcfa: number
          motif_annulation?: string | null
          observations?: string | null
          reglement_id: string
          statut?: string
        }
        Update: {
          affecte_par?: string | null
          annulee_par?: string | null
          created_at?: string
          date_affectation?: string
          date_annulation?: string | null
          facture_id?: string
          id?: string
          mode_affectation?: string
          montant_affecte_fcfa?: number
          motif_annulation?: string | null
          observations?: string | null
          reglement_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_reglements_affectations_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "snp_factures_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_reglements_affectations_reglement_id_fkey"
            columns: ["reglement_id"]
            isOneToOne: false
            referencedRelation: "snp_reglements_achat"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_reglements_preuves: {
        Row: {
          ajoute_le: string
          ajoute_par: string | null
          banque_emettrice: string | null
          commentaire: string | null
          date_emission: string | null
          empreinte_sha256: string | null
          fichier_url: string
          id: string
          motif_rejet: string | null
          nom_origine: string
          reference_document: string | null
          reglement_id: string
          statut_verification: string
          taille_octets: number
          type_document: string
          type_mime: string
          verifiee_le: string | null
          verifiee_par: string | null
        }
        Insert: {
          ajoute_le?: string
          ajoute_par?: string | null
          banque_emettrice?: string | null
          commentaire?: string | null
          date_emission?: string | null
          empreinte_sha256?: string | null
          fichier_url: string
          id?: string
          motif_rejet?: string | null
          nom_origine: string
          reference_document?: string | null
          reglement_id: string
          statut_verification?: string
          taille_octets: number
          type_document: string
          type_mime: string
          verifiee_le?: string | null
          verifiee_par?: string | null
        }
        Update: {
          ajoute_le?: string
          ajoute_par?: string | null
          banque_emettrice?: string | null
          commentaire?: string | null
          date_emission?: string | null
          empreinte_sha256?: string | null
          fichier_url?: string
          id?: string
          motif_rejet?: string | null
          nom_origine?: string
          reference_document?: string | null
          reglement_id?: string
          statut_verification?: string
          taille_octets?: number
          type_document?: string
          type_mime?: string
          verifiee_le?: string | null
          verifiee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_reglements_preuves_reglement_id_fkey"
            columns: ["reglement_id"]
            isOneToOne: false
            referencedRelation: "snp_reglements_achat"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_regles_fiscales: {
        Row: {
          abroge_le: string | null
          abroge_par: string | null
          approuve_le: string | null
          approuve_par: string | null
          assiette: string
          categorie_acheteur: string
          code_taxe: string
          commentaire: string | null
          cree_le: string
          cree_par: string | null
          date_effet: string
          date_fin: string | null
          devise_seuil: string | null
          id: string
          libelle: string
          mode_calcul: string
          montant_forfaitaire: number | null
          profil_vendeur: string
          reference_reglementaire: string | null
          seuil_max: number | null
          seuil_min: number | null
          statut: string
          taux: number | null
          unite_seuil: string | null
          updated_at: string
        }
        Insert: {
          abroge_le?: string | null
          abroge_par?: string | null
          approuve_le?: string | null
          approuve_par?: string | null
          assiette: string
          categorie_acheteur?: string
          code_taxe: string
          commentaire?: string | null
          cree_le?: string
          cree_par?: string | null
          date_effet: string
          date_fin?: string | null
          devise_seuil?: string | null
          id?: string
          libelle: string
          mode_calcul: string
          montant_forfaitaire?: number | null
          profil_vendeur?: string
          reference_reglementaire?: string | null
          seuil_max?: number | null
          seuil_min?: number | null
          statut?: string
          taux?: number | null
          unite_seuil?: string | null
          updated_at?: string
        }
        Update: {
          abroge_le?: string | null
          abroge_par?: string | null
          approuve_le?: string | null
          approuve_par?: string | null
          assiette?: string
          categorie_acheteur?: string
          code_taxe?: string
          commentaire?: string | null
          cree_le?: string
          cree_par?: string | null
          date_effet?: string
          date_fin?: string | null
          devise_seuil?: string | null
          id?: string
          libelle?: string
          mode_calcul?: string
          montant_forfaitaire?: number | null
          profil_vendeur?: string
          reference_reglementaire?: string | null
          seuil_max?: number | null
          seuil_min?: number | null
          statut?: string
          taux?: number | null
          unite_seuil?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_regles_fiscales_abroge_par_fkey"
            columns: ["abroge_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_regles_fiscales_approuve_par_fkey"
            columns: ["approuve_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_regles_fiscales_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_requisitions: {
        Row: {
          accord_mine: boolean | null
          accord_recu_le: string | null
          accuse_reception_le: string | null
          accuse_reception_par: string | null
          autorisee_par: string | null
          autorite_origine: string | null
          conditions_analyse: string | null
          conditions_transport: string | null
          confidentialite: string
          contestation_motif: string | null
          contestation_recue_le: string | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          date_autorisation: string | null
          date_cloture: string | null
          date_effet: string | null
          date_executoire: string | null
          date_notification: string | null
          date_signature_acte: string | null
          delai_mise_a_disposition_jours: number | null
          equipe: string | null
          id: string
          imputation_contractuelle: string | null
          imputation_decidee_le: string | null
          imputation_decidee_par: string | null
          imputation_motif: string | null
          lieu_enlevement: string | null
          lieu_stockage: string | null
          methode_prix: string
          mining_company_id: string | null
          modalites_enlevement: string | null
          modalites_paiement: string
          motif_statut: string | null
          nature_acte: string | null
          objet: string
          observations: string | null
          observations_mine: string | null
          observations_recues_le: string | null
          partenaire_type: string
          periode_debut: string | null
          periode_fin: string | null
          pourcentage_production: number | null
          prix_once_fcfa: number | null
          produits_concernes: string | null
          quantite_oz: number | null
          reference: string
          reference_acte: string | null
          regime_juridique: string
          responsable_id: string | null
          site_id: string | null
          statut: string
          teneur_estimee_pct: number | null
          type_requisition: string
          unite: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accord_mine?: boolean | null
          accord_recu_le?: string | null
          accuse_reception_le?: string | null
          accuse_reception_par?: string | null
          autorisee_par?: string | null
          autorite_origine?: string | null
          conditions_analyse?: string | null
          conditions_transport?: string | null
          confidentialite?: string
          contestation_motif?: string | null
          contestation_recue_le?: string | null
          contrat_id?: string | null
          created_at?: string
          created_by?: string | null
          date_autorisation?: string | null
          date_cloture?: string | null
          date_effet?: string | null
          date_executoire?: string | null
          date_notification?: string | null
          date_signature_acte?: string | null
          delai_mise_a_disposition_jours?: number | null
          equipe?: string | null
          id?: string
          imputation_contractuelle?: string | null
          imputation_decidee_le?: string | null
          imputation_decidee_par?: string | null
          imputation_motif?: string | null
          lieu_enlevement?: string | null
          lieu_stockage?: string | null
          methode_prix?: string
          mining_company_id?: string | null
          modalites_enlevement?: string | null
          modalites_paiement?: string
          motif_statut?: string | null
          nature_acte?: string | null
          objet: string
          observations?: string | null
          observations_mine?: string | null
          observations_recues_le?: string | null
          partenaire_type?: string
          periode_debut?: string | null
          periode_fin?: string | null
          pourcentage_production?: number | null
          prix_once_fcfa?: number | null
          produits_concernes?: string | null
          quantite_oz?: number | null
          reference: string
          reference_acte?: string | null
          regime_juridique?: string
          responsable_id?: string | null
          site_id?: string | null
          statut?: string
          teneur_estimee_pct?: number | null
          type_requisition?: string
          unite?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accord_mine?: boolean | null
          accord_recu_le?: string | null
          accuse_reception_le?: string | null
          accuse_reception_par?: string | null
          autorisee_par?: string | null
          autorite_origine?: string | null
          conditions_analyse?: string | null
          conditions_transport?: string | null
          confidentialite?: string
          contestation_motif?: string | null
          contestation_recue_le?: string | null
          contrat_id?: string | null
          created_at?: string
          created_by?: string | null
          date_autorisation?: string | null
          date_cloture?: string | null
          date_effet?: string | null
          date_executoire?: string | null
          date_notification?: string | null
          date_signature_acte?: string | null
          delai_mise_a_disposition_jours?: number | null
          equipe?: string | null
          id?: string
          imputation_contractuelle?: string | null
          imputation_decidee_le?: string | null
          imputation_decidee_par?: string | null
          imputation_motif?: string | null
          lieu_enlevement?: string | null
          lieu_stockage?: string | null
          methode_prix?: string
          mining_company_id?: string | null
          modalites_enlevement?: string | null
          modalites_paiement?: string
          motif_statut?: string | null
          nature_acte?: string | null
          objet?: string
          observations?: string | null
          observations_mine?: string | null
          observations_recues_le?: string | null
          partenaire_type?: string
          periode_debut?: string | null
          periode_fin?: string | null
          pourcentage_production?: number | null
          prix_once_fcfa?: number | null
          produits_concernes?: string | null
          quantite_oz?: number | null
          reference?: string
          reference_acte?: string | null
          regime_juridique?: string
          responsable_id?: string | null
          site_id?: string | null
          statut?: string
          teneur_estimee_pct?: number | null
          type_requisition?: string
          unite?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_requisitions_autorisee_par_fkey"
            columns: ["autorisee_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "snp_contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_imputation_decidee_par_fkey"
            columns: ["imputation_decidee_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_requisitions_documents: {
        Row: {
          categorie: string
          chemin: string
          created_at: string
          created_by: string | null
          date_document: string | null
          id: string
          intitule: string
          motif_suppression: string | null
          observations: string | null
          requisition_id: string
          statut: string
          supprime_le: string | null
          supprime_par: string | null
          taille_octets: number | null
          type_mime: string | null
          updated_at: string
          version: number
        }
        Insert: {
          categorie: string
          chemin: string
          created_at?: string
          created_by?: string | null
          date_document?: string | null
          id?: string
          intitule: string
          motif_suppression?: string | null
          observations?: string | null
          requisition_id: string
          statut?: string
          supprime_le?: string | null
          supprime_par?: string | null
          taille_octets?: number | null
          type_mime?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          categorie?: string
          chemin?: string
          created_at?: string
          created_by?: string | null
          date_document?: string | null
          id?: string
          intitule?: string
          motif_suppression?: string | null
          observations?: string | null
          requisition_id?: string
          statut?: string
          supprime_le?: string | null
          supprime_par?: string | null
          taille_octets?: number | null
          type_mime?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snp_requisitions_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_documents_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "snp_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_documents_supprime_par_fkey"
            columns: ["supprime_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_requisitions_enlevements: {
        Row: {
          arrivee_destination: string | null
          constat_contradictoire: boolean
          created_at: string
          created_by: string | null
          date_prevue: string | null
          date_reelle: string | null
          dispositifs_securite: string | null
          equipe_sonasp: string | null
          id: string
          incidents: string | null
          lieu: string | null
          moyens_transport: string | null
          nombre_colis: number | null
          numeros_scelles: string | null
          poids_brut_g: number | null
          poids_declare_g: number | null
          poids_net_g: number | null
          quantite_constatee_oz: number | null
          quantite_prevue_oz: number | null
          reference: string
          representants_mine: string | null
          requisition_id: string
          reserves: string | null
          statut: string
          tare_g: number | null
          teneur_constatee_pct: number | null
          updated_at: string
        }
        Insert: {
          arrivee_destination?: string | null
          constat_contradictoire?: boolean
          created_at?: string
          created_by?: string | null
          date_prevue?: string | null
          date_reelle?: string | null
          dispositifs_securite?: string | null
          equipe_sonasp?: string | null
          id?: string
          incidents?: string | null
          lieu?: string | null
          moyens_transport?: string | null
          nombre_colis?: number | null
          numeros_scelles?: string | null
          poids_brut_g?: number | null
          poids_declare_g?: number | null
          poids_net_g?: number | null
          quantite_constatee_oz?: number | null
          quantite_prevue_oz?: number | null
          reference: string
          representants_mine?: string | null
          requisition_id: string
          reserves?: string | null
          statut?: string
          tare_g?: number | null
          teneur_constatee_pct?: number | null
          updated_at?: string
        }
        Update: {
          arrivee_destination?: string | null
          constat_contradictoire?: boolean
          created_at?: string
          created_by?: string | null
          date_prevue?: string | null
          date_reelle?: string | null
          dispositifs_securite?: string | null
          equipe_sonasp?: string | null
          id?: string
          incidents?: string | null
          lieu?: string | null
          moyens_transport?: string | null
          nombre_colis?: number | null
          numeros_scelles?: string | null
          poids_brut_g?: number | null
          poids_declare_g?: number | null
          poids_net_g?: number | null
          quantite_constatee_oz?: number | null
          quantite_prevue_oz?: number | null
          reference?: string
          representants_mine?: string | null
          requisition_id?: string
          reserves?: string | null
          statut?: string
          tare_g?: number | null
          teneur_constatee_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_requisitions_enlevements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_enlevements_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "snp_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_requisitions_historique: {
        Row: {
          acteur_id: string | null
          commentaire: string | null
          id: string
          motif: string | null
          requisition_id: string
          statut_apres: string
          statut_avant: string | null
          survenu_le: string
        }
        Insert: {
          acteur_id?: string | null
          commentaire?: string | null
          id?: string
          motif?: string | null
          requisition_id: string
          statut_apres: string
          statut_avant?: string | null
          survenu_le?: string
        }
        Update: {
          acteur_id?: string | null
          commentaire?: string | null
          id?: string
          motif?: string | null
          requisition_id?: string
          statut_apres?: string
          statut_avant?: string | null
          survenu_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_requisitions_historique_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_historique_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "snp_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_requisitions_notifications: {
        Row: {
          accuse_le: string | null
          accuse_par: string | null
          canal: string
          contenu: string
          created_at: string
          destinataires: string
          envoye_le: string
          envoye_par: string | null
          id: string
          objet: string
          preuve_envoi: string | null
          preuve_reception: string | null
          relance_de: string | null
          requisition_id: string
        }
        Insert: {
          accuse_le?: string | null
          accuse_par?: string | null
          canal: string
          contenu: string
          created_at?: string
          destinataires: string
          envoye_le?: string
          envoye_par?: string | null
          id?: string
          objet: string
          preuve_envoi?: string | null
          preuve_reception?: string | null
          relance_de?: string | null
          requisition_id: string
        }
        Update: {
          accuse_le?: string | null
          accuse_par?: string | null
          canal?: string
          contenu?: string
          created_at?: string
          destinataires?: string
          envoye_le?: string
          envoye_par?: string | null
          id?: string
          objet?: string
          preuve_envoi?: string | null
          preuve_reception?: string | null
          relance_de?: string | null
          requisition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_requisitions_notifications_envoye_par_fkey"
            columns: ["envoye_par"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_notifications_relance_de_fkey"
            columns: ["relance_de"]
            isOneToOne: false
            referencedRelation: "snp_requisitions_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_requisitions_notifications_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "snp_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_role_capabilities: {
        Row: {
          capability_code: string
          created_at: string
          role: string
        }
        Insert: {
          capability_code: string
          created_at?: string
          role: string
        }
        Update: {
          capability_code?: string
          created_at?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_role_capabilities_capability_code_fkey"
            columns: ["capability_code"]
            isOneToOne: false
            referencedRelation: "snp_capability_catalog"
            referencedColumns: ["code"]
          },
        ]
      }
      snp_rpc_execution_allowlist: {
        Row: {
          function_name: unknown
          function_signature: string
          grantee: unknown
          migration_version: string
          purpose: string
        }
        Insert: {
          function_name: unknown
          function_signature: string
          grantee: unknown
          migration_version: string
          purpose: string
        }
        Update: {
          function_name?: unknown
          function_signature?: string
          grantee?: unknown
          migration_version?: string
          purpose?: string
        }
        Relationships: []
      }
      snp_user_capabilities: {
        Row: {
          allowed: boolean
          capability_code: string
          granted_at: string
          granted_by: string | null
          reason: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          allowed: boolean
          capability_code: string
          granted_at?: string
          granted_by?: string | null
          reason: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          allowed?: boolean
          capability_code?: string
          granted_at?: string
          granted_by?: string | null
          reason?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_user_capabilities_capability_code_fkey"
            columns: ["capability_code"]
            isOneToOne: false
            referencedRelation: "snp_capability_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "snp_user_capabilities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_user_organization_memberships: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          is_primary: boolean
          membership_role: string
          organization_id: string
          reason: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          is_primary?: boolean
          membership_role?: string
          organization_id: string
          reason: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          is_primary?: boolean
          membership_role?: string
          organization_id?: string
          reason?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snp_user_organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "snp_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_user_organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snp_ventes_evenements_audit: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          previous_status: string | null
          resulting_status: string
          sale_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          previous_status?: string | null
          resulting_status: string
          sale_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          previous_status?: string | null
          resulting_status?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_ventes_evenements_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_ventes_evenements_audit_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_ventes_evenements_audit_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      snp_ventes_lots: {
        Row: {
          achat_mine_id: string | null
          artisan_vente_id: string | null
          created_at: string
          created_by: string | null
          id: string
          quantite_oz: number
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          sale_id: string
          source_type: string
        }
        Insert: {
          achat_mine_id?: string | null
          artisan_vente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          quantite_oz: number
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          sale_id: string
          source_type: string
        }
        Update: {
          achat_mine_id?: string | null
          artisan_vente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          quantite_oz?: number
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          sale_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "snp_ventes_lots_achat_mine_id_fkey"
            columns: ["achat_mine_id"]
            isOneToOne: false
            referencedRelation: "snp_achats_mines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_ventes_lots_artisan_vente_id_fkey"
            columns: ["artisan_vente_id"]
            isOneToOne: false
            referencedRelation: "snp_artisan_ventes_or"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_ventes_lots_artisan_vente_id_fkey"
            columns: ["artisan_vente_id"]
            isOneToOne: false
            referencedRelation: "v_paiements_en_attente"
            referencedColumns: ["vente_id"]
          },
          {
            foreignKeyName: "snp_ventes_lots_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_ventes_lots_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snp_ventes_lots_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_price_analysis"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      snp_workflow_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          aggregate_id: string | null
          aggregate_type: string
          capability_code: string | null
          context: Json
          id: number
          occurred_at: string
          reason: string | null
          status_after: string | null
          status_before: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          aggregate_id?: string | null
          aggregate_type: string
          capability_code?: string | null
          context?: Json
          id?: never
          occurred_at?: string
          reason?: string | null
          status_after?: string | null
          status_before?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          aggregate_id?: string | null
          aggregate_type?: string
          capability_code?: string | null
          context?: Json
          id?: never
          occurred_at?: string
          reason?: string | null
          status_after?: string | null
          status_before?: string | null
        }
        Relationships: []
      }
      snp_workflow_notification_outbox: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          event_key: string
          event_type: string
          id: number
          last_error: string | null
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_key: string
          event_type: string
          id?: never
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_key?: string
          event_type?: string
          id?: never
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      stakeholder_activities: {
        Row: {
          activity_date: string | null
          activity_type: string
          amount: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          stakeholder_id: string
          stakeholder_type: string
          status: string | null
        }
        Insert: {
          activity_date?: string | null
          activity_type: string
          amount?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          stakeholder_id: string
          stakeholder_type: string
          status?: string | null
        }
        Update: {
          activity_date?: string | null
          activity_type?: string
          amount?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          stakeholder_id?: string
          stakeholder_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_bank_accounts: {
        Row: {
          account_currency: string
          account_holder: string | null
          account_name: string
          account_number: string
          bank_code: string | null
          bank_country: string
          bank_name: string
          branch_code: string | null
          branch_name: string | null
          created_at: string | null
          created_by: string | null
          iban: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          justificatif_url: string | null
          notes: string | null
          rib_key: string | null
          stakeholder_id: string
          stakeholder_type: string
          swift_code: string | null
          updated_at: string | null
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_currency?: string
          account_holder?: string | null
          account_name: string
          account_number: string
          bank_code?: string | null
          bank_country: string
          bank_name: string
          branch_code?: string | null
          branch_name?: string | null
          created_at?: string | null
          created_by?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          justificatif_url?: string | null
          notes?: string | null
          rib_key?: string | null
          stakeholder_id: string
          stakeholder_type: string
          swift_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_currency?: string
          account_holder?: string | null
          account_name?: string
          account_number?: string
          bank_code?: string | null
          bank_country?: string
          bank_name?: string
          branch_code?: string | null
          branch_name?: string | null
          created_at?: string | null
          created_by?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          justificatif_url?: string | null
          notes?: string | null
          rib_key?: string | null
          stakeholder_id?: string
          stakeholder_type?: string
          swift_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_contacts: {
        Row: {
          contact_email: string | null
          contact_mobile: string | null
          contact_name: string
          contact_phone: string | null
          contact_title: string | null
          created_at: string | null
          department: string | null
          id: string
          is_primary: boolean | null
          notes: string | null
          stakeholder_id: string
          stakeholder_type: string
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_mobile?: string | null
          contact_name: string
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          stakeholder_id: string
          stakeholder_type: string
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_mobile?: string | null
          contact_name?: string
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          stakeholder_id?: string
          stakeholder_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_parameters: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          parameter_key: string
          parameter_type: string
          parameter_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          parameter_key: string
          parameter_type: string
          parameter_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          parameter_key?: string
          parameter_type?: string
          parameter_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      trading_hours_config: {
        Row: {
          closing_time: string
          created_at: string | null
          days_of_operation: string[] | null
          id: string
          is_active: boolean | null
          market_name: string
          opening_time: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          closing_time: string
          created_at?: string | null
          days_of_operation?: string[] | null
          id?: string
          is_active?: boolean | null
          market_name: string
          opening_time: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          closing_time?: string
          created_at?: string | null
          days_of_operation?: string[] | null
          id?: string
          is_active?: boolean | null
          market_name?: string
          opening_time?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transport_companies: {
        Row: {
          address: string | null
          company_type: string
          contact_person: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          phone: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_type: string
          contact_person?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_type?: string
          contact_person?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transportation_details: {
        Row: {
          actual_arrival: string | null
          created_at: string | null
          departure_time: string | null
          driver_name: string | null
          driver_phone: string | null
          estimated_arrival: string | null
          gps_tracking_enabled: boolean | null
          id: string
          route_description: string | null
          seal_number: string | null
          seal_verified: boolean | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          actual_arrival?: string | null
          created_at?: string | null
          departure_time?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          estimated_arrival?: string | null
          gps_tracking_enabled?: boolean | null
          id?: string
          route_description?: string | null
          seal_number?: string | null
          seal_verified?: boolean | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          actual_arrival?: string | null
          created_at?: string | null
          departure_time?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          estimated_arrival?: string | null
          gps_tracking_enabled?: boolean | null
          id?: string
          route_description?: string | null
          seal_number?: string | null
          seal_verified?: boolean | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      unified_status_history: {
        Row: {
          action_description: string | null
          change_context: Database["public"]["Enums"]["status_change_context"]
          changed_at: string
          changed_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          mining_company_id: string | null
          new_status: string
          notes: string | null
          old_status: string | null
          user_agent: string | null
        }
        Insert: {
          action_description?: string | null
          change_context: Database["public"]["Enums"]["status_change_context"]
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          mining_company_id?: string | null
          new_status: string
          notes?: string | null
          old_status?: string | null
          user_agent?: string | null
        }
        Update: {
          action_description?: string | null
          change_context?: Database["public"]["Enums"]["status_change_context"]
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          mining_company_id?: string | null
          new_status?: string
          notes?: string | null
          old_status?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_status_history_mining_company_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_2fa_setup: {
        Row: {
          authenticator_app: string
          backup_codes: Json
          created_at: string | null
          id: string
          secret: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          authenticator_app?: string
          backup_codes?: Json
          created_at?: string | null
          id?: string
          secret: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          authenticator_app?: string
          backup_codes?: Json
          created_at?: string | null
          id?: string
          secret?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      user_acceptance_logs: {
        Row: {
          accepted_at: string | null
          accepted_cookies: boolean | null
          accepted_gdpr: boolean | null
          accepted_privacy: boolean | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_cookies?: boolean | null
          accepted_gdpr?: boolean | null
          accepted_privacy?: boolean | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_cookies?: boolean | null
          accepted_gdpr?: boolean | null
          accepted_privacy?: boolean | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activation_tokens: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          temporary_password: string | null
          token: string
          token_type: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          temporary_password?: string | null
          token: string
          token_type: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          temporary_password?: string | null
          token?: string
          token_type?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          action_type: string
          changes_summary: Json | null
          created_at: string | null
          description: string
          error_message: string | null
          id: string
          ip_address: string | null
          module_name: string
          resource_id: string | null
          resource_type: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          changes_summary?: Json | null
          created_at?: string | null
          description: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          module_name: string
          resource_id?: string | null
          resource_type?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          changes_summary?: Json | null
          created_at?: string | null
          description?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          module_name?: string
          resource_id?: string | null
          resource_type?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          default_password: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invitation_token: string
          invited_by: string | null
          phone: string | null
          role: string
          site_ids: string[] | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          default_password: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invitation_token: string
          invited_by?: string | null
          phone?: string | null
          role: string
          site_ids?: string[] | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          default_password?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invitation_token?: string
          invited_by?: string | null
          phone?: string | null
          role?: string
          site_ids?: string[] | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_read: boolean
          can_view: boolean
          can_write: boolean
          field_permissions: Json | null
          granted_at: string | null
          granted_by: string | null
          id: string
          module_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_read?: boolean
          can_view?: boolean
          can_write?: boolean
          field_permissions?: Json | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          module_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_read?: boolean
          can_view?: boolean
          can_write?: boolean
          field_permissions?: Json | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          module_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          account_activated: boolean | null
          account_locked: boolean
          account_locked_until: string | null
          activation_completed_at: string | null
          approval_notifications: boolean | null
          created_at: string | null
          department: string | null
          email: string
          email_notifications: boolean | null
          failed_login_attempts: number | null
          full_name: string | null
          id: string
          invitation_id: string | null
          is_active: boolean
          is_sales_approver: boolean
          job_title: string | null
          language: string | null
          language_preference: string | null
          last_activity_at: string | null
          last_login_at: string | null
          last_login_ip: string | null
          last_password_change: string | null
          locked_until: string | null
          mfa_enrolled_at: string | null
          mfa_reset_at: string | null
          mfa_reset_by: string | null
          mining_company_id: string | null
          must_change_password: boolean
          password_changed_at: string | null
          password_expiry_days: number | null
          password_must_change: boolean | null
          phone: string | null
          profile_picture_url: string | null
          role: string
          timezone: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
          version: number
        }
        Insert: {
          account_activated?: boolean | null
          account_locked?: boolean
          account_locked_until?: string | null
          activation_completed_at?: string | null
          approval_notifications?: boolean | null
          created_at?: string | null
          department?: string | null
          email: string
          email_notifications?: boolean | null
          failed_login_attempts?: number | null
          full_name?: string | null
          id: string
          invitation_id?: string | null
          is_active?: boolean
          is_sales_approver?: boolean
          job_title?: string | null
          language?: string | null
          language_preference?: string | null
          last_activity_at?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          last_password_change?: string | null
          locked_until?: string | null
          mfa_enrolled_at?: string | null
          mfa_reset_at?: string | null
          mfa_reset_by?: string | null
          mining_company_id?: string | null
          must_change_password?: boolean
          password_changed_at?: string | null
          password_expiry_days?: number | null
          password_must_change?: boolean | null
          phone?: string | null
          profile_picture_url?: string | null
          role?: string
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          account_activated?: boolean | null
          account_locked?: boolean
          account_locked_until?: string | null
          activation_completed_at?: string | null
          approval_notifications?: boolean | null
          created_at?: string | null
          department?: string | null
          email?: string
          email_notifications?: boolean | null
          failed_login_attempts?: number | null
          full_name?: string | null
          id?: string
          invitation_id?: string | null
          is_active?: boolean
          is_sales_approver?: boolean
          job_title?: string | null
          language?: string | null
          language_preference?: string | null
          last_activity_at?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          last_password_change?: string | null
          locked_until?: string | null
          mfa_enrolled_at?: string | null
          mfa_reset_at?: string | null
          mfa_reset_by?: string | null
          mining_company_id?: string | null
          must_change_password?: boolean
          password_changed_at?: string | null
          password_expiry_days?: number | null
          password_must_change?: boolean | null
          phone?: string | null
          profile_picture_url?: string | null
          role?: string
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "user_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_mfa_reset_by_fkey"
            columns: ["mfa_reset_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_type: string | null
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity_at: string
          location_country: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity_at?: string
          location_country?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity_at?: string
          location_country?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_site_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          is_primary: boolean | null
          site_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_primary?: boolean | null
          site_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_primary?: boolean | null
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_site_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_site_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_site_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inserted: {
        Row: {
          count: number | null
        }
        Insert: {
          count?: number | null
        }
        Update: {
          count?: number | null
        }
        Relationships: []
      }
      variance_investigations: {
        Row: {
          assigned_investigator_id: string | null
          closed_at: string | null
          created_at: string | null
          evidence_collected: Json | null
          financial_impact: number | null
          findings: string | null
          id: string
          investigation_status: string | null
          investigation_type: string | null
          opened_at: string | null
          receiving_record_id: string | null
          resolution: string | null
          responsible_party: string | null
        }
        Insert: {
          assigned_investigator_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          evidence_collected?: Json | null
          financial_impact?: number | null
          findings?: string | null
          id?: string
          investigation_status?: string | null
          investigation_type?: string | null
          opened_at?: string | null
          receiving_record_id?: string | null
          resolution?: string | null
          responsible_party?: string | null
        }
        Update: {
          assigned_investigator_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          evidence_collected?: Json | null
          financial_impact?: number | null
          findings?: string | null
          id?: string
          investigation_status?: string | null
          investigation_type?: string | null
          opened_at?: string | null
          receiving_record_id?: string | null
          resolution?: string | null
          responsible_party?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variance_investigations_receiving_record_id_fkey"
            columns: ["receiving_record_id"]
            isOneToOne: false
            referencedRelation: "receiving_records"
            referencedColumns: ["id"]
          },
        ]
      }
      variance_thresholds: {
        Row: {
          created_at: string | null
          id: string
          location: string
          max_variance_percentage: number
          metal_type: string
          requires_approval_above: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location: string
          max_variance_percentage: number
          metal_type: string
          requires_approval_above: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: string
          max_variance_percentage?: number
          metal_type?: string
          requires_approval_above?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      workflow_history: {
        Row: {
          change_type: Database["public"]["Enums"]["workflow_change_type"]
          changed_at: string | null
          changed_by: string | null
          changes_summary: string | null
          id: string
          new_config: Json | null
          previous_config: Json | null
          version: number
          workflow_template_id: string
        }
        Insert: {
          change_type: Database["public"]["Enums"]["workflow_change_type"]
          changed_at?: string | null
          changed_by?: string | null
          changes_summary?: string | null
          id?: string
          new_config?: Json | null
          previous_config?: Json | null
          version: number
          workflow_template_id: string
        }
        Update: {
          change_type?: Database["public"]["Enums"]["workflow_change_type"]
          changed_at?: string | null
          changed_by?: string | null
          changes_summary?: string | null
          id?: string
          new_config?: Json | null
          previous_config?: Json | null
          version?: number
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_history_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_statuses: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_final: boolean | null
          is_initial: boolean | null
          metadata: Json | null
          order_index: number
          status_color: string | null
          status_key: string
          status_label: string
          updated_at: string | null
          workflow_template_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_final?: boolean | null
          is_initial?: boolean | null
          metadata?: Json | null
          order_index?: number
          status_color?: string | null
          status_key: string
          status_label: string
          updated_at?: string | null
          workflow_template_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_final?: boolean | null
          is_initial?: boolean | null
          metadata?: Json | null
          order_index?: number
          status_color?: string | null
          status_key?: string
          status_label?: string
          updated_at?: string | null
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_statuses_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          mining_company_id: string | null
          name: string
          updated_at: string | null
          version: number | null
          workflow_type: Database["public"]["Enums"]["workflow_type"]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          mining_company_id?: string | null
          name: string
          updated_at?: string | null
          version?: number | null
          workflow_type: Database["public"]["Enums"]["workflow_type"]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          mining_company_id?: string | null
          name?: string
          updated_at?: string | null
          version?: number | null
          workflow_type?: Database["public"]["Enums"]["workflow_type"]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          approval_roles: string[] | null
          conditions: Json | null
          created_at: string | null
          from_status_id: string
          id: string
          requires_approval: boolean | null
          to_status_id: string
          transition_label: string | null
          workflow_template_id: string
        }
        Insert: {
          approval_roles?: string[] | null
          conditions?: Json | null
          created_at?: string | null
          from_status_id: string
          id?: string
          requires_approval?: boolean | null
          to_status_id: string
          transition_label?: string | null
          workflow_template_id: string
        }
        Update: {
          approval_roles?: string[] | null
          conditions?: Json | null
          created_at?: string | null
          from_status_id?: string
          id?: string
          requires_approval?: boolean | null
          to_status_id?: string
          transition_label?: string | null
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      assay_certificates_with_shipping: {
        Row: {
          approval_notes: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          certificate_date: string | null
          certificate_number: string | null
          created_at: string | null
          expedition_lot_number: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          fineness: number | null
          gold_content_gpt: number | null
          gold_content_percent: number | null
          gold_content_ppm: number | null
          id: string | null
          issuing_laboratory: string | null
          mime_type: string | null
          mining_company_country: string | null
          mining_company_id: string | null
          mining_company_name: string | null
          palladium_content_ppm: number | null
          parsed_at: string | null
          parsing_error: string | null
          parsing_status: string | null
          platinum_content_ppm: number | null
          prepared_at: string | null
          purity_percent: number | null
          sample_id: string | null
          sample_weight_grams: number | null
          shipped_at: string | null
          shipped_to_address: string | null
          shipped_to_company: string | null
          shipped_to_country: string | null
          shipping_created_at: string | null
          shipping_gross_weight: number | null
          shipping_preparation_id: string | null
          shipping_status: string | null
          shipping_weight: number | null
          silver_content_gpt: number | null
          silver_content_percent: number | null
          silver_content_ppm: number | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assay_certificates_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assay_certificates_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_presale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assay_certificates_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipments_for_refinery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assay_certificates_shipping_preparation"
            columns: ["shipping_preparation_id"]
            isOneToOne: false
            referencedRelation: "shipping_preparations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_production_with_metals: {
        Row: {
          bar_reference: string | null
          bullion_grams: number | null
          created_at: string | null
          created_by: string | null
          estimated_fineness_pct: number | null
          estimated_gold_pct: number | null
          estimated_oz: number | null
          estimated_silver_pct: number | null
          gold_content_grams: number | null
          gold_content_oz: number | null
          id: string | null
          mining_company_id: string | null
          notes: string | null
          production_date: string | null
          pure_gold_grams: number | null
          silver_content_grams: number | null
          silver_content_oz: number | null
          site_id: string | null
          status: Database["public"]["Enums"]["production_status_v2"] | null
          status_old_backup:
            | Database["public"]["Enums"]["production_status"]
            | null
          total_metal_content_grams: number | null
          total_metal_pct: number | null
          updated_at: string | null
        }
        Insert: {
          bar_reference?: string | null
          bullion_grams?: number | null
          created_at?: string | null
          created_by?: string | null
          estimated_fineness_pct?: number | null
          estimated_gold_pct?: number | null
          estimated_oz?: number | null
          estimated_silver_pct?: number | null
          gold_content_grams?: never
          gold_content_oz?: never
          id?: string | null
          mining_company_id?: string | null
          notes?: string | null
          production_date?: string | null
          pure_gold_grams?: number | null
          silver_content_grams?: number | null
          silver_content_oz?: never
          site_id?: string | null
          status?: Database["public"]["Enums"]["production_status_v2"] | null
          status_old_backup?:
            | Database["public"]["Enums"]["production_status"]
            | null
          total_metal_content_grams?: never
          total_metal_pct?: never
          updated_at?: string | null
        }
        Update: {
          bar_reference?: string | null
          bullion_grams?: number | null
          created_at?: string | null
          created_by?: string | null
          estimated_fineness_pct?: number | null
          estimated_gold_pct?: number | null
          estimated_oz?: number | null
          estimated_silver_pct?: number | null
          gold_content_grams?: never
          gold_content_oz?: never
          id?: string | null
          mining_company_id?: string | null
          notes?: string | null
          production_date?: string | null
          pure_gold_grams?: number | null
          silver_content_grams?: number | null
          silver_content_oz?: never
          site_id?: string | null
          status?: Database["public"]["Enums"]["production_status_v2"] | null
          status_old_backup?:
            | Database["public"]["Enums"]["production_status"]
            | null
          total_metal_content_grams?: never
          total_metal_pct?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_production_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rate_comparison: {
        Row: {
          ask_rate: number | null
          avg_rate: number | null
          bid_ask_spread: number | null
          bid_rate: number | null
          currency_pair: string | null
          deviation_from_avg_pct: number | null
          id: string | null
          market_spread: number | null
          max_rate: number | null
          min_rate: number | null
          notes: string | null
          rate: number | null
          rate_date: string | null
          rate_position: string | null
          source_code: string | null
          source_count: number | null
          source_country: string | null
          source_id: string | null
          source_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_daily_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "fx_rate_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_sales_settings_view: {
        Row: {
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          customer_id: string | null
          customer_name: string | null
          effective_date: string | null
          id: string | null
          is_active: boolean | null
          max_stock_percentage: number | null
          mining_company_abbr: string | null
          mining_company_id: string | null
          mining_company_name: string | null
          notes: string | null
          refining_fees_paid_by_customer: boolean | null
          sale_method: string | null
          transport_fees_paid_by_customer: boolean | null
          updated_at: string | null
          updated_by: string | null
          updated_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gold_sales_settings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_sales_settings_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments_for_presale: {
        Row: {
          bullion_grams: number | null
          created_at: string | null
          created_by: string | null
          daily_production_id: string | null
          estimated_fineness_pct: number | null
          estimated_oz: number | null
          expedition_lot_number: string | null
          export_license_id: string | null
          freight_company_id: string | null
          id: string | null
          license_id: string | null
          mining_company_id: string | null
          notes: string | null
          packing_list_document_id: string | null
          packing_list_url: string | null
          prepared_at: string | null
          production_date: string | null
          pure_gold_grams: number | null
          refinery_id: string | null
          seal_number: string | null
          shipped_at: string | null
          shipped_to_address: string | null
          shipped_to_company: string | null
          shipped_to_country: string | null
          status:
            | Database["public"]["Enums"]["shipping_preparation_status"]
            | null
          status_old_backup: string | null
          total_boxes: number | null
          total_gross_weight_grams: number | null
          total_net_weight_grams: number | null
          total_weight_oz: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_export_license_company_fkey"
            columns: ["export_license_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id", "mining_company_id"]
          },
          {
            foreignKeyName: "shipping_preparations_daily_production_id_fkey"
            columns: ["daily_production_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_daily_production_id_fkey"
            columns: ["daily_production_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_export_license_id_fkey"
            columns: ["export_license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_freight_company_id_fkey"
            columns: ["freight_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_refinery_id_fkey_refineries"
            columns: ["refinery_id"]
            isOneToOne: false
            referencedRelation: "refineries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_production_company_fkey"
            columns: ["daily_production_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id", "mining_company_id"]
          },
          {
            foreignKeyName: "shipping_production_company_fkey"
            columns: ["daily_production_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id", "mining_company_id"]
          },
        ]
      }
      shipments_for_refinery: {
        Row: {
          bullion_grams: number | null
          created_at: string | null
          created_by: string | null
          daily_production_id: string | null
          estimated_fineness_pct: number | null
          expedition_lot_number: string | null
          export_license_id: string | null
          freight_company_id: string | null
          id: string | null
          license_id: string | null
          mining_company_id: string | null
          notes: string | null
          packing_list_document_id: string | null
          packing_list_url: string | null
          prepared_at: string | null
          production_date: string | null
          pure_gold_grams: number | null
          refinery_id: string | null
          seal_number: string | null
          shipped_at: string | null
          shipped_to_address: string | null
          shipped_to_company: string | null
          shipped_to_country: string | null
          status:
            | Database["public"]["Enums"]["shipping_preparation_status"]
            | null
          status_old_backup: string | null
          total_boxes: number | null
          total_gross_weight_grams: number | null
          total_net_weight_grams: number | null
          total_weight_oz: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_export_license_company_fkey"
            columns: ["export_license_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id", "mining_company_id"]
          },
          {
            foreignKeyName: "shipping_preparations_daily_production_id_fkey"
            columns: ["daily_production_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_daily_production_id_fkey"
            columns: ["daily_production_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_export_license_id_fkey"
            columns: ["export_license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_freight_company_id_fkey"
            columns: ["freight_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "export_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_mining_company_id_fkey"
            columns: ["mining_company_id"]
            isOneToOne: false
            referencedRelation: "mining_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_preparations_refinery_id_fkey_refineries"
            columns: ["refinery_id"]
            isOneToOne: false
            referencedRelation: "refineries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_production_company_fkey"
            columns: ["daily_production_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "daily_production"
            referencedColumns: ["id", "mining_company_id"]
          },
          {
            foreignKeyName: "shipping_production_company_fkey"
            columns: ["daily_production_id", "mining_company_id"]
            isOneToOne: false
            referencedRelation: "daily_production_with_metals"
            referencedColumns: ["id", "mining_company_id"]
          },
        ]
      }
      v_artisan_paiements_resume: {
        Row: {
          artisan_id: string | null
          nom: string | null
          nombre_paiements: number | null
          nombre_ventes: number | null
          numero_carte: string | null
          prenoms: string | null
          solde_du: number | null
          total_brut: number | null
          total_net: number | null
          total_paye: number | null
          total_taxes: number | null
        }
        Relationships: []
      }
      v_monthly_sales_vs_market: {
        Row: {
          avg_market_price: number | null
          avg_sale_price: number | null
          avg_variance_percent: number | null
          avg_variance_usd: number | null
          month: number | null
          total_quantity_oz: number | null
          total_sales: number | null
          total_variance_usd: number | null
          year: number | null
        }
        Relationships: []
      }
      v_paiements_en_attente: {
        Row: {
          artisan_id: string | null
          artisan_nom_complet: string | null
          date_facture: string | null
          date_vente: string | null
          facture_id: string | null
          jours_attente: number | null
          montant_net_a_payer: number | null
          numero_carte: string | null
          numero_facture: string | null
          reference_vente: string | null
          statut_paiement: string | null
          telephone: string | null
          vente_id: string | null
        }
        Relationships: []
      }
      v_sales_price_analysis: {
        Row: {
          customer_name: string | null
          market_price_per_oz: number | null
          month: number | null
          quantity_oz: number | null
          sale_date: string | null
          sale_id: string | null
          sale_number: string | null
          sale_price_per_oz: number | null
          variance_percent: number | null
          variance_usd: number | null
          year: number | null
        }
        Relationships: []
      }
      v_taxes_a_reverser: {
        Row: {
          exercice_fiscal: string | null
          libelle_taxe: string | null
          montant_total: number | null
          nombre_transactions: number | null
          periode_fiscale: string | null
          statut_reversement: string | null
          type_taxe: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      analyze_audit_fields: {
        Args: never
        Returns: {
          completeness_pct: number
          has_created_at: boolean
          has_created_by: boolean
          has_deleted_at: boolean
          has_updated_at: boolean
          has_updated_by: boolean
          table_name: string
        }[]
      }
      auto_allocate_inventory: {
        Args: { p_quantity_oz: number; p_sale_id: string }
        Returns: boolean
      }
      auto_desactiver_artisan_carte_expiree: { Args: never; Returns: undefined }
      calculate_final_fine: {
        Args: {
          fineness_percentage: number
          metal_retained_percentage: number
          post_melting_weight: number
        }
        Returns: Record<string, unknown>
      }
      calculate_fx_gain_loss: {
        Args: { p_amount: number; p_best_rate: number; p_customer_rate: number }
        Returns: {
          gain_loss_amount: number
          gain_loss_percentage: number
        }[]
      }
      calculate_monthly_fx_aggregates: {
        Args: { p_month: number; p_year: number }
        Returns: undefined
      }
      calculate_monthly_gold_price_aggregate: {
        Args: { p_month: number; p_year: number }
        Returns: undefined
      }
      calculate_next_run_time: {
        Args: {
          p_frequency: string
          p_last_run_at: string
          p_schedule_day: number
          p_schedule_time: string
          p_schedule_weekday: number
        }
        Returns: string
      }
      calculate_payment_due_date: {
        Args: { approval_date?: string; mechanism: string }
        Returns: string
      }
      calculate_sale_proceeds: {
        Args: {
          freight_cost?: number
          london_am_rate: number
          other_costs?: number
          quantity_oz: number
        }
        Returns: Record<string, unknown>
      }
      calculate_shipping_preparation_totals: {
        Args: { prep_id: string }
        Returns: undefined
      }
      calculate_variance: {
        Args: { actual: number; expected: number }
        Returns: Record<string, unknown>
      }
      calculate_virtual_payment_due_date: {
        Args: { p_approval_date?: string; p_mechanism_type: string }
        Returns: string
      }
      calculate_weight_in_ounces: { Args: { grams: number }; Returns: number }
      calculer_taxes_vente: {
        Args: {
          p_montant_brut: number
          p_taux_retenue_source?: number
          p_taux_tva?: number
        }
        Returns: {
          montant_net: number
          montant_retenue_source: number
          montant_total_taxes: number
          montant_tva: number
        }[]
      }
      can_change_status: {
        Args: {
          p_context: Database["public"]["Enums"]["status_change_context"]
          p_current_status: string
          p_entity_id: string
          p_entity_type: string
          p_new_status: string
        }
        Returns: boolean
      }
      check_license_availability: {
        Args: { p_license_id: string; p_required_quantity: number }
        Returns: {
          is_available: boolean
          message: string
          remaining_quantity: number
        }[]
      }
      check_sale_authorization: {
        Args: {
          p_available_stock_oz: number
          p_customer_id: string
          p_mining_company_id: string
          p_quantity_oz: number
        }
        Returns: {
          is_authorized: boolean
          max_allowed_oz: number
          reason: string
          settings: Json
        }[]
      }
      check_user_has_role: {
        Args: { required_roles: string[] }
        Returns: boolean
      }
      check_user_permission: {
        Args: {
          p_module_name: string
          p_permission_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_user_policies_accepted: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_user_role: { Args: { required_role: string }; Returns: boolean }
      consume_activation_token: {
        Args: { p_now?: string; p_token: string }
        Returns: {
          token_type: string
          user_id: string
        }[]
      }
      convert_virtual_to_actual_payment: {
        Args: {
          p_account_number: string
          p_actual_date: string
          p_bank_name: string
          p_converted_by: string
          p_fx_rate: number
          p_notes: string
          p_payment_id: string
          p_proof_url: string
          p_reference_number: string
          p_transaction_id: string
        }
        Returns: boolean
      }
      count_shipping_certificates: {
        Args: { p_shipping_id: string }
        Returns: number
      }
      create_artisan_sale_to_sonasp: {
        Args: {
          p_artisan_id: string
          p_date_vente: string
          p_observations?: string
          p_prix_kg_fcfa: number
          p_purete_karat: number
          p_quantite_grammes: number
          p_type_or: string
        }
        Returns: string
      }
      create_virtual_payment: {
        Args: {
          p_amount: number
          p_approved_date?: string
          p_currency: string
          p_customer_id: string
          p_mechanism_type: string
          p_sale_id: string
        }
        Returns: string
      }
      current_user_role: { Args: never; Returns: string }
      generate_activation_token: {
        Args: {
          p_created_by?: string
          p_temporary_password?: string
          p_token_type: string
          p_user_id: string
        }
        Returns: string
      }
      generate_bar_reference: {
        Args: { company_name?: string; production_date?: string }
        Returns: string
      }
      generate_freight_reference: { Args: never; Returns: string }
      generate_freight_shipment_reference: { Args: never; Returns: string }
      generate_numero_recu_vente_or: { Args: never; Returns: string }
      generate_pre_sale_number: { Args: never; Returns: string }
      generate_sale_number: { Args: never; Returns: string }
      generer_numero_facture: { Args: never; Returns: string }
      generer_reference_paiement: { Args: never; Returns: string }
      get_authorized_customers_for_mine: {
        Args: { p_mining_company_id: string }
        Returns: {
          customer_id: string
          customer_name: string
          max_stock_percentage: number
          refining_fees_paid_by_customer: boolean
          sale_method: string
          transport_fees_paid_by_customer: boolean
        }[]
      }
      get_certificate_with_data: {
        Args: { cert_id: string }
        Returns: {
          approval_history: Json
          certificate: Json
          parsed_data: Json
        }[]
      }
      get_certificates_statistics: {
        Args: never
        Returns: {
          approved: number
          parsing_completed: number
          parsing_failed: number
          pending_approval: number
          pending_parsing: number
          rejected: number
          total_certificates: number
        }[]
      }
      get_customer_account_balance: {
        Args: { p_customer_id: string }
        Returns: number
      }
      get_daily_target: {
        Args: { site?: string; target_date: string }
        Returns: {
          budget_oz: number
          daily_budget_oz: number
          daily_forecast_oz: number
          forecast_oz: number
          source: string
        }[]
      }
      get_mtd_summary: {
        Args: { company_id?: string; reference_date?: string; site?: string }
        Returns: {
          avg_fineness_pct: number
          budget_oz: number
          forecast_oz: number
          record_count: number
          total_bullion_grams: number
          total_estimated_oz: number
          total_pure_gold_grams: number
          variance_vs_budget: number
          variance_vs_forecast: number
        }[]
      }
      get_next_expedition_lot_number: {
        Args: { p_mining_company_id: string; p_year?: number }
        Returns: string
      }
      get_production_status_history: {
        Args: { prod_id: string }
        Returns: {
          changed_at: string
          changed_by: string
          id: string
          new_status: string
          notes: string
          old_status: string
          user_email: string
        }[]
      }
      get_production_summary: {
        Args: { end_date: string; site?: string; start_date: string }
        Returns: {
          avg_fineness_pct: number
          record_count: number
          total_bullion_grams: number
          total_estimated_oz: number
          total_pure_gold_grams: number
        }[]
      }
      get_production_variance: {
        Args: { check_date: string; period?: string; site?: string }
        Returns: {
          actual_oz: number
          budget_oz: number
          forecast_oz: number
          variance_vs_budget: number
          variance_vs_forecast: number
        }[]
      }
      get_shipping_assay_certificates: {
        Args: { p_shipping_id: string }
        Returns: {
          approval_status: string
          certificate_date: string
          certificate_number: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          issuing_laboratory: string
          parsed_data: Json
          parsing_status: string
          uploaded_by: string
        }[]
      }
      get_sonasp_id: { Args: never; Returns: string }
      get_unified_status_history: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          action_description: string
          change_context: string
          changed_at: string
          changed_by: string
          id: string
          metadata: Json
          new_status: string
          notes: string
          old_status: string
          user_email: string
          user_name: string
        }[]
      }
      get_user_modules: {
        Args: { user_id: string }
        Returns: {
          code: string
          description: string
          icone: string
          id: string
          nom: string
          ordre: number
          parent_id: string
          parent_nom: string
          route: string
        }[]
      }
      get_user_permissions: {
        Args: { p_user_id: string }
        Returns: {
          can_delete: boolean
          can_read: boolean
          can_write: boolean
          display_name: string
          module_name: string
        }[]
      }
      get_user_sites: {
        Args: { p_user_id: string }
        Returns: {
          is_primary: boolean
          site_id: string
          site_name: string
          site_type: string
        }[]
      }
      get_user_table_permissions: {
        Args: never
        Returns: {
          can_delete: boolean
          can_insert: boolean
          can_select: boolean
          can_update: boolean
          table_name: string
        }[]
      }
      get_wtd_summary: {
        Args: { company_id?: string; reference_date?: string; site?: string }
        Returns: {
          avg_fineness_pct: number
          budget_oz: number
          forecast_oz: number
          record_count: number
          total_bullion_grams: number
          total_estimated_oz: number
          total_pure_gold_grams: number
          variance_vs_budget: number
          variance_vs_forecast: number
        }[]
      }
      get_ytd_summary: {
        Args: { company_id?: string; reference_date?: string; site?: string }
        Returns: {
          avg_fineness_pct: number
          budget_oz: number
          forecast_oz: number
          record_count: number
          total_bullion_grams: number
          total_estimated_oz: number
          total_pure_gold_grams: number
          variance_vs_budget: number
          variance_vs_forecast: number
        }[]
      }
      is_admin_user: { Args: { user_id: string }; Returns: boolean }
      is_management: { Args: never; Returns: boolean }
      is_management_user: { Args: { user_id: string }; Returns: boolean }
      log_security_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_ip_address?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_user_activity: {
        Args: {
          p_action_type: string
          p_changes_summary?: Json
          p_description: string
          p_ip_address?: string
          p_module_name: string
          p_resource_id: string
          p_resource_type: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      mark_token_used: { Args: { p_token: string }; Returns: boolean }
      release_license_quota: {
        Args: { p_license_id: string; p_quantity: number; p_user_id?: string }
        Returns: boolean
      }
      reserve_license_quota: {
        Args: {
          p_license_id: string
          p_quantity: number
          p_shipping_id: string
          p_user_id?: string
        }
        Returns: boolean
      }
      snp_2l_can_read_payment_proof: {
        Args: { p_payment_id: string; p_sale_id: string }
        Returns: boolean
      }
      snp_2l_can_read_payment_proof_object: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      snp_2l_payment_proof_object_matches: {
        Args: {
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_idempotency_key: string
          p_mime_type: string
          p_payment_id: string
          p_sha256: string
          p_uploaded_by: string
        }
        Returns: boolean
      }
      snp_2m_account_business_activity: {
        Args: { p_target_id: string }
        Returns: Json
      }
      snp_2m_assert_dependency_registry_complete: {
        Args: never
        Returns: undefined
      }
      snp_2m_assert_target: {
        Args: {
          p_actor_role: string
          p_expected_version: number
          p_require_inactive: boolean
          p_target_id: string
        }
        Returns: {
          account_activated: boolean | null
          account_locked: boolean
          account_locked_until: string | null
          activation_completed_at: string | null
          approval_notifications: boolean | null
          created_at: string | null
          department: string | null
          email: string
          email_notifications: boolean | null
          failed_login_attempts: number | null
          full_name: string | null
          id: string
          invitation_id: string | null
          is_active: boolean
          is_sales_approver: boolean
          job_title: string | null
          language: string | null
          language_preference: string | null
          last_activity_at: string | null
          last_login_at: string | null
          last_login_ip: string | null
          last_password_change: string | null
          locked_until: string | null
          mfa_enrolled_at: string | null
          mfa_reset_at: string | null
          mfa_reset_by: string | null
          mining_company_id: string | null
          must_change_password: boolean
          password_changed_at: string | null
          password_expiry_days: number | null
          password_must_change: boolean | null
          phone: string | null
          profile_picture_url: string | null
          role: string
          timezone: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_2m_can_read_lifecycle_audit: { Args: never; Returns: boolean }
      snp_2m_current_dependency_inventory: {
        Args: never
        Returns: {
          classification: string
          column_name: string
          constraint_name: string
          delete_action: unknown
          referenced_column_name: string
          referenced_schema_name: string
          referenced_table_name: string
          schema_name: string
          source: string
          table_name: string
        }[]
      }
      snp_2m_require_account_admin: { Args: never; Returns: string }
      snp_4b_can_manage_artisan: {
        Args: { p_artisan_id: string; p_capability: string }
        Returns: boolean
      }
      snp_4b_card_snapshot: {
        Args: {
          p_row: Database["public"]["Tables"]["snp_cartes_professionnelles"]["Row"]
        }
        Returns: Json
      }
      snp_4b_payment_snapshot: {
        Args: {
          p_row: Database["public"]["Tables"]["snp_artisan_moyens_paiement"]["Row"]
        }
        Returns: Json
      }
      snp_4b_verified_payment_proof: {
        Args: { p_reglement_id: string }
        Returns: boolean
      }
      snp_4h_complete_payment_operation: {
        Args: {
          p_idempotency_key: string
          p_payment_id: string
          p_result: Json
          p_sale_id: string
        }
        Returns: undefined
      }
      snp_4h_payment_idempotency_reserve: {
        Args: {
          p_actor: string
          p_aggregate_id: string
          p_capability: string
          p_idempotency_key: string
          p_operation: string
          p_request_fingerprint: string
        }
        Returns: Json
      }
      snp_4i_can_read_finance_scope: {
        Args: { p_artisan_id: string; p_comptoir_id: string }
        Returns: boolean
      }
      snp_4i_capability_for_scope: {
        Args: {
          p_comptoir_capability: string
          p_comptoir_id: string
          p_sonasp_capability: string
        }
        Returns: string
      }
      snp_4i_idempotency_complete: {
        Args: { p_idempotency_key: string; p_response: Json }
        Returns: undefined
      }
      snp_4i_idempotency_reserve: {
        Args: {
          p_aggregate_id: string
          p_capability: string
          p_comptoir_id: string
          p_idempotency_key: string
          p_operation: string
          p_request: Json
        }
        Returns: Json
      }
      snp_aal: { Args: never; Returns: string }
      snp_accuser_reception_requisition: {
        Args: {
          p_accuse_par: string
          p_notification_id: string
          p_preuve?: string
        }
        Returns: {
          accuse_le: string | null
          accuse_par: string | null
          canal: string
          contenu: string
          created_at: string
          destinataires: string
          envoye_le: string
          envoye_par: string | null
          id: string
          objet: string
          preuve_envoi: string | null
          preuve_reception: string | null
          relance_de: string | null
          requisition_id: string
        }
        SetofOptions: {
          from: "*"
          to: "snp_requisitions_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_activer_configuration_courriel: {
        Args: { p_uid: string }
        Returns: undefined
      }
      snp_actor_capabilities: {
        Args: never
        Returns: {
          capability_code: string
        }[]
      }
      snp_actor_has_capability: {
        Args: { p_capability_code: string }
        Returns: boolean
      }
      snp_admin_compte_definir_statut: {
        Args: {
          p_expected_version: number
          p_idempotency_key: string
          p_is_active: boolean
          p_reason: string
          p_target_id: string
        }
        Returns: Json
      }
      snp_admin_compte_finaliser_action: {
        Args: {
          p_error_code?: string
          p_idempotency_key: string
          p_success: boolean
        }
        Returns: Json
      }
      snp_admin_compte_preparer_suppression: {
        Args: {
          p_expected_version: number
          p_idempotency_key: string
          p_reason: string
          p_target_id: string
        }
        Returns: Json
      }
      snp_affecter_fifo: {
        Args: { p_reglement_id: string }
        Returns: {
          factures_soldees: number
          montant_affecte: number
          solde_non_affecte: number
        }[]
      }
      snp_affecter_fifo_legacy_4b: {
        Args: { p_reglement_id: string }
        Returns: {
          factures_soldees: number
          montant_affecte: number
          solde_non_affecte: number
        }[]
      }
      snp_affecter_reglement: {
        Args: {
          p_facture_id: string
          p_montant: number
          p_observations?: string
          p_reglement_id: string
        }
        Returns: {
          affectation_id: string
          reste_facture: number
          solde_reglement: number
        }[]
      }
      snp_affecter_reglement_legacy_4b: {
        Args: {
          p_facture_id: string
          p_montant: number
          p_observations?: string
          p_reglement_id: string
        }
        Returns: {
          affectation_id: string
          reste_facture: number
          solde_reglement: number
        }[]
      }
      snp_ajouter_preuve_reglement: {
        Args: {
          p_banque_emettrice?: string
          p_commentaire?: string
          p_date_emission?: string
          p_empreinte_sha256?: string
          p_fichier_url: string
          p_nom_origine: string
          p_reference_document?: string
          p_reglement_id: string
          p_taille_octets: number
          p_type_document: string
          p_type_mime: string
        }
        Returns: {
          ajoute_le: string
          ajoute_par: string | null
          banque_emettrice: string | null
          commentaire: string | null
          date_emission: string | null
          empreinte_sha256: string | null
          fichier_url: string
          id: string
          motif_rejet: string | null
          nom_origine: string
          reference_document: string | null
          reglement_id: string
          statut_verification: string
          taille_octets: number
          type_document: string
          type_mime: string
          verifiee_le: string | null
          verifiee_par: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_reglements_preuves"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_alertes_contractuelles: {
        Args: never
        Returns: {
          cle: string
          detail: string
          domaine: string
          echeance: string
          gravite: string
          jours: number
          libelle: string
          objet_id: string
          partenaire: string
          reference: string
        }[]
      }
      snp_analyse_synthese: {
        Args: { p_analyse_id: string }
        Returns: {
          analyste: string
          certificat_reference: string
          date_analyse: string
          ecart_a_la_declaration: number
          laboratoire: string
          laboratoire_independant: boolean
          observations: string
          origine: string
          rang: number
          teneur_pct: number
        }[]
      }
      snp_annuler_affectation: {
        Args: { p_affectation_id: string; p_motif: string }
        Returns: {
          affectation_id: string
          reste_facture: number
          solde_reglement: number
        }[]
      }
      snp_annuler_affectation_legacy_4b: {
        Args: { p_affectation_id: string; p_motif: string }
        Returns: {
          affectation_id: string
          reste_facture: number
          solde_reglement: number
        }[]
      }
      snp_appliquer_contrats_au_plan: {
        Args: { p_ecraser_ajustements?: boolean; p_plan_id: string }
        Returns: {
          lignes_creees: number
          lignes_preservees: number
          lignes_rattachees: number
          quantite_contractuelle: number
          quantite_reliquat: number
        }[]
      }
      snp_artisan_creer_paiement: {
        Args: {
          p_expected_facture_statut: string
          p_expected_facture_version: number
          p_facture_id: string
          p_idempotency_key: string
          p_moyen_paiement_id: string
          p_notes?: string
        }
        Returns: Json
      }
      snp_artisan_emettre_facture: {
        Args: {
          p_date_echeance?: string
          p_expected_vente_statut: string
          p_expected_vente_version: number
          p_idempotency_key: string
          p_notes?: string
          p_vente_id: string
        }
        Returns: Json
      }
      snp_artisan_transition_paiement: {
        Args: {
          p_expected_statut: string
          p_expected_version: number
          p_idempotency_key: string
          p_notes?: string
          p_nouveau_statut: string
          p_paiement_id: string
        }
        Returns: Json
      }
      snp_artisan_transition_reversement_taxe: {
        Args: {
          p_expected_statut: string
          p_expected_version: number
          p_idempotency_key: string
          p_notes?: string
          p_nouveau_statut: string
          p_reversement_reference?: string
          p_taxe_id: string
        }
        Returns: Json
      }
      snp_assiette_achat: {
        Args: { p_debut: string; p_fin: string }
        Returns: {
          declaree: number
          eligible: number
          engage: number
          mining_company_id: string
          titre: number
          validee: number
        }[]
      }
      snp_assign_artisan_to_collector: {
        Args: {
          p_artisan_id: string
          p_collector_id: string
          p_comptoir_organization_id: string
          p_reason: string
        }
        Returns: string
      }
      snp_assign_user_organization: {
        Args: {
          p_is_primary?: boolean
          p_membership_role: string
          p_organization_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: string
      }
      snp_audit_email_settings_change: {
        Args: { p_action: string; p_configuration_id: string }
        Returns: undefined
      }
      snp_avoir_imputer: {
        Args: {
          p_avoir_id: string
          p_idempotency_key: string
          p_montant: number
          p_sale_id: string
        }
        Returns: Json
      }
      snp_avoir_solde: { Args: { p_avoir_id: string }; Returns: number }
      snp_balance_agee: {
        Args: { p_date?: string; p_mining_company_id?: string }
        Returns: {
          anciennete_moyenne: number
          devise: string
          j1_30: number
          j31_60: number
          j61_90: number
          j91_180: number
          mining_company_id: string
          nb_factures: number
          non_echu: number
          plus_180: number
          plus_ancienne: string
          societe: string
          total: number
        }[]
      }
      snp_can_access_artisan: {
        Args: { p_artisan_id: string }
        Returns: boolean
      }
      snp_certify_artisan_invoice: {
        Args: {
          p_dgi_reference: string
          p_document_path: string
          p_facture_id: string
        }
        Returns: undefined
      }
      snp_changer_statut_contrat: {
        Args: {
          p_commentaire?: string
          p_contrat_id: string
          p_motif?: string
          p_statut: string
        }
        Returns: {
          approuve_par: string | null
          artisan_id: string | null
          conditions_enlevement: string | null
          conditions_livraison: string | null
          conditions_paiement: string
          confidentialite: string | null
          contrat_parent_id: string | null
          contrat_precedent_id: string | null
          created_at: string
          created_by: string | null
          date_activation: string | null
          date_approbation: string | null
          date_cloture: string | null
          date_debut: string
          date_fin: string
          date_signature: string | null
          date_soumission: string | null
          decote_pct: number
          delai_contestation_jours: number
          delai_paiement_jours: number
          devise_cours: string
          devise_reglement: string
          direction_responsable: string | null
          force_majeure: string | null
          formule_prix: string | null
          frais_contre_expertise: string
          gestionnaire_id: string | null
          id: string
          intitule: string
          laboratoire_independant: string | null
          laboratoire_initial: string | null
          livraison_anticipee_autorisee: boolean
          methode_analyse: string | null
          methode_echantillonnage: string | null
          methode_prix: string
          mining_company_id: string | null
          modalites_pesee: string | null
          motif_statut: string | null
          numero_contrat: string
          obligations_fournisseur: string | null
          obligations_sonasp: string | null
          observations: string | null
          partenaire_libelle: string | null
          partenaire_type: string
          penalites: string | null
          periodicite: string
          plafond_depassement_pct: number
          preavis_reconduction_jours: number | null
          prime_pct: number
          prix_ajuste_sur_teneur: boolean
          prix_fixe_fcfa: number | null
          quantite_maximale: number | null
          quantite_minimale: number | null
          quantite_totale: number | null
          reconduction: string
          reglement_differends: string | null
          report_reliquat: string
          representant_contact: string | null
          representant_partenaire: string | null
          site_id: string | null
          source_cours: string | null
          statut: string
          teneur_faisant_foi: string
          teneur_minimale_pct: number | null
          teneur_reference_pct: number | null
          teneur_tolerance_pct: number
          tolerance_quantite_pct: number
          transfert_propriete: string | null
          type_contrat: string
          unite: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "snp_contrats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_changer_statut_contrat_legacy_4b: {
        Args: {
          p_commentaire?: string
          p_contrat_id: string
          p_motif?: string
          p_statut: string
        }
        Returns: {
          approuve_par: string | null
          artisan_id: string | null
          conditions_enlevement: string | null
          conditions_livraison: string | null
          conditions_paiement: string
          confidentialite: string | null
          contrat_parent_id: string | null
          contrat_precedent_id: string | null
          created_at: string
          created_by: string | null
          date_activation: string | null
          date_approbation: string | null
          date_cloture: string | null
          date_debut: string
          date_fin: string
          date_signature: string | null
          date_soumission: string | null
          decote_pct: number
          delai_contestation_jours: number
          delai_paiement_jours: number
          devise_cours: string
          devise_reglement: string
          direction_responsable: string | null
          force_majeure: string | null
          formule_prix: string | null
          frais_contre_expertise: string
          gestionnaire_id: string | null
          id: string
          intitule: string
          laboratoire_independant: string | null
          laboratoire_initial: string | null
          livraison_anticipee_autorisee: boolean
          methode_analyse: string | null
          methode_echantillonnage: string | null
          methode_prix: string
          mining_company_id: string | null
          modalites_pesee: string | null
          motif_statut: string | null
          numero_contrat: string
          obligations_fournisseur: string | null
          obligations_sonasp: string | null
          observations: string | null
          partenaire_libelle: string | null
          partenaire_type: string
          penalites: string | null
          periodicite: string
          plafond_depassement_pct: number
          preavis_reconduction_jours: number | null
          prime_pct: number
          prix_ajuste_sur_teneur: boolean
          prix_fixe_fcfa: number | null
          quantite_maximale: number | null
          quantite_minimale: number | null
          quantite_totale: number | null
          reconduction: string
          reglement_differends: string | null
          report_reliquat: string
          representant_contact: string | null
          representant_partenaire: string | null
          site_id: string | null
          source_cours: string | null
          statut: string
          teneur_faisant_foi: string
          teneur_minimale_pct: number | null
          teneur_reference_pct: number | null
          teneur_tolerance_pct: number
          tolerance_quantite_pct: number
          transfert_propriete: string | null
          type_contrat: string
          unite: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "snp_contrats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_changer_statut_reglement: {
        Args: { p_motif?: string; p_reglement_id: string; p_statut: string }
        Returns: {
          r_montant_paye: number
          r_reglement_id: string
          r_statut: string
        }[]
      }
      snp_changer_statut_requisition: {
        Args: {
          p_commentaire?: string
          p_motif?: string
          p_requisition_id: string
          p_statut: string
        }
        Returns: {
          accord_mine: boolean | null
          accord_recu_le: string | null
          accuse_reception_le: string | null
          accuse_reception_par: string | null
          autorisee_par: string | null
          autorite_origine: string | null
          conditions_analyse: string | null
          conditions_transport: string | null
          confidentialite: string
          contestation_motif: string | null
          contestation_recue_le: string | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          date_autorisation: string | null
          date_cloture: string | null
          date_effet: string | null
          date_executoire: string | null
          date_notification: string | null
          date_signature_acte: string | null
          delai_mise_a_disposition_jours: number | null
          equipe: string | null
          id: string
          imputation_contractuelle: string | null
          imputation_decidee_le: string | null
          imputation_decidee_par: string | null
          imputation_motif: string | null
          lieu_enlevement: string | null
          lieu_stockage: string | null
          methode_prix: string
          mining_company_id: string | null
          modalites_enlevement: string | null
          modalites_paiement: string
          motif_statut: string | null
          nature_acte: string | null
          objet: string
          observations: string | null
          observations_mine: string | null
          observations_recues_le: string | null
          partenaire_type: string
          periode_debut: string | null
          periode_fin: string | null
          pourcentage_production: number | null
          prix_once_fcfa: number | null
          produits_concernes: string | null
          quantite_oz: number | null
          reference: string
          reference_acte: string | null
          regime_juridique: string
          responsable_id: string | null
          site_id: string | null
          statut: string
          teneur_estimee_pct: number | null
          type_requisition: string
          unite: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_requisitions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_changer_statut_requisition_legacy_4b: {
        Args: {
          p_commentaire?: string
          p_motif?: string
          p_requisition_id: string
          p_statut: string
        }
        Returns: {
          accord_mine: boolean | null
          accord_recu_le: string | null
          accuse_reception_le: string | null
          accuse_reception_par: string | null
          autorisee_par: string | null
          autorite_origine: string | null
          conditions_analyse: string | null
          conditions_transport: string | null
          confidentialite: string
          contestation_motif: string | null
          contestation_recue_le: string | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          date_autorisation: string | null
          date_cloture: string | null
          date_effet: string | null
          date_executoire: string | null
          date_notification: string | null
          date_signature_acte: string | null
          delai_mise_a_disposition_jours: number | null
          equipe: string | null
          id: string
          imputation_contractuelle: string | null
          imputation_decidee_le: string | null
          imputation_decidee_par: string | null
          imputation_motif: string | null
          lieu_enlevement: string | null
          lieu_stockage: string | null
          methode_prix: string
          mining_company_id: string | null
          modalites_enlevement: string | null
          modalites_paiement: string
          motif_statut: string | null
          nature_acte: string | null
          objet: string
          observations: string | null
          observations_mine: string | null
          observations_recues_le: string | null
          partenaire_type: string
          periode_debut: string | null
          periode_fin: string | null
          pourcentage_production: number | null
          prix_once_fcfa: number | null
          produits_concernes: string | null
          quantite_oz: number | null
          reference: string
          reference_acte: string | null
          regime_juridique: string
          responsable_id: string | null
          site_id: string | null
          statut: string
          teneur_estimee_pct: number | null
          type_requisition: string
          unite: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_requisitions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_compter_facteurs_verifies: {
        Args: { p_user_id?: string }
        Returns: number
      }
      snp_comptoir_stock_balance: {
        Args: { p_organization_id: string }
        Returns: number
      }
      snp_conciliation_completer: {
        Args: { p_idempotency_key: string; p_response: Json }
        Returns: undefined
      }
      snp_conciliation_enregistrer_analyse: {
        Args: {
          p_conciliation_id: string
          p_date_fixing: string
          p_idempotency_key: string
          p_poids_final_g: number
          p_prix_final: number
          p_source_id: string
          p_source_type: string
          p_teneur_finale_pct: number
        }
        Returns: Json
      }
      snp_conciliation_ouvrir: {
        Args: { p_idempotency_key: string; p_sale_id: string }
        Returns: Json
      }
      snp_conciliation_reserver: {
        Args: {
          p_aggregate_id: string
          p_capability: string
          p_idempotency_key: string
          p_operation: string
          p_request: Json
        }
        Returns: Json
      }
      snp_conciliation_valider: {
        Args: { p_conciliation_id: string; p_idempotency_key: string }
        Returns: Json
      }
      snp_configuration_courriel_active: {
        Args: never
        Returns: {
          expediteur_courriel: string
          expediteur_nom: string
          hote: string
          identifiant: string
          mot_de_passe: string
          port: number
          securise: boolean
          uid: string
        }[]
      }
      snp_configurations_courriel: {
        Args: never
        Returns: {
          actif: boolean
          created_at: string
          derniere_erreur: string
          derniere_verification: string
          expediteur_courriel: string
          expediteur_nom: string
          hote: string
          identifiant: string
          libelle: string
          mot_de_passe_defini: boolean
          mot_de_passe_modifie_le: string
          port: number
          securise: boolean
          uid: string
        }[]
      }
      snp_configurer_compte_portail: {
        Args: {
          p_full_name: string
          p_is_active: boolean
          p_mining_company_id?: string
          p_phone: string
          p_role: string
          p_user_id: string
        }
        Returns: undefined
      }
      snp_confirmer_enrolement_mfa: { Args: never; Returns: boolean }
      snp_conformite_mfa: {
        Args: never
        Returns: {
          actif: boolean
          courriel: string
          enrole_le: string
          facteurs_verifies: number
          nom: string
          protege: boolean
          reinitialise_le: string
          role: string
          utilisateur_id: string
        }[]
      }
      snp_consigner_envoi_courriel: {
        Args: { p_erreur?: string; p_livraison_id: string; p_reussi: boolean }
        Returns: undefined
      }
      snp_consigner_verification_courriel: {
        Args: { p_erreur?: string; p_reussi: boolean; p_uid: string }
        Returns: undefined
      }
      snp_contrat_execution: {
        Args: { p_contrat_id: string }
        Returns: {
          montant_achats_fcfa: number
          montant_facture_fcfa: number
          montant_paye_fcfa: number
          nb_defauts_ouverts: number
          nb_livraisons: number
          prochaine_echeance: string
          prochaine_quantite: number
          quantite_en_retard: number
          quantite_hors_contrat: number
          quantite_imputee: number
          quantite_livree: number
          quantite_planifiee: number
          quantite_requisitionnee: number
          quantite_requisitionnee_imputee: number
          quantite_restante: number
          quantite_totale: number
          solde_a_payer_fcfa: number
          taux_execution: number
        }[]
      }
      snp_contrats_actifs_periode: {
        Args: { p_debut: string; p_fin: string }
        Returns: {
          artisan_id: string
          contrat_id: string
          date_fin: string
          deja_livre_periode: number
          intitule: string
          mining_company_id: string
          nature: string
          numero_contrat: string
          partenaire: string
          partenaire_type: string
          plafond_depassement_pct: number
          quantite_periode: number
          reliquat_anterieur: number
          report_reliquat: string
          restant_a_collecter: number
          site_id: string
          tolerance_quantite_pct: number
          unite: string
        }[]
      }
      snp_convertir_requisition_en_achat: {
        Args: {
          p_observations?: string
          p_prix_once_fcfa: number
          p_quantite_imputee?: number
          p_requisition_id: string
          p_taxe_dev_comm_taux?: number
          p_tva_taux?: number
        }
        Returns: {
          contrat_id: string | null
          cours_once_usd: number | null
          created_at: string
          created_by: string | null
          date_achat: string
          demande_id: string | null
          id: string
          imputation_contractuelle: string | null
          imputation_decidee_le: string | null
          imputation_decidee_par: string | null
          imputation_motif: string | null
          mining_company_id: string
          montant_brut_fcfa: number
          montant_total_fcfa: number
          numero_achat: string | null
          observations: string | null
          origine: string
          periode_debut: string
          periode_fin: string
          prix_once_fcfa: number
          quantite_grammes: number | null
          quantite_imputee_oz: number
          quantite_oz: number
          requisition_id: string | null
          statut: string
          taux_usd_xof: number | null
          taxe_dev_comm_montant_fcfa: number
          taxe_dev_comm_taux: number
          tva_montant_fcfa: number
          tva_taux: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_achats_mines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_courriels_a_envoyer: {
        Args: { p_limite?: number }
        Returns: {
          chemin: string
          destinataire: string
          faits: Json
          gravite: string
          livraison_id: string
          message: string
          notification_id: string
          tentatives: number
          titre: string
        }[]
      }
      snp_create_comptoir_organization: {
        Args: { p_code: string; p_name: string; p_reason: string }
        Returns: string
      }
      snp_creer_configuration_courriel: {
        Args: {
          p_activer?: boolean
          p_expediteur_courriel: string
          p_expediteur_nom: string
          p_hote: string
          p_identifiant: string
          p_libelle: string
          p_mot_de_passe: string
          p_port: number
          p_securise: boolean
        }
        Returns: string
      }
      snp_creer_vente_export: {
        Args: {
          p_customer_id: string
          p_freight_cost?: number
          p_in_process_refinery_id?: string
          p_london_am_rate: number
          p_lots?: Json
          p_mechanism_type?: string
          p_other_costs?: number
          p_quantity_oz: number
          p_seller_id: string
        }
        Returns: Json
      }
      snp_creer_vente_export_mine: {
        Args: {
          p_customer_id: string
          p_freight_cost?: number
          p_in_process_refinery_id?: string
          p_london_am_rate: number
          p_mechanism_type?: string
          p_other_costs?: number
          p_quantity_oz: number
        }
        Returns: Json
      }
      snp_current_collector_id: { Args: never; Returns: string }
      snp_current_organization_id: { Args: never; Returns: string }
      snp_current_organization_type: { Args: never; Returns: string }
      snp_decider_approbation: {
        Args: { p_decision: string; p_demande_id: string; p_motif?: string }
        Returns: Json
      }
      snp_decider_imputation_requisition: {
        Args: {
          p_contrat_id?: string
          p_imputation: string
          p_motif?: string
          p_requisition_id: string
        }
        Returns: {
          accord_mine: boolean | null
          accord_recu_le: string | null
          accuse_reception_le: string | null
          accuse_reception_par: string | null
          autorisee_par: string | null
          autorite_origine: string | null
          conditions_analyse: string | null
          conditions_transport: string | null
          confidentialite: string
          contestation_motif: string | null
          contestation_recue_le: string | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          date_autorisation: string | null
          date_cloture: string | null
          date_effet: string | null
          date_executoire: string | null
          date_notification: string | null
          date_signature_acte: string | null
          delai_mise_a_disposition_jours: number | null
          equipe: string | null
          id: string
          imputation_contractuelle: string | null
          imputation_decidee_le: string | null
          imputation_decidee_par: string | null
          imputation_motif: string | null
          lieu_enlevement: string | null
          lieu_stockage: string | null
          methode_prix: string
          mining_company_id: string | null
          modalites_enlevement: string | null
          modalites_paiement: string
          motif_statut: string | null
          nature_acte: string | null
          objet: string
          observations: string | null
          observations_mine: string | null
          observations_recues_le: string | null
          partenaire_type: string
          periode_debut: string | null
          periode_fin: string | null
          pourcentage_production: number | null
          prix_once_fcfa: number | null
          produits_concernes: string | null
          quantite_oz: number | null
          reference: string
          reference_acte: string | null
          regime_juridique: string
          responsable_id: string | null
          site_id: string | null
          statut: string
          teneur_estimee_pct: number | null
          type_requisition: string
          unite: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_requisitions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_definir_approbateur_ventes: {
        Args: { p_active: boolean; p_user_id: string }
        Returns: undefined
      }
      snp_definir_capacite_utilisateur: {
        Args: {
          p_allowed: boolean
          p_capability_code: string
          p_reason: string
          p_user_id: string
          p_valid_until?: string
        }
        Returns: undefined
      }
      snp_definir_statut_compte: {
        Args: { p_actif: boolean; p_motif: string; p_utilisateur_id: string }
        Returns: undefined
      }
      snp_desactiver_configuration_courriel: {
        Args: { p_uid: string }
        Returns: undefined
      }
      snp_encoder_instant_carte: { Args: { instant: string }; Returns: string }
      snp_enregistrer_connexion: { Args: never; Returns: undefined }
      snp_enregistrer_reglement: {
        Args: {
          p_affecter_fifo?: boolean
          p_banque?: string
          p_date?: string
          p_mining_company_id: string
          p_mode?: string
          p_montant: number
          p_observations?: string
          p_reference_bancaire?: string
        }
        Returns: {
          montant_affecte: number
          reference: string
          reglement_id: string
          solde_non_affecte: number
        }[]
      }
      snp_enregistrer_reglement_legacy_4b: {
        Args: {
          p_affecter_fifo?: boolean
          p_banque?: string
          p_date?: string
          p_mining_company_id: string
          p_mode?: string
          p_montant: number
          p_observations?: string
          p_reference_bancaire?: string
        }
        Returns: {
          montant_affecte: number
          reference: string
          reglement_id: string
          solde_non_affecte: number
        }[]
      }
      snp_enregistrer_resultat_analyse: {
        Args: {
          p_analyse_id: string
          p_analyste?: string
          p_argent_pct?: number
          p_certificat?: string
          p_date_analyse?: string
          p_document_chemin?: string
          p_laboratoire: string
          p_laboratoire_independant?: boolean
          p_methode?: string
          p_observations?: string
          p_teneur_pct: number
        }
        Returns: {
          analyse_id: string
          analyste: string | null
          argent_pct: number | null
          certificat_reference: string | null
          created_at: string
          date_analyse: string | null
          document_chemin: string | null
          enregistre_par: string | null
          id: string
          laboratoire: string
          laboratoire_independant: boolean
          methode: string | null
          observations: string | null
          origine: string
          rang: number
          teneur_pct: number
        }
        SetofOptions: {
          from: "*"
          to: "snp_analyses_resultats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_essai_messagerie: {
        Args: never
        Returns: {
          attendu: string
          conforme: boolean
          etape: string
          obtenu: string
        }[]
      }
      snp_est_agent_sonasp: { Args: never; Returns: boolean }
      snp_est_direction_lecture: { Args: never; Returns: boolean }
      snp_est_operateur_interne: { Args: never; Returns: boolean }
      snp_etat_mfa: {
        Args: never
        Returns: {
          aal: string
          enrole: boolean
          enrole_le: string
          etape_suivante: string
          facteurs_verifies: number
          mot_de_passe_a_changer: boolean
        }[]
      }
      snp_evaluer_depassement: {
        Args: {
          p_contrat_id: string
          p_debut: string
          p_fin: string
          p_quantite: number
        }
        Returns: {
          autorise: boolean
          decision: string
          depassement: number
          explication: string
          plafond: number
          quantite_prevue: number
          reliquat_anterieur: number
          report_possible: boolean
        }[]
      }
      snp_evaluer_teneur: {
        Args: {
          p_contrat_id: string
          p_teneur_analysee: number
          p_teneur_declaree: number
        }
        Returns: {
          dans_tolerance: boolean
          decision: string
          ecart_absolu: number
          ecart_relatif_pct: number
          explication: string
          prix_a_recalculer: boolean
          sous_minimum: boolean
          teneur_retenue: number
        }[]
      }
      snp_facture_engage: { Args: { p_facture_id: string }; Returns: number }
      snp_facture_net_exigible: {
        Args: { p_facture_id: string }
        Returns: number
      }
      snp_facture_paye: { Args: { p_facture_id: string }; Returns: number }
      snp_facture_reste_a_affecter: {
        Args: { p_facture_id: string }
        Returns: number
      }
      snp_facture_reste_du: { Args: { p_facture_id: string }; Returns: number }
      snp_facture_statut_calcule: {
        Args: {
          p_echeance: string
          p_net: number
          p_paye: number
          p_statut_actuel: string
        }
        Returns: string
      }
      snp_factures_eligibles: {
        Args: { p_devise?: string; p_mining_company_id: string }
        Returns: {
          achat_numero: string
          anciennete_jours: number
          date_echeance: string
          date_emission: string
          facture_id: string
          montant_engage: number
          montant_paye: number
          montant_ttc: number
          numero_facture: string
          periode_debut: string
          periode_fin: string
          reste_a_affecter: number
          reste_du: number
          statut: string
          statut_certification: string
          tranche: string
        }[]
      }
      snp_fret_ajouter_document: {
        Args: {
          p_description: string
          p_document_type: Database["public"]["Enums"]["freight_document_type"]
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_mime_type: string
          p_operation_id: string
          p_title: string
        }
        Returns: {
          description: string | null
          document_type: Database["public"]["Enums"]["freight_document_type"]
          file_name: string | null
          file_path: string | null
          file_size: number | null
          freight_customs_operation_id: string
          id: string
          mime_type: string | null
          title: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "freight_customs_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_fret_creer_operation: {
        Args: { p_shipping_preparation_id: string }
        Returns: {
          actual_arrival_date: string | null
          actual_departure_date: string | null
          awb_number: string | null
          created_at: string | null
          created_by: string | null
          customs_approval_date: string | null
          customs_approved_by: string | null
          customs_office: string | null
          customs_officer_name: string | null
          customs_reference_number: string | null
          dispatched_by: string | null
          estimated_arrival_date: string | null
          estimated_departure_date: string | null
          freight_forwarder_contact: string | null
          id: string
          mining_company_id: string
          notes: string | null
          prepared_by: string | null
          reference_number: string
          shipping_preparation_id: string
          status: Database["public"]["Enums"]["freight_customs_status"]
          status_changed_at: string | null
          tracking_number: string | null
          transport_company_id: string | null
          transport_prepared_by: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "freight_customs_operations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_fret_enregistrer_facture: {
        Args: { p_donnees: Json; p_operation_id: string }
        Returns: {
          box_type: string | null
          country_of_origin: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          exchange_rate_fcfa_usd: number | null
          freight_customs_operation_id: string
          id: string
          metal_price_cfa_per_kg: number | null
          mine_location: string | null
          mine_name: string | null
          number_of_boxes: number | null
          recipient_address: string | null
          recipient_city: string | null
          recipient_country: string | null
          recipient_name: string | null
          recipient_phone: string | null
          sender_address: string | null
          sender_city: string | null
          sender_country: string | null
          sender_name: string | null
          sender_nif: string | null
          total_value_cfa: number | null
          total_value_usd: number | null
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "freight_customs_invoice_data"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_fret_exiger_portee: {
        Args: { p_capability: string; p_mining_company_id: string }
        Returns: undefined
      }
      snp_fret_modifier_operation: {
        Args: {
          p_expected_updated_at: string
          p_modifications: Json
          p_operation_id: string
        }
        Returns: {
          actual_arrival_date: string | null
          actual_departure_date: string | null
          awb_number: string | null
          created_at: string | null
          created_by: string | null
          customs_approval_date: string | null
          customs_approved_by: string | null
          customs_office: string | null
          customs_officer_name: string | null
          customs_reference_number: string | null
          dispatched_by: string | null
          estimated_arrival_date: string | null
          estimated_departure_date: string | null
          freight_forwarder_contact: string | null
          id: string
          mining_company_id: string
          notes: string | null
          prepared_by: string | null
          reference_number: string
          shipping_preparation_id: string
          status: Database["public"]["Enums"]["freight_customs_status"]
          status_changed_at: string | null
          tracking_number: string | null
          transport_company_id: string | null
          transport_prepared_by: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "freight_customs_operations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_fret_peut_consulter_tenant: {
        Args: { p_mining_company_id: string }
        Returns: boolean
      }
      snp_fret_supprimer_document: {
        Args: { p_document_id: string }
        Returns: string
      }
      snp_fret_transitionner_operation: {
        Args: {
          p_details?: Json
          p_expected_status: string
          p_new_status: string
          p_operation_id: string
        }
        Returns: {
          actual_arrival_date: string | null
          actual_departure_date: string | null
          awb_number: string | null
          created_at: string | null
          created_by: string | null
          customs_approval_date: string | null
          customs_approved_by: string | null
          customs_office: string | null
          customs_officer_name: string | null
          customs_reference_number: string | null
          dispatched_by: string | null
          estimated_arrival_date: string | null
          estimated_departure_date: string | null
          freight_forwarder_contact: string | null
          id: string
          mining_company_id: string
          notes: string | null
          prepared_by: string | null
          reference_number: string
          shipping_preparation_id: string
          status: Database["public"]["Enums"]["freight_customs_status"]
          status_changed_at: string | null
          tracking_number: string | null
          transport_company_id: string | null
          transport_prepared_by: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "freight_customs_operations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_generer_echeancier: {
        Args: { p_contrat_id: string; p_ecraser?: boolean }
        Returns: number
      }
      snp_historique_peut_consulter_tenant: {
        Args: { p_mining_company_id: string }
        Returns: boolean
      }
      snp_link_collector_account: {
        Args: {
          p_collector_id: string
          p_comptoir_organization_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: string
      }
      snp_marquer_notifications_lues: {
        Args: { p_ids?: string[] }
        Returns: number
      }
      snp_mfa_satisfaite: { Args: never; Returns: boolean }
      snp_modifier_configuration_courriel: {
        Args: {
          p_expediteur_courriel: string
          p_expediteur_nom: string
          p_hote: string
          p_identifiant: string
          p_libelle: string
          p_mot_de_passe?: string
          p_port: number
          p_securise: boolean
          p_uid: string
        }
        Returns: undefined
      }
      snp_niveau_role: { Args: { p_role: string }; Returns: number }
      snp_notifications_resume: {
        Args: never
        Returns: {
          hautes: number
          non_lues: number
          plus_ancienne: string
          urgentes: number
        }[]
      }
      snp_notifier: {
        Args: {
          p_chemin?: string
          p_cle_dedoublonnage?: string
          p_destinataire_id: string
          p_faits?: Json
          p_gravite?: string
          p_message: string
          p_objet_domaine?: string
          p_objet_id?: string
          p_par_courriel?: boolean
          p_titre: string
          p_type?: string
        }
        Returns: {
          chemin: string | null
          cle_dedoublonnage: string | null
          created_at: string
          destinataire_id: string
          emise_par: string | null
          faits: Json | null
          gravite: string
          id: string
          lue: boolean
          lue_le: string | null
          message: string
          objet_domaine: string | null
          objet_id: string | null
          titre: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "snp_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_notifier_requisition: {
        Args: {
          p_canal: string
          p_contenu: string
          p_destinataires: string
          p_objet: string
          p_preuve_envoi?: string
          p_relance_de?: string
          p_requisition_id: string
        }
        Returns: {
          accuse_le: string | null
          accuse_par: string | null
          canal: string
          contenu: string
          created_at: string
          destinataires: string
          envoye_le: string
          envoye_par: string | null
          id: string
          objet: string
          preuve_envoi: string | null
          preuve_reception: string | null
          relance_de: string | null
          requisition_id: string
        }
        SetofOptions: {
          from: "*"
          to: "snp_requisitions_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_notifier_roles: {
        Args: {
          p_chemin?: string
          p_cle_dedoublonnage?: string
          p_faits?: Json
          p_gravite?: string
          p_message: string
          p_objet_domaine?: string
          p_objet_id?: string
          p_par_courriel?: boolean
          p_roles: string[]
          p_titre: string
          p_type?: string
        }
        Returns: number
      }
      snp_numero_suivant: {
        Args: {
          p_annee: number
          p_colonne: string
          p_prefixe: string
          p_table: unknown
        }
        Returns: string
      }
      snp_paiement_international_annuler: {
        Args: {
          p_expected_status: string
          p_expected_version: number
          p_idempotency_key: string
          p_payment_id: string
          p_reason: string
        }
        Returns: Json
      }
      snp_paiement_international_decider: {
        Args: {
          p_decision: string
          p_expected_status: string
          p_expected_version: number
          p_idempotency_key: string
          p_payment_id: string
          p_reason: string
        }
        Returns: Json
      }
      snp_paiement_international_executer: {
        Args: {
          p_customer_bank_id: string
          p_expected_payment_version: number
          p_expected_sale_status: string
          p_idempotency_key: string
          p_notes: string
          p_paid_amount: number
          p_payment_currency: string
          p_payment_date: string
          p_proof_path: string
          p_reference_number: string
          p_sale_id: string
          p_seller_bank_id: string
          p_transaction_id: string
        }
        Returns: Json
      }
      snp_paiement_preuve_rattacher: {
        Args: {
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_idempotency_key: string
          p_mime_type: string
          p_payment_id: string
          p_sha256: string
        }
        Returns: Json
      }
      snp_paiements_preuve_reprise_lister: { Args: never; Returns: Json[] }
      snp_peut_administrer_compte: {
        Args: { p_target_id: string }
        Returns: boolean
      }
      snp_peut_consulter_expedition: {
        Args: { p_expedition_id: string }
        Returns: boolean
      }
      snp_peut_consulter_licence_export: {
        Args: { p_license_id: string }
        Returns: boolean
      }
      snp_peut_consulter_mouvement_stock: {
        Args: { p_inventory_id: string }
        Returns: boolean
      }
      snp_peut_consulter_production: {
        Args: { p_production_id: string }
        Returns: boolean
      }
      snp_peut_consulter_transport: {
        Args: { p_transport_id: string }
        Returns: boolean
      }
      snp_peut_consulter_vente: {
        Args: { p_sale_id: string }
        Returns: boolean
      }
      snp_peut_financer: { Args: { p_action?: string }; Returns: boolean }
      snp_peut_gerer_expedition: {
        Args: { p_expedition_id: string }
        Returns: boolean
      }
      snp_peut_gerer_sites_artisanaux: { Args: never; Returns: boolean }
      snp_peut_modifier_licence_export: {
        Args: { p_license_id: string }
        Returns: boolean
      }
      snp_peut_valider: { Args: never; Returns: boolean }
      snp_portail_mine_declarer_production: {
        Args: {
          p_date_production: string
          p_notes?: string
          p_poids_brut_grammes: number
          p_reference_barre?: string
          p_teneur_estimee_pct: number
        }
        Returns: string
      }
      snp_portail_mine_modifier_production: {
        Args: {
          p_date_production: string
          p_notes?: string
          p_poids_brut_grammes: number
          p_production_id: string
          p_reference_barre?: string
          p_teneur_estimee_pct: number
        }
        Returns: string
      }
      snp_portail_mine_repondre_reglement: {
        Args: { p_decision: string; p_motif?: string; p_reglement_id: string }
        Returns: undefined
      }
      snp_portail_mine_repondre_requisition: {
        Args: {
          p_commentaire: string
          p_decision: string
          p_requisition_id: string
        }
        Returns: {
          accord_mine: boolean | null
          accord_recu_le: string | null
          accuse_reception_le: string | null
          accuse_reception_par: string | null
          autorisee_par: string | null
          autorite_origine: string | null
          conditions_analyse: string | null
          conditions_transport: string | null
          confidentialite: string
          contestation_motif: string | null
          contestation_recue_le: string | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          date_autorisation: string | null
          date_cloture: string | null
          date_effet: string | null
          date_executoire: string | null
          date_notification: string | null
          date_signature_acte: string | null
          delai_mise_a_disposition_jours: number | null
          equipe: string | null
          id: string
          imputation_contractuelle: string | null
          imputation_decidee_le: string | null
          imputation_decidee_par: string | null
          imputation_motif: string | null
          lieu_enlevement: string | null
          lieu_stockage: string | null
          methode_prix: string
          mining_company_id: string | null
          modalites_enlevement: string | null
          modalites_paiement: string
          motif_statut: string | null
          nature_acte: string | null
          objet: string
          observations: string | null
          observations_mine: string | null
          observations_recues_le: string | null
          partenaire_type: string
          periode_debut: string | null
          periode_fin: string | null
          pourcentage_production: number | null
          prix_once_fcfa: number | null
          produits_concernes: string | null
          quantite_oz: number | null
          reference: string
          reference_acte: string | null
          regime_juridique: string
          responsable_id: string | null
          site_id: string | null
          statut: string
          teneur_estimee_pct: number | null
          type_requisition: string
          unite: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_requisitions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_portail_mine_soumettre_budget: {
        Args: { p_annee: number; p_budget_oz: number; p_mois: number }
        Returns: string
      }
      snp_portail_mine_soumettre_demande_licence_export: {
        Args: {
          p_commentaire: string
          p_date_export_souhaitee: string
          p_destination: string
          p_motif: string
          p_quantite_demandee_grammes: number
        }
        Returns: {
          comment: string | null
          created_at: string
          decision_reason: string | null
          desired_export_date: string
          destination: string
          id: string
          license_id: string | null
          mining_company_id: string
          reason: string
          requested_quantity_grams: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "snp_export_license_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_portail_mine_soumettre_prevision: {
        Args: {
          p_annee: number
          p_mois: number
          p_notes?: string
          p_prevision_oz: number
        }
        Returns: string
      }
      snp_portail_mine_supprimer_production: {
        Args: { p_production_id: string }
        Returns: undefined
      }
      snp_preparer_reglement: {
        Args: {
          p_affectations: Json
          p_compte_bancaire_id: string
          p_date_execution_prevue?: string
          p_mining_company_id: string
          p_montant: number
          p_objet?: string
          p_observations?: string
          p_reference_interne?: string
        }
        Returns: {
          r_affecte: number
          r_non_affecte: number
          r_reference: string
          r_reglement_id: string
        }[]
      }
      snp_preparer_reglement_legacy_4b: {
        Args: {
          p_affectations: Json
          p_compte_bancaire_id: string
          p_date_execution_prevue?: string
          p_mining_company_id: string
          p_montant: number
          p_objet?: string
          p_observations?: string
          p_reference_interne?: string
        }
        Returns: {
          r_affecte: number
          r_non_affecte: number
          r_reference: string
          r_reglement_id: string
        }[]
      }
      snp_recalculer_facture: {
        Args: { p_facture_id: string }
        Returns: undefined
      }
      snp_recompute_license_usage: {
        Args: { p_actor_id?: string; p_license_id: string }
        Returns: number
      }
      snp_record_comptoir_stock_movement: {
        Args: {
          p_artisan_id: string
          p_business_reference: string
          p_direction: string
          p_idempotency_key: string
          p_movement_type: string
          p_organization_id: string
          p_quantity_grams: number
          p_reason?: string
          p_reverses_entry_id?: string
          p_source_id?: string
          p_source_type?: string
        }
        Returns: string
      }
      snp_record_workflow_event: {
        Args: {
          p_action: string
          p_aggregate_id: string
          p_aggregate_type: string
          p_capability_code: string
          p_context?: Json
          p_reason?: string
          p_status_after: string
          p_status_before: string
        }
        Returns: number
      }
      snp_reglement_solde: { Args: { p_reglement_id: string }; Returns: number }
      snp_reglement_statuts_engageants: { Args: never; Returns: string[] }
      snp_reglement_statuts_payeurs: { Args: never; Returns: string[] }
      snp_reinitialiser_mfa: {
        Args: { p_motif: string; p_utilisateur_id: string }
        Returns: undefined
      }
      snp_release_shipping_license_quota: {
        Args: { p_reason: string; p_shipping_id: string }
        Returns: boolean
      }
      snp_release_shipping_reservation_internal: {
        Args: { p_actor_id: string; p_reason: string; p_shipping_id: string }
        Returns: boolean
      }
      snp_releve_societe: {
        Args: { p_debut?: string; p_fin?: string; p_mining_company_id: string }
        Returns: {
          credit: number
          debit: number
          libelle: string
          ligne_date: string
          piece_id: string
          reference: string
          solde: number
          statut: string
          type_operation: string
        }[]
      }
      snp_remplacer_habilitations_compte: {
        Args: { p_habilitations: Json; p_user_id: string }
        Returns: undefined
      }
      snp_renouveler_carte_professionnelle: {
        Args: {
          p_artisan_id: string
          p_date_expiration?: string
          p_observations?: string
        }
        Returns: {
          artisan_id: string
          carte_recto_url: string | null
          carte_verso_url: string | null
          created_at: string | null
          created_by: string | null
          date_emission: string
          date_expiration: string
          date_suspension: string | null
          date_validation: string | null
          id: string
          motif_suspension: string | null
          numero_carte: string
          numero_securite: string | null
          observations: string | null
          qr_code_data: string | null
          qr_code_url: string | null
          statut: string
          suspendue_le: string | null
          suspendue_par: string | null
          updated_at: string | null
          updated_by: string | null
          validee_le: string | null
          validee_par: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_cartes_professionnelles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_repartir_plan: {
        Args: { p_ecraser_ajustements?: boolean; p_plan_id: string }
        Returns: {
          lignes_creees: number
          lignes_mises_a_jour: number
          lignes_preservees: number
        }[]
      }
      snp_repondre_demande: {
        Args: { p_decision: string; p_demande_id: string; p_motif?: string }
        Returns: {
          r_achat_id: string
          r_demande_id: string
          r_facture_id: string
          r_numero_facture: string
        }[]
      }
      snp_repondre_vente_client: {
        Args: { p_decision: string; p_motif?: string; p_vente_id: string }
        Returns: Json
      }
      snp_require_active_session: { Args: never; Returns: undefined }
      snp_require_capability: {
        Args: { p_capability_code: string }
        Returns: undefined
      }
      snp_requisition_execution: {
        Args: { p_requisition_id: string }
        Returns: {
          montant_achats_fcfa: number
          montant_facture_fcfa: number
          montant_paye_fcfa: number
          nb_enlevements: number
          quantite_achetee: number
          quantite_collectee: number
          quantite_imputee_contrat: number
          quantite_requise: number
          quantite_restante: number
          solde_a_payer_fcfa: number
        }[]
      }
      snp_resoudre_regle_fiscale: {
        Args: {
          p_categorie_acheteur?: string
          p_code_taxe: string
          p_date: string
          p_profil_vendeur?: string
          p_valeur_seuil?: number
        }
        Returns: {
          abroge_le: string | null
          abroge_par: string | null
          approuve_le: string | null
          approuve_par: string | null
          assiette: string
          categorie_acheteur: string
          code_taxe: string
          commentaire: string | null
          cree_le: string
          cree_par: string | null
          date_effet: string
          date_fin: string | null
          devise_seuil: string | null
          id: string
          libelle: string
          mode_calcul: string
          montant_forfaitaire: number | null
          profil_vendeur: string
          reference_reglementaire: string | null
          seuil_max: number | null
          seuil_min: number | null
          statut: string
          taux: number | null
          unite_seuil: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "snp_regles_fiscales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_role_utilisateur: { Args: never; Returns: string }
      snp_sec_aal2: { Args: never; Returns: boolean }
      snp_sec_can_access_shipping_storage: {
        Args: { p_bucket_id: string; p_object_name: string; p_write?: boolean }
        Returns: boolean
      }
      snp_sec_can_admin_referentials: { Args: never; Returns: boolean }
      snp_sec_can_approve_shipping: {
        Args: { p_shipping_id: string }
        Returns: boolean
      }
      snp_sec_can_approve_workflow: { Args: never; Returns: boolean }
      snp_sec_can_delete_mining_document: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      snp_sec_can_prepare_company: {
        Args: { p_mining_company_id: string }
        Returns: boolean
      }
      snp_sec_can_prepare_shipping: {
        Args: { p_shipping_id: string }
        Returns: boolean
      }
      snp_sec_can_prepare_workflow: { Args: never; Returns: boolean }
      snp_sec_can_read_audit: { Args: never; Returns: boolean }
      snp_sec_can_read_company: {
        Args: { p_mining_company_id: string }
        Returns: boolean
      }
      snp_sec_can_read_mining_document: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      snp_sec_can_read_shipping: {
        Args: { p_shipping_id: string }
        Returns: boolean
      }
      snp_sec_can_write_mining_document: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      snp_sec_is_internal_reader: { Args: never; Returns: boolean }
      snp_sec_storage_shipping_id: {
        Args: { p_bucket_id: string; p_object_name: string }
        Returns: string
      }
      snp_session_current_expiry: { Args: never; Returns: string }
      snp_session_current_hash: { Args: never; Returns: string }
      snp_session_enregistrer: {
        Args: {
          p_browser?: string
          p_device_type?: string
          p_location_country?: string
          p_user_agent?: string
        }
        Returns: Database["public"]["CompositeTypes"]["snp_session_public"]
        SetofOptions: {
          from: "*"
          to: "snp_session_public"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_session_est_active: { Args: never; Returns: boolean }
      snp_session_request_ip: { Args: never; Returns: string }
      snp_session_require_access: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      snp_session_require_active_actor: { Args: never; Returns: undefined }
      snp_session_revoquer: {
        Args: { p_motif?: string; p_session_id: string }
        Returns: Database["public"]["CompositeTypes"]["snp_session_public"]
        SetofOptions: {
          from: "*"
          to: "snp_session_public"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_session_signaler_activite: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["snp_session_public"]
        SetofOptions: {
          from: "*"
          to: "snp_session_public"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_session_to_public: {
        Args: {
          p_current_hash: string
          p_session: Database["public"]["Tables"]["user_sessions"]["Row"]
        }
        Returns: Database["public"]["CompositeTypes"]["snp_session_public"]
        SetofOptions: {
          from: "*"
          to: "snp_session_public"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_sessions_lister: {
        Args: { p_actives_seulement?: boolean; p_user_id?: string }
        Returns: Database["public"]["CompositeTypes"]["snp_session_public"][]
        SetofOptions: {
          from: "*"
          to: "snp_session_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      snp_sessions_revoquer_toutes: {
        Args: {
          p_excepter_session_courante?: boolean
          p_motif?: string
          p_user_id?: string
        }
        Returns: number
      }
      snp_situation_societe: {
        Args: { p_mining_company_id: string }
        Returns: {
          anciennete_moyenne: number
          dette_echue: number
          facture_payee: number
          facture_total: number
          nb_echues: number
          nb_factures: number
          nb_ouvertes: number
          non_affecte: number
          plus_ancienne_echeance: string
          reglements_total: number
          reste_du: number
        }[]
      }
      snp_societe_compte_mine: { Args: never; Returns: string }
      snp_societe_utilisateur: { Args: never; Returns: string }
      snp_societes_eligibles_paiement: {
        Args: never
        Returns: {
          anciennete_jours: number
          code: string
          dette_echue: number
          devise: string
          mining_company_id: string
          nb_comptes_actifs: number
          nb_factures_ouvertes: number
          plus_ancienne_echeance: string
          plus_ancienne_facture: string
          reste_du: number
          societe: string
        }[]
      }
      snp_solde_commercial: {
        Args: { p_contrepartie_id: string; p_contrepartie_type: string }
        Returns: number
      }
      snp_solde_fiscal: {
        Args: { p_code_taxe: string; p_mining_company_id: string }
        Returns: number
      }
      snp_sonasp_decider_demande_licence_export: {
        Args: {
          p_commentaires?: string
          p_date_debut?: string
          p_date_fin?: string
          p_decision: string
          p_demande_id: string
          p_institution_emettrice?: string
          p_motif_decision?: string
          p_numero_licence?: string
          p_quantite_autorisee_grammes?: number
        }
        Returns: {
          comment: string | null
          created_at: string
          decision_reason: string | null
          desired_export_date: string
          destination: string
          id: string
          license_id: string | null
          mining_company_id: string
          reason: string
          requested_quantity_grams: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "snp_export_license_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_sonasp_modifier_licence_export: {
        Args: {
          p_authorized_quantity_grams?: number
          p_comments?: string
          p_end_date?: string
          p_expected_updated_at: string
          p_issuing_institution?: string
          p_license_id: string
          p_notes?: string
          p_reason?: string
          p_start_date?: string
          p_status?: string
        }
        Returns: {
          authorized_quantity_grams: number
          average_sale_price: number | null
          comments: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          issuing_institution: string
          license_number: string
          mining_company_id: string
          notes: string | null
          quota_baseline_used_grams: number
          remaining_quantity_grams: number
          request_date: string
          start_date: string
          status: string | null
          updated_at: string
          updated_by: string | null
          used_quantity_grams: number
        }
        SetofOptions: {
          from: "*"
          to: "export_licenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_soumettre_plan: {
        Args: { p_plan_id: string }
        Returns: {
          demandes_creees: number
        }[]
      }
      snp_stock_exportable_mine: {
        Args: never
        Returns: {
          disponible_grammes: number
          disponible_oz: number
          production_oz: number
          rachete_sonasp_oz: number
          suralloue: boolean
          vendu_mine_oz: number
        }[]
      }
      snp_storage_can_read_object: {
        Args: { p_bucket_id: string; p_object_name: string }
        Returns: boolean
      }
      snp_storage_reference_matches: {
        Args: {
          p_bucket_id: string
          p_object_name: string
          p_reference: string
        }
        Returns: boolean
      }
      snp_submit_comptoir_sale_to_sonasp: {
        Args: {
          p_notes?: string
          p_quantity_grams: number
          p_unit_price_fcfa: number
        }
        Returns: string
      }
      snp_supprimer_configuration_courriel: {
        Args: { p_uid: string }
        Returns: undefined
      }
      snp_sync_shipping_license_reservation: {
        Args: { p_actor_id?: string; p_shipping_id: string }
        Returns: boolean
      }
      snp_tracer_acces_document: {
        Args: {
          p_action?: string
          p_chemin: string
          p_document_id?: string
          p_domaine: string
          p_objet_id?: string
        }
        Returns: undefined
      }
      snp_trancher_teneur: {
        Args: {
          p_analyse_id: string
          p_justification: string
          p_teneur_retenue: number
        }
        Returns: {
          achat_id: string | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          date_declaration: string | null
          date_prelevement: string | null
          decision: string | null
          declaree_par: string | null
          enlevement_id: string | null
          id: string
          justification_retenue: string | null
          lieu_prelevement: string | null
          masse_echantillon_g: number | null
          masse_lot_oz: number | null
          methode_echantillonnage: string | null
          mining_company_id: string | null
          motif_statut: string | null
          numero_echantillon: string | null
          observations: string | null
          reference: string
          requisition_id: string | null
          retenue_le: string | null
          retenue_par: string | null
          statut: string
          teneur_declaree_pct: number
          teneur_retenue_pct: number | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_analyses_teneur"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_transition_carte_professionnelle: {
        Args: {
          p_carte_id: string
          p_expected_statut: string
          p_motif?: string
          p_nouveau_statut: string
        }
        Returns: {
          artisan_id: string
          carte_recto_url: string | null
          carte_verso_url: string | null
          created_at: string | null
          created_by: string | null
          date_emission: string
          date_expiration: string
          date_suspension: string | null
          date_validation: string | null
          id: string
          motif_suspension: string | null
          numero_carte: string
          numero_securite: string | null
          observations: string | null
          qr_code_data: string | null
          qr_code_url: string | null
          statut: string
          suspendue_le: string | null
          suspendue_par: string | null
          updated_at: string | null
          updated_by: string | null
          validee_le: string | null
          validee_par: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_cartes_professionnelles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_transition_comptoir_sale_to_sonasp: {
        Args: { p_notes?: string; p_sale_id: string; p_target_status: string }
        Returns: undefined
      }
      snp_transition_daily_production: {
        Args: {
          p_expected_status: string
          p_new_status: string
          p_notes?: string
          p_production_id: string
          p_request_id: string
        }
        Returns: Json
      }
      snp_transition_shipping_preparation: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["shipping_preparation_status"]
          p_new_status: Database["public"]["Enums"]["shipping_preparation_status"]
          p_shipping_id: string
        }
        Returns: Json
      }
      snp_transitions_contrat: { Args: { p_statut: string }; Returns: string[] }
      snp_transitions_reglement: {
        Args: { p_statut: string }
        Returns: string[]
      }
      snp_transitions_requisition: {
        Args: { p_statut: string }
        Returns: string[]
      }
      snp_troy_ounces_to_grams: { Args: { p_ounces: number }; Returns: number }
      snp_upsert_artisan_moyen_paiement: {
        Args: {
          p_actif?: boolean
          p_artisan_id: string
          p_banque?: string
          p_code_swift?: string
          p_est_principal?: boolean
          p_libelle?: string
          p_moyen_id?: string
          p_numero_compte?: string
          p_numero_telephone?: string
          p_observations?: string
          p_titulaire: string
          p_type: string
        }
        Returns: {
          actif: boolean
          artisan_id: string
          banque: string | null
          code_swift: string | null
          created_at: string
          created_by: string | null
          est_principal: boolean
          id: string
          libelle: string | null
          numero_compte: string | null
          numero_telephone: string | null
          observations: string | null
          titulaire: string
          type: string
          updated_at: string
          updated_by: string | null
          verifie_le: string | null
          verifie_par: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_artisan_moyens_paiement"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_vente_a_valider_client: {
        Args: { p_vente_id: string }
        Returns: Json
      }
      snp_verifier_artisan_moyen_paiement: {
        Args: { p_approuve: boolean; p_motif?: string; p_moyen_id: string }
        Returns: {
          actif: boolean
          artisan_id: string
          banque: string | null
          code_swift: string | null
          created_at: string
          created_by: string | null
          est_principal: boolean
          id: string
          libelle: string | null
          numero_compte: string | null
          numero_telephone: string | null
          observations: string | null
          titulaire: string
          type: string
          updated_at: string
          updated_by: string | null
          verifie_le: string | null
          verifie_par: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_artisan_moyens_paiement"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snp_verifier_preuve_reglement: {
        Args: { p_decision: string; p_motif?: string; p_preuve_id: string }
        Returns: {
          ajoute_le: string
          ajoute_par: string | null
          banque_emettrice: string | null
          commentaire: string | null
          date_emission: string | null
          empreinte_sha256: string | null
          fichier_url: string
          id: string
          motif_rejet: string | null
          nom_origine: string
          reference_document: string | null
          reglement_id: string
          statut_verification: string
          taille_octets: number
          type_document: string
          type_mime: string
          verifiee_le: string | null
          verifiee_par: string | null
        }
        SetofOptions: {
          from: "*"
          to: "snp_reglements_preuves"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_artisan_metrics: {
        Args: {
          p_artisan_id: string
          p_montant_fcfa: number
          p_quantite_grammes: number
        }
        Returns: undefined
      }
      user_accessible_companies: { Args: never; Returns: string[] }
      user_has_company_access: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      user_has_role: { Args: { required_role: string }; Returns: boolean }
      validate_activation_token: {
        Args: { p_token: string }
        Returns: {
          is_valid: boolean
          temporary_password: string
          token_type: string
          user_id: string
        }[]
      }
      validate_artisan_actif_pour_vente: {
        Args: { p_artisan_id: string }
        Returns: boolean
      }
      validate_password_strength: {
        Args: { password: string }
        Returns: boolean
      }
      validate_sales_status_transition: {
        Args: { p_new_status: string; p_old_status: string }
        Returns: boolean
      }
    }
    Enums: {
      company_type_enum: "production_mine" | "institution" | "parent_company"
      depositor_category:
        | "general_management"
        | "general_management_backup"
        | "finance"
        | "finance_backup"
        | "bullion_dispatch"
        | "sale_of_gold"
        | "pmr_assay"
        | "security"
        | "security_backup"
        | "legal"
        | "legal_backup"
      freight_customs_status:
        | "waiting_for_shipping"
        | "shipped_for_refinery"
        | "customs_pending"
        | "customs_approved"
        | "ready_for_transport"
        | "shipped_to_refinery"
      freight_document_type:
        | "customs_declaration"
        | "customs_approval"
        | "transport_document"
        | "bill_of_lading"
        | "export_invoice"
        | "bullion_summary"
        | "other"
      freight_shipment_status:
        | "pending"
        | "approved"
        | "shipped_to_refinery"
        | "received_at_refinery"
        | "processing"
        | "processed"
        | "in_stock"
      inventory_status: "in_stock" | "reserved" | "sold"
      production_status: "prepared" | "shipped" | "refined" | "sold"
      production_status_v2: "prepared" | "ready_for_customs" | "cancelled"
      quota_transaction_type:
        | "RESERVE"
        | "CONSUME"
        | "RELEASE"
        | "ADJUST"
        | "EXPIRE"
      refinery_status:
        | "waiting_for_refinery_approval"
        | "refinery_approved"
        | "refined"
        | "cancelled"
      sale_status:
        | "for_sale"
        | "sold"
        | "paid"
        | "create_sales"
        | "pending_management_approval"
        | "management_approved"
        | "management_rejected"
        | "pending_for_customer_approval"
        | "customer_approved"
        | "customer_rejected"
        | "waiting_for_payment"
        | "virtual_payment"
        | "payment_received"
        | "completed"
        | "cancelled"
      shipping_preparation_status:
        | "waiting_for_customs_approval"
        | "approved_by_customs"
        | "ready_for_expedition"
      status_change_context:
        | "production_management"
        | "shipping_management"
        | "refining_process"
        | "sales_management"
        | "inventory_management"
        | "system"
      workflow_change_type:
        | "created"
        | "status_added"
        | "status_removed"
        | "status_updated"
        | "transition_added"
        | "transition_removed"
        | "workflow_activated"
        | "workflow_deactivated"
      workflow_type:
        | "production"
        | "shipping"
        | "payment"
        | "refining"
        | "sales"
    }
    CompositeTypes: {
      snp_session_public: {
        id: string | null
        user_id: string | null
        ip_address: string | null
        user_agent: string | null
        device_type: string | null
        browser: string | null
        location_country: string | null
        last_activity_at: string | null
        expires_at: string | null
        is_active: boolean | null
        is_current: boolean | null
        created_at: string | null
        revoked_at: string | null
        revoked_by: string | null
        revocation_reason: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      company_type_enum: ["production_mine", "institution", "parent_company"],
      depositor_category: [
        "general_management",
        "general_management_backup",
        "finance",
        "finance_backup",
        "bullion_dispatch",
        "sale_of_gold",
        "pmr_assay",
        "security",
        "security_backup",
        "legal",
        "legal_backup",
      ],
      freight_customs_status: [
        "waiting_for_shipping",
        "shipped_for_refinery",
        "customs_pending",
        "customs_approved",
        "ready_for_transport",
        "shipped_to_refinery",
      ],
      freight_document_type: [
        "customs_declaration",
        "customs_approval",
        "transport_document",
        "bill_of_lading",
        "export_invoice",
        "bullion_summary",
        "other",
      ],
      freight_shipment_status: [
        "pending",
        "approved",
        "shipped_to_refinery",
        "received_at_refinery",
        "processing",
        "processed",
        "in_stock",
      ],
      inventory_status: ["in_stock", "reserved", "sold"],
      production_status: ["prepared", "shipped", "refined", "sold"],
      production_status_v2: ["prepared", "ready_for_customs", "cancelled"],
      quota_transaction_type: [
        "RESERVE",
        "CONSUME",
        "RELEASE",
        "ADJUST",
        "EXPIRE",
      ],
      refinery_status: [
        "waiting_for_refinery_approval",
        "refinery_approved",
        "refined",
        "cancelled",
      ],
      sale_status: [
        "for_sale",
        "sold",
        "paid",
        "create_sales",
        "pending_management_approval",
        "management_approved",
        "management_rejected",
        "pending_for_customer_approval",
        "customer_approved",
        "customer_rejected",
        "waiting_for_payment",
        "virtual_payment",
        "payment_received",
        "completed",
        "cancelled",
      ],
      shipping_preparation_status: [
        "waiting_for_customs_approval",
        "approved_by_customs",
        "ready_for_expedition",
      ],
      status_change_context: [
        "production_management",
        "shipping_management",
        "refining_process",
        "sales_management",
        "inventory_management",
        "system",
      ],
      workflow_change_type: [
        "created",
        "status_added",
        "status_removed",
        "status_updated",
        "transition_added",
        "transition_removed",
        "workflow_activated",
        "workflow_deactivated",
      ],
      workflow_type: ["production", "shipping", "payment", "refining", "sales"],
    },
  },
} as const
