import { release } from 'os'

export interface Rule {
  action: 'allow' | 'disallow'
  os?: { name?: string; arch?: string; version?: string }
  features?: Record<string, boolean>
}

/** Mojang's OS name for the current platform. */
export function currentOsName(): string {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'osx'
  return 'linux'
}

function osMatches(os: NonNullable<Rule['os']>): boolean {
  if (os.name && os.name !== currentOsName()) return false
  if (os.arch) {
    const arch = process.arch === 'ia32' ? 'x86' : process.arch
    if (os.arch !== arch) return false
  }
  if (os.version) {
    try {
      if (!new RegExp(os.version).test(release())) return false
    } catch {
      /* ignore bad patterns */
    }
  }
  return true
}

/**
 * Evaluate a Mojang rule list against the current OS and the given feature
 * flags. No rules means allowed. Later matching rules override earlier ones.
 */
export function rulesAllow(rules: Rule[] | undefined, features: Record<string, boolean> = {}): boolean {
  if (!rules || rules.length === 0) return true
  let allowed = false
  for (const rule of rules) {
    let matches = true
    if (rule.os && !osMatches(rule.os)) matches = false
    if (rule.features) {
      for (const [k, v] of Object.entries(rule.features)) {
        if ((features[k] ?? false) !== v) matches = false
      }
    }
    if (matches) allowed = rule.action === 'allow'
  }
  return allowed
}
