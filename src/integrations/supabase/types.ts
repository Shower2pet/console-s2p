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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      credit_packages: {
        Row: {
          credits_value: number
          id: string
          is_active: boolean | null
          name: string | null
          owner_id: string | null
          price_eur: number
          structure_id: string | null
        }
        Insert: {
          credits_value: number
          id?: string
          is_active?: boolean | null
          name?: string | null
          owner_id?: string | null
          price_eur: number
          structure_id?: string | null
        }
        Update: {
          credits_value?: number
          id?: string
          is_active?: boolean | null
          name?: string | null
          owner_id?: string | null
          price_eur?: number
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_packages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_packages_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          notes: string | null
          performed_by: string | null
          reason: string | null
          severity: string | null
          started_at: string | null
          station_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          performed_by?: string | null
          reason?: string | null
          severity?: string | null
          started_at?: string | null
          station_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          performed_by?: string | null
          reason?: string | null
          severity?: string | null
          started_at?: string | null
          station_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      partners_fiscal_data: {
        Row: {
          business_name: string
          fiscal_api_credentials: Json | null
          is_active: boolean | null
          profile_id: string
          sdi_code: string | null
          vat_number: string
        }
        Insert: {
          business_name: string
          fiscal_api_credentials?: Json | null
          is_active?: boolean | null
          profile_id: string
          sdi_code?: string | null
          vat_number: string
        }
        Update: {
          business_name?: string
          fiscal_api_credentials?: Json | null
          is_active?: boolean | null
          profile_id?: string
          sdi_code?: string | null
          vat_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_fiscal_data_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          must_change_password: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          must_change_password?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          must_change_password?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      station_access_logs: {
        Row: {
          created_at: string
          id: string
          station_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          station_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          station_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          access_token: string | null
          category: string | null
          created_at: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          image_url: string | null
          last_heartbeat_at: string | null
          owner_id: string | null
          status: Database["public"]["Enums"]["station_status"] | null
          structure_id: string | null
          type: string
          visibility: Database["public"]["Enums"]["visibility_type"] | null
          washing_options: Json | null
        }
        Insert: {
          access_token?: string | null
          category?: string | null
          created_at?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id: string
          image_url?: string | null
          last_heartbeat_at?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["station_status"] | null
          structure_id?: string | null
          type: string
          visibility?: Database["public"]["Enums"]["visibility_type"] | null
          washing_options?: Json | null
        }
        Update: {
          access_token?: string | null
          category?: string | null
          created_at?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          image_url?: string | null
          last_heartbeat_at?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["station_status"] | null
          structure_id?: string | null
          type?: string
          visibility?: Database["public"]["Enums"]["visibility_type"] | null
          washing_options?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "stations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stations_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_managers: {
        Row: {
          created_at: string | null
          id: string
          permissions: Json | null
          structure_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          structure_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          structure_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structure_managers_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_wallets: {
        Row: {
          balance: number | null
          id: string
          structure_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          id?: string
          structure_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          id?: string
          structure_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structure_wallets_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      structures: {
        Row: {
          address: string | null
          created_at: string | null
          description: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          image_url: string | null
          name: string
          owner_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          image_url?: string | null
          name: string
          owner_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          image_url?: string | null
          name?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structures_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          interval: string
          is_active: boolean | null
          max_washes_per_month: number | null
          name: string
          owner_id: string
          price_eur: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          structure_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          interval?: string
          is_active?: boolean | null
          max_washes_per_month?: number | null
          name: string
          owner_id: string
          price_eur: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          structure_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          interval?: string
          is_active?: boolean | null
          max_washes_per_month?: number | null
          name?: string
          owner_id?: string
          price_eur?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_paid_stripe: number | null
          amount_paid_wallet: number | null
          created_at: string | null
          credits_purchased: number | null
          fiscal_doc_url: string | null
          fiscal_error_log: string | null
          fiscal_status: string | null
          guest_email: string | null
          id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          station_id: string | null
          status: string | null
          stripe_payment_id: string | null
          structure_id: string | null
          total_value: number
          transaction_type: Database["public"]["Enums"]["transaction_type_enum"]
          user_id: string | null
        }
        Insert: {
          amount_paid_stripe?: number | null
          amount_paid_wallet?: number | null
          created_at?: string | null
          credits_purchased?: number | null
          fiscal_doc_url?: string | null
          fiscal_error_log?: string | null
          fiscal_status?: string | null
          guest_email?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          station_id?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          structure_id?: string | null
          total_value: number
          transaction_type: Database["public"]["Enums"]["transaction_type_enum"]
          user_id?: string | null
        }
        Update: {
          amount_paid_stripe?: number | null
          amount_paid_wallet?: number | null
          created_at?: string | null
          credits_purchased?: number | null
          fiscal_doc_url?: string | null
          fiscal_error_log?: string | null
          fiscal_status?: string | null
          guest_email?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          station_id?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          structure_id?: string | null
          total_value?: number
          transaction_type?: Database["public"]["Enums"]["transaction_type_enum"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          current_period_start: string | null
          ends_at: string | null
          id: string
          plan_id: string
          starts_at: string
          status: string
          stripe_subscription_id: string | null
          user_id: string
          washes_used_this_period: number | null
        }
        Insert: {
          created_at?: string | null
          current_period_start?: string | null
          ends_at?: string | null
          id?: string
          plan_id: string
          starts_at?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id: string
          washes_used_this_period?: number | null
        }
        Update: {
          created_at?: string | null
          current_period_start?: string | null
          ends_at?: string | null
          id?: string
          plan_id?: string
          starts_at?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id?: string
          washes_used_this_period?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      wash_sessions: {
        Row: {
          created_at: string
          ends_at: string
          guest_email: string | null
          id: string
          option_id: number
          option_name: string
          started_at: string
          station_id: string
          status: string
          step: string
          stripe_session_id: string | null
          total_seconds: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          ends_at: string
          guest_email?: string | null
          id?: string
          option_id: number
          option_name: string
          started_at?: string
          station_id: string
          status?: string
          step?: string
          stripe_session_id?: string | null
          total_seconds: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string
          guest_email?: string | null
          id?: string
          option_id?: number
          option_name?: string
          started_at?: string
          station_id?: string
          status?: string
          step?: string
          stripe_session_id?: string | null
          total_seconds?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wash_sessions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_stations: {
        Args: never
        Returns: {
          category: string
          created_at: string
          geo_lat: number
          geo_lng: number
          id: string
          image_url: string
          last_heartbeat_at: string
          status: string
          structure_id: string
          type: string
          visibility: string
          washing_options: Json
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_manager_of: { Args: { struct_id: string }; Returns: boolean }
    }
    Enums: {
      payment_method_type: "STRIPE" | "CREDITS" | "HYBRID"
      station_status: "AVAILABLE" | "BUSY" | "OFFLINE" | "MAINTENANCE"
      transaction_type_enum: "CREDIT_TOPUP" | "WASH_SERVICE" | "GUEST_WASH"
      user_role: "admin" | "partner" | "manager" | "user"
      visibility_type: "PUBLIC" | "RESTRICTED" | "HIDDEN"
    }
    CompositeTypes: {
      [_ in never]: never
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
  public: {
    Enums: {
      payment_method_type: ["STRIPE", "CREDITS", "HYBRID"],
      station_status: ["AVAILABLE", "BUSY", "OFFLINE", "MAINTENANCE"],
      transaction_type_enum: ["CREDIT_TOPUP", "WASH_SERVICE", "GUEST_WASH"],
      user_role: ["admin", "partner", "manager", "user"],
      visibility_type: ["PUBLIC", "RESTRICTED", "HIDDEN"],
    },
  },
} as const
