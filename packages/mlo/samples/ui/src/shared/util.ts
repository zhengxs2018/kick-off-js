export function formatKey(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export function fmtTime(ts: number) {
  return ts ? new Date(ts).toLocaleTimeString() : '-'
}
