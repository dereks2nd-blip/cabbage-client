import { createHash } from 'crypto'

export interface Account {
  username: string
  uuid: string
  accessToken: string
  userType: 'legacy' | 'msa'
}

/**
 * Derive the same offline UUID the vanilla server uses for cracked/offline
 * players: a version-3 (MD5) UUID of "OfflinePlayer:<name>". Keeps worlds and
 * inventories stable across launches for a given name.
 */
export function offlineUuid(username: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${username}`).digest()
  hash[6] = (hash[6] & 0x0f) | 0x30 // version 3
  hash[8] = (hash[8] & 0x3f) | 0x80 // variant
  const hex = hash.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Build a local offline account. Good for singleplayer; not for online play. */
export function offlineAccount(username: string): Account {
  const clean = (username || 'Player').trim().slice(0, 16) || 'Player'
  return { username: clean, uuid: offlineUuid(clean), accessToken: '0', userType: 'legacy' }
}
