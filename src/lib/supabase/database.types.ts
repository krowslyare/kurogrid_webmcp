export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      action_plan_steps: {
        Row: {
          action_plan_id: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["action_plan_step_kind"];
          organization_id: string;
          position: number;
          title: string;
        };
        Insert: {
          action_plan_id: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["action_plan_step_kind"];
          organization_id: string;
          position: number;
          title: string;
        };
        Update: {
          action_plan_id?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["action_plan_step_kind"];
          organization_id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_plan_steps_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_plan_steps_plan_tenant_fkey";
            columns: ["action_plan_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "action_plans";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      action_plans: {
        Row: {
          attention_item_id: string;
          created_at: string;
          created_by: string;
          id: string;
          idempotency_key: string;
          organization_id: string;
        };
        Insert: {
          attention_item_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          idempotency_key: string;
          organization_id: string;
        };
        Update: {
          attention_item_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          idempotency_key?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_plans_attention_tenant_fkey";
            columns: ["attention_item_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "attention_items";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "action_plans_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_requests: {
        Row: {
          access_token: string;
          confirmation_token: string;
          confirmed_at: string | null;
          created_at: string;
          customer_email: string;
          id: string;
          idempotency_key: string;
          organization_id: string;
          pet_name: string;
          proposed_starts_at: string | null;
          service_id: string;
          site_id: string;
          slot_id: string;
          status: Database["public"]["Enums"]["appointment_request_status"];
          updated_at: string;
        };
        Insert: {
          access_token?: string;
          confirmation_token?: string;
          confirmed_at?: string | null;
          created_at?: string;
          customer_email: string;
          id?: string;
          idempotency_key: string;
          organization_id: string;
          pet_name: string;
          proposed_starts_at?: string | null;
          service_id: string;
          site_id: string;
          slot_id: string;
          status?: Database["public"]["Enums"]["appointment_request_status"];
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          confirmation_token?: string;
          confirmed_at?: string | null;
          created_at?: string;
          customer_email?: string;
          id?: string;
          idempotency_key?: string;
          organization_id?: string;
          pet_name?: string;
          proposed_starts_at?: string | null;
          service_id?: string;
          site_id?: string;
          slot_id?: string;
          status?: Database["public"]["Enums"]["appointment_request_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_requests_service_tenant_fkey";
            columns: ["service_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "clinic_services";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "appointment_requests_site_tenant_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "appointment_requests_slot_tenant_fkey";
            columns: ["slot_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "appointment_slots";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      appointment_slots: {
        Row: {
          available: boolean;
          created_at: string;
          id: string;
          organization_id: string;
          service_id: string;
          site_id: string;
          starts_at: string;
        };
        Insert: {
          available?: boolean;
          created_at?: string;
          id?: string;
          organization_id: string;
          service_id: string;
          site_id: string;
          starts_at: string;
        };
        Update: {
          available?: boolean;
          created_at?: string;
          id?: string;
          organization_id?: string;
          service_id?: string;
          site_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_slots_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_slots_service_tenant_fkey";
            columns: ["service_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "clinic_services";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "appointment_slots_site_tenant_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      attention_items: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          created_at: string;
          evidence: Json;
          id: string;
          kind: Database["public"]["Enums"]["attention_kind"];
          organization_id: string;
          revision: number;
          status: Database["public"]["Enums"]["attention_status"];
          summary: string;
          title: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          evidence: Json;
          id?: string;
          kind: Database["public"]["Enums"]["attention_kind"];
          organization_id: string;
          revision?: number;
          status?: Database["public"]["Enums"]["attention_status"];
          summary: string;
          title: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          evidence?: Json;
          id?: string;
          kind?: Database["public"]["Enums"]["attention_kind"];
          organization_id?: string;
          revision?: number;
          status?: Database["public"]["Enums"]["attention_status"];
          summary?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attention_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          id: number;
          metadata: Json;
          organization_id: string;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: never;
          metadata?: Json;
          organization_id: string;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: never;
          metadata?: Json;
          organization_id?: string;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_services: {
        Row: {
          active: boolean;
          created_at: string;
          description: string;
          duration_minutes: number;
          id: string;
          name: string;
          organization_id: string;
          site_id: string;
          slug: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description: string;
          duration_minutes: number;
          id?: string;
          name: string;
          organization_id: string;
          site_id: string;
          slug: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string;
          duration_minutes?: number;
          id?: string;
          name?: string;
          organization_id?: string;
          site_id?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_services_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinic_services_site_tenant_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      demo_leases: {
        Row: {
          auth_session_id: string | null;
          expires_at: string;
          id: string;
          lease_token_hash: string;
          leased_at: string;
          released_at: string | null;
          requested_role: Database["public"]["Enums"]["organization_role"];
          sandbox_id: string;
        };
        Insert: {
          auth_session_id?: string | null;
          expires_at: string;
          id?: string;
          lease_token_hash: string;
          leased_at?: string;
          released_at?: string | null;
          requested_role: Database["public"]["Enums"]["organization_role"];
          sandbox_id: string;
        };
        Update: {
          auth_session_id?: string | null;
          expires_at?: string;
          id?: string;
          lease_token_hash?: string;
          leased_at?: string;
          released_at?: string | null;
          requested_role?: Database["public"]["Enums"]["organization_role"];
          sandbox_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "demo_leases_sandbox_id_fkey";
            columns: ["sandbox_id"];
            isOneToOne: false;
            referencedRelation: "demo_sandboxes";
            referencedColumns: ["id"];
          },
        ];
      };
      demo_runtime_config: {
        Row: {
          capacity: number;
          lease_minutes: number;
          singleton: boolean;
          updated_at: string;
        };
        Insert: {
          capacity?: number;
          lease_minutes?: number;
          singleton?: boolean;
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          lease_minutes?: number;
          singleton?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      demo_sandboxes: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          member_user_id: string;
          organization_id: string;
          owner_user_id: string;
          slot_number: number;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          member_user_id: string;
          organization_id: string;
          owner_user_id: string;
          slot_number: number;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          member_user_id?: string;
          organization_id?: string;
          owner_user_id?: string;
          slot_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "demo_sandboxes_member_membership_fkey";
            columns: ["organization_id", "member_user_id"];
            isOneToOne: false;
            referencedRelation: "organization_memberships";
            referencedColumns: ["organization_id", "user_id"];
          },
          {
            foreignKeyName: "demo_sandboxes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "demo_sandboxes_owner_membership_fkey";
            columns: ["organization_id", "owner_user_id"];
            isOneToOne: false;
            referencedRelation: "organization_memberships";
            referencedColumns: ["organization_id", "user_id"];
          },
        ];
      };
      organization_memberships: {
        Row: {
          created_at: string;
          organization_id: string;
          role: Database["public"]["Enums"]["organization_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          organization_id: string;
          role: Database["public"]["Enums"]["organization_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["organization_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      publication_operations: {
        Row: {
          actor_user_id: string;
          created_at: string;
          id: string;
          idempotency_key: string;
          kind: Database["public"]["Enums"]["publication_operation_kind"];
          organization_id: string;
          request_hash: string;
          result_version_id: string;
          site_id: string;
        };
        Insert: {
          actor_user_id: string;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          kind: Database["public"]["Enums"]["publication_operation_kind"];
          organization_id: string;
          request_hash: string;
          result_version_id: string;
          site_id: string;
        };
        Update: {
          actor_user_id?: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          kind?: Database["public"]["Enums"]["publication_operation_kind"];
          organization_id?: string;
          request_hash?: string;
          result_version_id?: string;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "publication_operations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "publication_operations_result_tenant_fkey";
            columns: ["result_version_id", "site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "site_versions";
            referencedColumns: ["id", "site_id", "organization_id"];
          },
        ];
      };
      publish_approvals: {
        Row: {
          approved_at: string;
          approved_by: string;
          consequence_hash: string;
          consumed_at: string | null;
          content_hash: string;
          draft_id: string;
          draft_revision: number;
          expires_at: string;
          id: string;
          organization_id: string;
          site_id: string;
        };
        Insert: {
          approved_at?: string;
          approved_by: string;
          consequence_hash: string;
          consumed_at?: string | null;
          content_hash: string;
          draft_id: string;
          draft_revision: number;
          expires_at?: string;
          id?: string;
          organization_id: string;
          site_id: string;
        };
        Update: {
          approved_at?: string;
          approved_by?: string;
          consequence_hash?: string;
          consumed_at?: string | null;
          content_hash?: string;
          draft_id?: string;
          draft_revision?: number;
          expires_at?: string;
          id?: string;
          organization_id?: string;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "publish_approvals_draft_tenant_fkey";
            columns: ["draft_id", "site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "site_drafts";
            referencedColumns: ["id", "site_id", "organization_id"];
          },
          {
            foreignKeyName: "publish_approvals_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      site_drafts: {
        Row: {
          content: Json;
          id: string;
          organization_id: string;
          revision: number;
          site_id: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          content: Json;
          id?: string;
          organization_id: string;
          revision?: number;
          site_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          content?: Json;
          id?: string;
          organization_id?: string;
          revision?: number;
          site_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_drafts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_drafts_site_tenant_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      site_versions: {
        Row: {
          content: Json;
          content_hash: string;
          id: string;
          organization_id: string;
          published_at: string;
          published_by: string;
          site_id: string;
          source_draft_id: string | null;
          source_draft_revision: number;
          version_number: number;
        };
        Insert: {
          content: Json;
          content_hash: string;
          id?: string;
          organization_id: string;
          published_at?: string;
          published_by: string;
          site_id: string;
          source_draft_id?: string | null;
          source_draft_revision: number;
          version_number: number;
        };
        Update: {
          content?: Json;
          content_hash?: string;
          id?: string;
          organization_id?: string;
          published_at?: string;
          published_by?: string;
          site_id?: string;
          source_draft_id?: string | null;
          source_draft_revision?: number;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "site_versions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_versions_site_tenant_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "site_versions_source_draft_tenant_fkey";
            columns: ["source_draft_id", "site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "site_drafts";
            referencedColumns: ["id", "site_id", "organization_id"];
          },
        ];
      };
      sites: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          published_version_id: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          published_version_id?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          published_version_id?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sites_published_version_id_fkey";
            columns: ["published_version_id", "id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "site_versions";
            referencedColumns: ["id", "site_id", "organization_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      acknowledge_lead_attention: {
        Args: { p_attention_item_id: string; p_expected_revision: number };
        Returns: number;
      };
      approve_site_draft: {
        Args: {
          p_consequence_hash: string;
          p_draft_id: string;
          p_expected_revision: number;
        };
        Returns: string;
      };
      bind_demo_sandbox_session: {
        Args: {
          p_auth_session_id: string;
          p_lease_token_hash: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      claim_demo_sandbox: {
        Args: {
          p_lease_token_hash: string;
          p_requested_role: Database["public"]["Enums"]["organization_role"];
        };
        Returns: {
          expires_at: string;
          lease_id: string;
          organization_slug: string;
          slot_number: number;
          user_email: string;
        }[];
      };
      confirm_appointment_request: {
        Args: { p_confirmation_token: string; p_request_id: string };
        Returns: Json;
      };
      create_action_plan: {
        Args: { p_attention_item_id: string; p_idempotency_key: string };
        Returns: string;
      };
      create_or_patch_site_draft: {
        Args: {
          p_content: Json;
          p_expected_revision: number;
          p_site_id: string;
        };
        Returns: {
          content: Json;
          id: string;
          organization_id: string;
          revision: number;
          site_id: string;
          updated_at: string;
          updated_by: string;
        };
        SetofOptions: {
          from: "*";
          to: "site_drafts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      find_appointment_slots: {
        Args: { p_date: string; p_service_slug: string; p_site_slug: string };
        Returns: {
          duration_minutes: number;
          slot_id: string;
          starts_at: string;
        }[];
      };
      get_appointment_status: {
        Args: { p_access_token: string; p_request_id: string };
        Returns: Json;
      };
      get_clinic_services: {
        Args: { p_site_slug: string };
        Returns: {
          description: string;
          duration_minutes: number;
          service_name: string;
          service_slug: string;
        }[];
      };
      get_published_site: {
        Args: { p_slug: string };
        Returns: {
          content: Json;
          content_hash: string;
          published_at: string;
          site_slug: string;
          version_id: string;
          version_number: number;
        }[];
      };
      owner_update_appointment_request: {
        Args: {
          p_decision: string;
          p_proposed_starts_at?: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      prepare_appointment_request: {
        Args: {
          p_customer_email: string;
          p_idempotency_key: string;
          p_pet_name: string;
          p_service_slug: string;
          p_site_slug: string;
          p_slot_id: string;
        };
        Returns: Json;
      };
      preview_publish_consequences: {
        Args: { p_draft_id: string };
        Returns: Json;
      };
      publish_site_draft: {
        Args: {
          p_approval_id: string;
          p_consequence_hash: string;
          p_draft_id: string;
          p_expected_revision: number;
          p_idempotency_key: string;
        };
        Returns: string;
      };
      release_demo_sandbox: {
        Args: { p_lease_token_hash: string };
        Returns: boolean;
      };
      respond_to_appointment_proposal: {
        Args: {
          p_accept: boolean;
          p_access_token: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      rollback_site_version: {
        Args: {
          p_idempotency_key: string;
          p_site_id: string;
          p_target_version_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      action_plan_step_kind:
        "acknowledge_attention" | "draft_site_update" | "review_publication";
      appointment_request_status:
        | "prepared"
        | "requested"
        | "confirmed"
        | "time_proposed"
        | "declined"
        | "cancelled";
      attention_kind: "synthetic_lead" | "analytics_snapshot" | "verified_fact";
      attention_status: "open" | "acknowledged";
      organization_role: "owner" | "member";
      publication_operation_kind: "publish" | "rollback";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
      appointment_request_status: [
        "prepared",
        "requested",
        "confirmed",
        "time_proposed",
        "declined",
        "cancelled",
      ],
      attention_kind: ["synthetic_lead", "analytics_snapshot", "verified_fact"],
      attention_status: ["open", "acknowledged"],
      organization_role: ["owner", "member"],
      publication_operation_kind: ["publish", "rollback"],
    },
  },
} as const;
