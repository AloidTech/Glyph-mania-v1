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
    PostgrestVersion: "14.5"
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
      glyphs: {
        Row: {
          composition: Json
          consumed: boolean
          cover_asset: string | null
          description: string | null
          element: Database["public"]["Enums"]["element_type"] | null
          id: string
          is_public: boolean
          is_pvp: boolean
          name: string | null
          ring_closed: boolean
          saved_at: string
          schema_id: string | null
          source_glyph_id: string | null
          tier_id: string
          user_id: string
        }
        Insert: {
          composition?: Json
          consumed?: boolean
          cover_asset?: string | null
          description?: string | null
          element?: Database["public"]["Enums"]["element_type"] | null
          id?: string
          is_public?: boolean
          is_pvp?: boolean
          name?: string | null
          ring_closed?: boolean
          saved_at?: string
          schema_id?: string | null
          source_glyph_id?: string | null
          tier_id: string
          user_id: string
        }
        Update: {
          composition?: Json
          consumed?: boolean
          cover_asset?: string | null
          description?: string | null
          element?: Database["public"]["Enums"]["element_type"] | null
          id?: string
          is_public?: boolean
          is_pvp?: boolean
          name?: string | null
          ring_closed?: boolean
          saved_at?: string
          schema_id?: string | null
          source_glyph_id?: string | null
          tier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "glyphs_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "schemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glyphs_source_glyph_id_fkey"
            columns: ["source_glyph_id"]
            isOneToOne: false
            referencedRelation: "glyphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glyphs_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_models: {
        Row: {
          batch_size: number | null
          class_labels: string[]
          created_at: string
          description: string | null
          epochs: number
          final_accuracy: number
          final_loss: number
          history: Json | null
          id: string
          name: string
          total_examples_count: number
          updated_at: string
          weights: Json
        }
        Insert: {
          batch_size?: number | null
          class_labels: string[]
          created_at?: string
          description?: string | null
          epochs: number
          final_accuracy: number
          final_loss: number
          history?: Json | null
          id: string
          name: string
          total_examples_count: number
          updated_at?: string
          weights: Json
        }
        Update: {
          batch_size?: number | null
          class_labels?: string[]
          created_at?: string
          description?: string | null
          epochs?: number
          final_accuracy?: number
          final_loss?: number
          history?: Json | null
          id?: string
          name?: string
          total_examples_count?: number
          updated_at?: string
          weights?: Json
        }
        Relationships: []
      }
      schemas: {
        Row: {
          center_slot: string | null
          created_at: string
          form_slots: Json
          id: string
          label: string
          position_slots: Json
          tier_id: string
        }
        Insert: {
          center_slot?: string | null
          created_at?: string
          form_slots?: Json
          id?: string
          label: string
          position_slots?: Json
          tier_id: string
        }
        Update: {
          center_slot?: string | null
          created_at?: string
          form_slots?: Json
          id?: string
          label?: string
          position_slots?: Json
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schemas_center_slot_fkey"
            columns: ["center_slot"]
            isOneToOne: false
            referencedRelation: "sigils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schemas_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      sigils: {
        Row: {
          augmentor_type: Database["public"]["Enums"]["augmentor_kind"] | null
          cover_asset: string
          description: string
          element: Database["public"]["Enums"]["element_type"] | null
          form_type: Database["public"]["Enums"]["form_type"] | null
          id: string
          label: string
          texture_key: string
          tier: number
          type: Database["public"]["Enums"]["sigil_kind"]
        }
        Insert: {
          augmentor_type?: Database["public"]["Enums"]["augmentor_kind"] | null
          cover_asset: string
          description: string
          element?: Database["public"]["Enums"]["element_type"] | null
          form_type?: Database["public"]["Enums"]["form_type"] | null
          id?: string
          label: string
          texture_key: string
          tier?: number
          type: Database["public"]["Enums"]["sigil_kind"]
        }
        Update: {
          augmentor_type?: Database["public"]["Enums"]["augmentor_kind"] | null
          cover_asset?: string
          description?: string
          element?: Database["public"]["Enums"]["element_type"] | null
          form_type?: Database["public"]["Enums"]["form_type"] | null
          id?: string
          label?: string
          texture_key?: string
          tier?: number
          type?: Database["public"]["Enums"]["sigil_kind"]
        }
        Relationships: []
      }
      tiers: {
        Row: {
          form_slot_count: number
          id: string
          level: number
          position_slot_count: number
        }
        Insert: {
          form_slot_count?: number
          id?: string
          level: number
          position_slot_count?: number
        }
        Update: {
          form_slot_count?: number
          id?: string
          level?: number
          position_slot_count?: number
        }
        Relationships: []
      }
      training_examples: {
        Row: {
          created_at: string
          first_model_trained_id: string | null
          id: string
          last_model_trained_id: string | null
          sigil_id: string
          thumb: string
          updated_at: string
          vec: number[]
        }
        Insert: {
          created_at?: string
          first_model_trained_id?: string | null
          id: string
          last_model_trained_id?: string | null
          sigil_id: string
          thumb: string
          updated_at?: string
          vec: number[]
        }
        Update: {
          created_at?: string
          first_model_trained_id?: string | null
          id?: string
          last_model_trained_id?: string | null
          sigil_id?: string
          thumb?: string
          updated_at?: string
          vec?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "training_examples_first_model_trained_id_fkey"
            columns: ["first_model_trained_id"]
            isOneToOne: false
            referencedRelation: "saved_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_examples_last_model_trained_id_fkey"
            columns: ["last_model_trained_id"]
            isOneToOne: false
            referencedRelation: "saved_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_examples_sigil_id_fkey"
            columns: ["sigil_id"]
            isOneToOne: false
            referencedRelation: "sigils"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      augmentor_kind: "position" | "form"
      element_type: "fire" | "water" | "earth" | "air"
      form_type: "dash" | "whirl" | "condense" | "compress"
      sigil_kind: "effector" | "augmentor"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      augmentor_kind: ["position", "form"],
      element_type: ["fire", "water", "earth", "air"],
      form_type: ["dash", "whirl", "condense", "compress"],
      sigil_kind: ["effector", "augmentor"],
    },
  },
} as const
