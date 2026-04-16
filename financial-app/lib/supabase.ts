import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export type Database = {
  public: {
    Tables: {
      usage_logs: {
        Row: {
          id: string
          user_id: string
          page: string
          created_at: string
        }
        Insert: {
          user_id: string
          page: string
        }
      }
      saved_scenarios: {
        Row: {
          id: string
          user_id: string
          name: string
          page: string
          params: Record<string, unknown>
          created_at: string
        }
        Insert: {
          user_id: string
          name: string
          page: string
          params: Record<string, unknown>
        }
      }
    }
  }
}
