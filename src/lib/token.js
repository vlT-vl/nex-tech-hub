/* eslint-disable no-undef */
// Reconstructs the AES token from the XOR-obfuscated build-time constants.
// __NTH_D__, __NTH_K1__, __NTH_K2__ are injected by vite.config.js — never in plaintext.
// Key is random per-build, full-length, split across two constants.
export function getToken() {
  try {
    const k1 = Uint8Array.from(atob(__NTH_K1__), c => c.charCodeAt(0))
    const k2 = Uint8Array.from(atob(__NTH_K2__), c => c.charCodeAt(0))
    const k  = new Uint8Array(k1.length + k2.length)
    k.set(k1)
    k.set(k2, k1.length)
    const b  = Uint8Array.from(atob(__NTH_D__),  c => c.charCodeAt(0))
    return b.reduce((s, v, i) => s + String.fromCharCode(v ^ k[i % k.length]), '')
  } catch {
    return ''
  }
}
