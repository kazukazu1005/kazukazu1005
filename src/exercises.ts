import type { Exercise, ExerciseKind } from './types'

const w = (id: string, name: string, part: string): Exercise => ({ id, name, kind: 'weight', part })
const b = (id: string, name: string, part: string): Exercise => ({ id, name, kind: 'bodyweight', part })
const c = (id: string, name: string): Exercise => ({ id, name, kind: 'cardio', part: '有酸素' })

export const PARTS = ['胸', '背中', '脚', '肩', '腕', '腹', '有酸素'] as const

export const PRESET_EXERCISES: Exercise[] = [
  w('bench-press', 'ベンチプレス', '胸'),
  w('incline-db-press', 'インクラインダンベルプレス', '胸'),
  w('chest-fly', 'ダンベルフライ', '胸'),
  w('chest-press-machine', 'チェストプレス（マシン）', '胸'),
  b('push-up', '腕立て伏せ', '胸'),
  w('deadlift', 'デッドリフト', '背中'),
  w('lat-pulldown', 'ラットプルダウン', '背中'),
  w('seated-row', 'シーテッドロウ', '背中'),
  w('bent-over-row', 'ベントオーバーロウ', '背中'),
  b('pull-up', '懸垂', '背中'),
  w('squat', 'スクワット', '脚'),
  w('leg-press', 'レッグプレス', '脚'),
  w('leg-extension', 'レッグエクステンション', '脚'),
  w('leg-curl', 'レッグカール', '脚'),
  w('romanian-deadlift', 'ルーマニアンデッドリフト', '脚'),
  w('calf-raise', 'カーフレイズ', '脚'),
  w('shoulder-press', 'ショルダープレス', '肩'),
  w('side-raise', 'サイドレイズ', '肩'),
  w('rear-delt-fly', 'リアデルトフライ', '肩'),
  w('arm-curl', 'アームカール', '腕'),
  w('hammer-curl', 'ハンマーカール', '腕'),
  w('triceps-pushdown', 'トライセプスプッシュダウン', '腕'),
  b('dips', 'ディップス', '腕'),
  b('crunch', 'クランチ', '腹'),
  b('leg-raise', 'レッグレイズ', '腹'),
  b('plank-reps', 'アブローラー', '腹'),
  c('running', 'ランニング'),
  c('walking', 'ウォーキング'),
  c('cycling', 'サイクリング'),
  c('swimming', '水泳'),
  c('rowing', 'ローイング'),
  c('aero-bike', 'エアロバイク'),
  c('jump-rope', 'ジャンプロープ'),
]

export function newCustomExercise(name: string, kind: ExerciseKind, part: string): Exercise {
  return { id: `custom-${crypto.randomUUID()}`, name: name.trim(), kind, part, custom: true }
}
