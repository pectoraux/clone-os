// Clone OS — Password hashing using Node's built-in scrypt (no extra deps).
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEY_LEN = 64
const SALT_LEN = 16
const SCRYPT_N = 16384 // CPU/memory cost
const SCRYPT_R = 8
const SCRYPT_P = 1

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN)
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  })
  // Format: scrypt$N$r$p$saltHex$hashHex
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password: string, encoded: string): boolean {
  if (!encoded) return false
  const parts = encoded.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = parseInt(parts[1], 10)
  const r = parseInt(parts[2], 10)
  const p = parseInt(parts[3], 10)
  const salt = Buffer.from(parts[4], 'hex')
  const storedHash = Buffer.from(parts[5], 'hex')
  const testHash = scryptSync(password, salt, storedHash.length, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return storedHash.length === testHash.length && timingSafeEqual(storedHash, testHash)
}
