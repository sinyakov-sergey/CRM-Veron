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
  public: {
    Tables: {
      avito_events: {
        Row: {
          author_name: string | null
          chat_id: string | null
          client_id: string | null
          created_at: string
          event_type: string
          id: string
          item_title: string | null
          lead_id: string | null
          message_text: string | null
          note: string | null
          payload: Json | null
          status: string
        }
        Insert: {
          author_name?: string | null
          chat_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          item_title?: string | null
          lead_id?: string | null
          message_text?: string | null
          note?: string | null
          payload?: Json | null
          status?: string
        }
        Update: {
          author_name?: string | null
          chat_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          item_title?: string | null
          lead_id?: string | null
          message_text?: string | null
          note?: string | null
          payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "avito_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avito_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      avito_messages: {
        Row: {
          chat_id: string | null
          client_id: string
          created_at: string
          direction: string
          id: string
          message_id: string | null
          message_text: string
          message_type: string
          raw_data: Json | null
        }
        Insert: {
          chat_id?: string | null
          client_id: string
          created_at?: string
          direction?: string
          id?: string
          message_id?: string | null
          message_text: string
          message_type?: string
          raw_data?: Json | null
        }
        Update: {
          chat_id?: string | null
          client_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_id?: string | null
          message_text?: string
          message_type?: string
          raw_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "avito_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      avito_settings: {
        Row: {
          avito_account_name: string | null
          avito_user_id: string | null
          id: number
          last_checked_at: string | null
          last_error: string | null
          last_sync_at: string | null
          updated_at: string
          webhook_registered_at: string | null
          webhook_url: string | null
        }
        Insert: {
          avito_account_name?: string | null
          avito_user_id?: string | null
          id?: number
          last_checked_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          updated_at?: string
          webhook_registered_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          avito_account_name?: string | null
          avito_user_id?: string | null
          id?: number
          last_checked_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          updated_at?: string
          webhook_registered_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          avito_chat_id: string | null
          avito_item_id: string | null
          avito_item_title: string | null
          avito_user_id: string | null
          close_reason: string | null
          closed_at: string | null
          created_at: string
          id: string
          last_contact_at: string | null
          manager_id: string
          name: string
          next_action_at: string | null
          phone: string | null
          sold_at: string | null
          source: string
          source_id: string | null
          status: string
          vehicle: string | null
        }
        Insert: {
          avito_chat_id?: string | null
          avito_item_id?: string | null
          avito_item_title?: string | null
          avito_user_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          last_contact_at?: string | null
          manager_id: string
          name: string
          next_action_at?: string | null
          phone?: string | null
          sold_at?: string | null
          source?: string
          source_id?: string | null
          status?: string
          vehicle?: string | null
        }
        Update: {
          avito_chat_id?: string | null
          avito_item_id?: string | null
          avito_item_title?: string | null
          avito_user_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          last_contact_at?: string | null
          manager_id?: string
          name?: string
          next_action_at?: string | null
          phone?: string | null
          sold_at?: string | null
          source?: string
          source_id?: string | null
          status?: string
          vehicle?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          manager_id: string
          text: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          manager_id: string
          text: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          manager_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          manager_id: string | null
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          type: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          avito_chat_id: string | null
          avito_item_id: string | null
          avito_item_title: string | null
          avito_user_id: string | null
          created_at: string
          id: string
          manager_id: string | null
          message: string | null
          name: string
          phone: string | null
          source: string
          source_id: string | null
          status: string
          vehicle: string | null
        }
        Insert: {
          avito_chat_id?: string | null
          avito_item_id?: string | null
          avito_item_title?: string | null
          avito_user_id?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          message?: string | null
          name: string
          phone?: string | null
          source?: string
          source_id?: string | null
          status?: string
          vehicle?: string | null
        }
        Update: {
          avito_chat_id?: string | null
          avito_item_id?: string | null
          avito_item_title?: string | null
          avito_user_id?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          source?: string
          source_id?: string | null
          status?: string
          vehicle?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      tasks: {
        Row: {
          client_id: string
          comment: string | null
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          manager_id: string
          status: string
          type: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          manager_id: string
          status?: string
          type?: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          manager_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_lead: { Args: { _lead_id: string }; Returns: string }
      distribute_new_leads: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "manager"
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
  public: {
    Enums: {
      app_role: ["admin", "manager"],
    },
  },
} as const
