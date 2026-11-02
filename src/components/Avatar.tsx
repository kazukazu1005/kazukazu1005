/** Profile photo, or the first letter of the name when there is none. */
export default function Avatar({
  profile, size = 32,
}: { profile: { username: string; display_name?: string; avatar?: string | null } | null | undefined; size?: number }) {
  const name = profile?.display_name || profile?.username || '?'
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) }
  return profile?.avatar ? (
    <img className="avatar" src={profile.avatar} alt="" style={style} />
  ) : (
    <span className="avatar" aria-hidden="true" style={style}>{name.slice(0, 1).toUpperCase()}</span>
  )
}
