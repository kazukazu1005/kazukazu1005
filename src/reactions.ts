// Keep in sync with the check constraint on public.reactions (supabase/schema.sql).
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '💪', '🔥'] as const
export type Reaction = (typeof REACTIONS)[number]
