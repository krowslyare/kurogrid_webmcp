export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      action_plan_steps: {
        Row: {
          action_plan_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["action_plan_step_kind"]
          organization_id: string
          position: number
          title: string
        }
        Insert: {
          action_plan_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["action_plan_step_kind"]
          organization_id: string
          position: number
          title: string
        }
        Update: {
          action_plan_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["action_plan_step_kind"]
          organization_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_steps_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          attention_item_id: string
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          organization_id: string
        }
        Insert: {
          attention_item_id: string
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          organization_id: string
        }
        Update: {
          attention_item_id?: string
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_attention_item_id_fkey"
            columns: ["attention_item_id"]
            isOneToOne: true
            referencedRelation: "attention_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_items: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          evidence: Json
          id: string
          kind: Database["public"]["Enums"]["attention_kind"]
          organization_id: string
          revision: number
          status: Database["public"]["Enums"]["attention_status"]
          summary: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          evidence: Json
          id?: string
          kind: Database["public"]["Enums"]["attention_kind"]
          organization_id: string
          revision?: number
          status?: Database["public"]["Enums"]["attention_status"]
          summary: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          kind?: Database["public"]["Enums"]["attention_kind"]
          organization_id?: string
          revision?: number
          status?: Database["public"]["Enums"]["attention_status"]
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: number
          metadata: Json
          organization_id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          organization_id: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          organization_id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      publication_operations: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["publication_operation_kind"]
          organization_id: string
          result_version_id: string
          site_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["publication_operation_kind"]
          organization_id: string
          result_version_id: string
          site_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["publication_operation_kind"]
          organization_id?: string
          result_version_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_operations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_operations_result_version_id_fkey"
            columns: ["result_version_id"]
            isOneToOne: false
            referencedRelation: "site_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_operations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_approvals: {
        Row: {
          approved_at: string
          approved_by: string
          consequence_hash: string
          consumed_at: string | null
          content_hash: string
          draft_id: string
          draft_revision: number
          expires_at: string
          id: string
          organization_id: string
          site_id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          consequence_hash: string
          consumed_at?: string | null
          content_hash: string
          draft_id: string
          draft_revision: number
          expires_at?: string
          id?: string
          organization_id: string
          site_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          consequence_hash?: string
          consumed_at?: string | null
          content_hash?: string
          draft_id?: string
          draft_revision?: number
          expires_at?: string
          id?: string
          organization_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_approvals_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "site_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_approvals_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_drafts: {
        Row: {
          content: Json
          id: string
          organization_id: string
          revision: number
          site_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          content: Json
          id?: string
          organization_id: string
          revision?: number
          site_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          content?: Json
          id?: string
          organization_id?: string
          revision?: number
          site_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_drafts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_versions: {
        Row: {
          content: Json
          content_hash: string
          id: string
          organization_id: string
          published_at: string
          published_by: string
          site_id: string
          source_draft_id: string | null
          source_draft_revision: number
          version_number: number
        }
        Insert: {
          content: Json
          content_hash: string
          id?: string
          organization_id: string
          published_at?: string
          published_by: string
          site_id: string
          source_draft_id?: string | null
          source_draft_revision: number
          version_number: number
        }
        Update: {
          content?: Json
          content_hash?: string
          id?: string
          organization_id?: string
          published_at?: string
          published_by?: string
          site_id?: string
          source_draft_id?: string | null
          source_draft_revision?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_versions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_versions_source_draft_id_fkey"
            columns: ["source_draft_id"]
            isOneToOne: false
            referencedRelation: "site_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          published_version_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          published_version_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          published_version_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_published_version_id_fkey"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "site_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_lead_attention: {
        Args: { p_attention_item_id: string; p_expected_revision: number }
        Returns: number
      }
      approve_site_draft: {
        Args: {
          p_consequence_hash: string
          p_draft_id: string
          p_expected_revision: number
        }
        Returns: string
      }
      create_action_plan: {
        Args: { p_attention_item_id: string; p_idempotency_key: string }
        Returns: string
      }
      create_or_patch_site_draft: {
        Args: {
          p_content: Json
          p_expected_revision: number
          p_site_id: string
        }
        Returns: {
          content: Json
          id: string
          organization_id: string
          revision: number
          site_id: string
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "site_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_published_site: {
        Args: { p_slug: string }
        Returns: {
          content: Json
          content_hash: string
          published_at: string
          site_slug: string
          version_id: string
          version_number: number
        }[]
      }
      preview_publish_consequences: {
        Args: { p_draft_id: string }
        Returns: Json
      }
      publish_site_draft: {
        Args: {
          p_approval_id: string
          p_consequence_hash: string
          p_draft_id: string
          p_expected_revision: number
          p_idempotency_key: string
        }
        Returns: string
      }
      rollback_site_version: {
        Args: {
          p_idempotency_key: string
          p_site_id: string
          p_target_version_id: string
        }
        Returns: string
      }
    }
    Enums: {
      action_plan_step_kind:
        | "acknowledge_attention"
        | "draft_site_update"
        | "review_publication"
      attention_kind: "synthetic_lead" | "analytics_snapshot" | "verified_fact"
      attention_status: "open" | "acknowledged"
      organization_role: "owner" | "member"
      publication_operation_kind: "publish" | "rollback"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      action_plan_step_kind: [
        "acknowledge_attention",
        "draft_site_update",
        "review_publication",
      ],
      attention_kind: ["synthetic_lead", "analytics_snapshot", "verified_fact"],
      attention_status: ["open", "acknowledged"],
      organization_role: ["owner", "member"],
      publication_operation_kind: ["publish", "rollback"],
    },
  },
} as const
