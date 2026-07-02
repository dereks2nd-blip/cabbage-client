import { join } from 'path'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { dataRoot, ensureDir } from './paths'

/**
 * Microsoft / Xbox / Minecraft authentication.
 *
 * Uses Microsoft's public "live" OAuth desktop flow with the long-standing public
 * client id below — the same registration-free approach community launchers use so
 * it "just works" for any Microsoft account. The user signs in through an embedded
 * window; we capture the redirect code and trade it up the chain:
 *   auth code → MS token → Xbox Live → XSTS → Minecraft token → profile.
 */
const CLIENT_ID = '00000000402b5328'
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf'
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL'
const AUTHORIZE_URL =
  'https://login.live.com/oauth20_authorize.srf' +
  `?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPE)}&prompt=select_account`
const TOKEN_URL = 'https://login.live.com/oauth20_token.srf'

const XBL_URL = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const MC_LOGIN_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile'

/** Exposed so the main process can drive the embedded login window. */
export const authWindow = { authorizeUrl: AUTHORIZE_URL, redirectUri: REDIRECT_URI }

export interface MsAccount {
  name: string
  uuid: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  userType: 'msa'
}

function accountFile(): string {
  return join(dataRoot(), 'cabbage-account.json')
}

export function loadAccount(): MsAccount | undefined {
  try {
    return JSON.parse(readFileSync(accountFile(), 'utf8')) as MsAccount
  } catch {
    return undefined
  }
}

function saveAccount(a: MsAccount): void {
  ensureDir(dataRoot())
  writeFileSync(accountFile(), JSON.stringify(a, null, 2))
}

export function logout(): void {
  try {
    unlinkSync(accountFile())
  } catch {
    /* not logged in */
  }
}

interface MsTokens {
  access_token: string
  refresh_token: string
}

async function exchangeCode(code: string): Promise<MsTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    })
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  return (await res.json()) as MsTokens
}

async function refreshMsToken(refreshToken: string): Promise<MsTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      redirect_uri: REDIRECT_URI,
      scope: SCOPE
    })
  })
  if (!res.ok) throw new Error('Session expired — please sign in again.')
  return (await res.json()) as MsTokens
}

// --- Xbox Live → XSTS → Minecraft → profile ---

async function authXboxLive(msAccessToken: string): Promise<{ token: string }> {
  const res = await fetch(XBL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: msAccessToken },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    })
  })
  if (!res.ok) throw new Error(`Xbox Live auth failed (${res.status})`)
  const d = (await res.json()) as { Token: string }
  return { token: d.Token }
}

function xstsError(xerr: number): string {
  if (xerr === 2148916233) return 'This Microsoft account has no Xbox profile — create one at xbox.com first.'
  if (xerr === 2148916235) return 'Xbox Live is unavailable in your region.'
  if (xerr === 2148916238) return 'This is a child account — it must be added to a Family group.'
  return 'Xbox authorization failed.'
}

async function authXsts(xblToken: string): Promise<{ token: string; uhs: string }> {
  const res = await fetch(XSTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    })
  })
  if (res.status === 401) {
    const e = (await res.json()) as { XErr: number }
    throw new Error(xstsError(e.XErr))
  }
  if (!res.ok) throw new Error(`XSTS auth failed (${res.status})`)
  const d = (await res.json()) as { Token: string; DisplayClaims: { xui: Array<{ uhs: string }> } }
  return { token: d.Token, uhs: d.DisplayClaims.xui[0].uhs }
}

async function authMinecraft(uhs: string, xstsToken: string): Promise<{ token: string; expiresIn: number }> {
  const res = await fetch(MC_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xstsToken}` })
  })
  if (!res.ok) throw new Error(`Minecraft auth failed (${res.status})`)
  const d = (await res.json()) as { access_token: string; expires_in: number }
  return { token: d.access_token, expiresIn: d.expires_in }
}

async function getProfile(mcToken: string): Promise<{ uuid: string; name: string }> {
  const res = await fetch(MC_PROFILE_URL, { headers: { Authorization: `Bearer ${mcToken}` } })
  if (res.status === 404) throw new Error('This account does not own Minecraft (Java Edition).')
  if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`)
  const d = (await res.json()) as { id: string; name: string }
  return { uuid: d.id, name: d.name }
}

async function buildAccount(ms: MsTokens): Promise<MsAccount> {
  const xbl = await authXboxLive(ms.access_token)
  const xsts = await authXsts(xbl.token)
  const mc = await authMinecraft(xsts.uhs, xsts.token)
  const profile = await getProfile(mc.token)
  return {
    name: profile.name,
    uuid: profile.uuid,
    accessToken: mc.token,
    refreshToken: ms.refresh_token,
    expiresAt: Date.now() + mc.expiresIn * 1000,
    userType: 'msa'
  }
}

/** Trade the captured OAuth code for a full, persisted Minecraft account. */
export async function completeLogin(code: string): Promise<MsAccount> {
  const account = await buildAccount(await exchangeCode(code))
  saveAccount(account)
  return account
}

/** Return a valid account, refreshing the Minecraft token if it's stale. */
export async function ensureFreshAccount(account: MsAccount): Promise<MsAccount> {
  if (Date.now() < account.expiresAt - 60_000) return account
  const refreshed = await buildAccount(await refreshMsToken(account.refreshToken))
  saveAccount(refreshed)
  return refreshed
}
