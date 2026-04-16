import { createClient } from './supabase'

export interface Scenario {
  id: string
  name: string
  page: string
  params: Record<string, unknown>
  created_at: string
}

export async function listScenarios(page: string): Promise<Scenario[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('saved_scenarios')
    .select('id, name, page, params, created_at')
    .eq('page', page)
    .order('created_at', { ascending: false })
  return (data ?? []) as Scenario[]
}

export async function saveScenario(
  page: string,
  name: string,
  params: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('saved_scenarios').insert({
    user_id: user.id,
    page,
    name,
    params,
  })
}

export async function deleteScenario(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('saved_scenarios').delete().eq('id', id)
}
