import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { detectPRs } from './calc'
import { db } from './db'
import { supabase } from './supabase'
import type { Exercise, ExerciseKind, SetRec, Workout } from './types'

export interface Profile { id: string; username: string; display_name: string; avatar?: string | null; bio?: string }

export interface SharedEntry { name: string; kind: ExerciseKind; part: string; sets: SetRec[]; prs: string[] }
export interface SharedPayload { entries: SharedEntry[] }

export interface FeedComment { id: string; user_id: string; body: string; created_at: string; profiles: { username: string; avatar?: string | null } | null }
export interface FeedItem {
  id: string
  created_at: string
  user_id: string
  date: string
  title: string
  note: string
  data: SharedPayload
  profiles: { username: string; display_name: string; avatar?: string | null } | null
  reactions: { user_id: string; emoji: string; profiles: { username: string } | null }[]
  comments: FeedComment[]
}

function sb() {
  if (!supabase) throw new Error('Sharing is not set up in this build.')
  return supabase
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

// ---------- auth ----------
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(!!supabase)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!supabase || !s) return setProfile(null)
    const { data } = await supabase.from('profiles').select('id, username, display_name, avatar, bio').eq('id', s.user.id).maybeSingle()
    setProfile(data as Profile | null)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      void loadProfile(s)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  return { session, profile, loading, refresh: () => loadProfile(session) }
}

export async function signUp(email: string, password: string) {
  const { data, error } = await sb().auth.signUp({ email, password })
  fail(error)
  if (!data.session) throw new Error('Account created, but sign-in is blocked. Turn off "Confirm email" in Supabase (see docs/SETUP.md).')
}
export async function signIn(email: string, password: string) {
  fail((await sb().auth.signInWithPassword({ email, password })).error)
}
export async function signOut() {
  fail((await sb().auth.signOut()).error)
}
export async function createProfile(username: string, displayName: string) {
  fail((await sb().rpc('create_profile', { p_username: username, p_display_name: displayName })).error)
}

export async function updateProfile(userId: string, patch: { display_name: string; bio: string }) {
  fail((await sb().from('profiles').update(patch).eq('id', userId)).error)
}
export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await sb().from('profiles').select('id, username, display_name, avatar, bio').eq('id', id).maybeSingle()
  fail(error)
  return data as Profile | null
}
export async function updateAvatar(userId: string, avatar: string | null) {
  fail((await sb().from('profiles').update({ avatar }).eq('id', userId)).error)
}

// ---------- friends ----------
export async function fetchFriends(myId: string): Promise<Profile[]> {
  const { data, error } = await sb().from('profiles').select('id, username, display_name, avatar, bio').neq('id', myId).order('username')
  fail(error)
  return (data ?? []) as Profile[]
}
export async function fetchMyCode(): Promise<string> {
  const { data, error } = await sb().from('invite_codes').select('code').maybeSingle()
  fail(error)
  return (data as { code: string } | null)?.code ?? ''
}
export async function addFriend(code: string) {
  fail((await sb().rpc('add_friend_by_code', { p_code: code })).error)
}
export async function regenerateCode(): Promise<string> {
  const { data, error } = await sb().rpc('regenerate_invite_code')
  fail(error)
  return data as string
}
export async function removeFriend(myId: string, friendId: string) {
  const [a, b] = myId < friendId ? [myId, friendId] : [friendId, myId]
  fail((await sb().from('friendships').delete().eq('user_a', a).eq('user_b', b)).error)
}

// ---------- sharing ----------
export function buildPayload(w: Workout, exercises: Map<string, Exercise>, all: Workout[]): SharedPayload {
  return {
    entries: w.entries.flatMap((e) => {
      const ex = exercises.get(e.exerciseId)
      if (!ex) return []
      return [{ name: ex.name, kind: ex.kind, part: ex.part, sets: e.sets, prs: detectPRs(e, ex, w.date, all, w.id) }]
    }),
  }
}

export async function pushWorkout(userId: string, w: Workout, payload: SharedPayload) {
  fail(
    (
      await sb().from('shared_workouts').upsert({
        id: w.id, user_id: userId, date: w.date, title: w.title, note: w.note, data: payload, updated_at: new Date().toISOString(),
      })
    ).error,
  )
}

export async function removeShared(id: string) {
  fail((await sb().from('shared_workouts').delete().eq('id', id)).error)
}

/** Push workouts that haven't reached the server yet (saved offline or before signing in). */
let syncing = false
let queued: { userId: string; workouts: Workout[]; exercises: Map<string, Exercise> } | null = null

/**
 * Upload workouts that have not reached the server yet. Runs one pass at a time: a request that
 * arrives meanwhile is remembered (newest wins) and run right after, so an older copy can never
 * land on the server after a newer one.
 */
export async function syncPending(userId: string, workouts: Workout[], exercises: Map<string, Exercise>): Promise<number> {
  if (syncing) {
    queued = { userId, workouts, exercises }
    return 0
  }
  syncing = true
  let n = 0
  try {
    for (const w of workouts) {
      if (w.synced) continue
      try {
        await pushWorkout(userId, w, buildPayload(w, exercises, workouts))
        // Only mark it sent if it was not edited again while the upload was running.
        await db.workouts.where('id').equals(w.id).modify((x) => {
          x.everShared = true
          if (x.updatedAt === w.updatedAt) x.synced = true
        })
        n++
      } catch {
        break // offline or signed out; try again later
      }
    }
  } finally {
    syncing = false
  }
  if (queued) {
    const q = queued
    queued = null
    n += await syncPending(q.userId, q.workouts, q.exercises)
  }
  return n
}

// ---------- feed ----------
const FEED_SELECT =
  'id, user_id, created_at, date, title, note, data, profiles(username, display_name, avatar), reactions(user_id, emoji, profiles(username)), comments(id, user_id, body, created_at, profiles(username, avatar))'

export async function fetchFeed(limit: number): Promise<FeedItem[]> {
  const { data, error } = await sb()
    .from('shared_workouts')
    .select(FEED_SELECT)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'comments', ascending: true })
    .limit(limit)
  fail(error)
  return (data ?? []) as unknown as FeedItem[]
}

/** Every workout a friend has shared (newest first). RLS only returns rows if you are friends. */
export async function fetchFriendLog(friendId: string): Promise<FeedItem[]> {
  const { data, error } = await sb()
    .from('shared_workouts')
    .select(FEED_SELECT)
    .eq('user_id', friendId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'comments', ascending: true })
    .limit(1000)
  fail(error)
  return (data ?? []) as unknown as FeedItem[]
}
/**
 * One reaction per user per workout. Turning one on replaces any earlier choice (upsert on
 * workout + user); turning it off removes it.
 */
export async function setReaction(workoutId: string, userId: string, emoji: string, on: boolean) {
  const q = sb().from('reactions')
  fail(
    (on
      ? await q.upsert({ workout_id: workoutId, user_id: userId, emoji }, { onConflict: 'workout_id,user_id' })
      : await q.delete().eq('workout_id', workoutId).eq('user_id', userId).eq('emoji', emoji)
    ).error,
  )
}
export async function addComment(workoutId: string, userId: string, body: string) {
  fail((await sb().from('comments').insert({ workout_id: workoutId, user_id: userId, body })).error)
}
export async function deleteComment(id: string) {
  fail((await sb().from('comments').delete().eq('id', id)).error)
}

/** When a friend last added a workout (newest first), or null if none. Used for the "new" dot. */
export async function fetchLatestFriendPostTime(myId: string): Promise<string | null> {
  const { data, error } = await sb().from('shared_workouts').select('created_at').neq('user_id', myId).order('created_at', { ascending: false }).limit(1)
  fail(error)
  return (data?.[0] as { created_at: string } | undefined)?.created_at ?? null
}
