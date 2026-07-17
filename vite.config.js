import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'

const pkgVer = (name) => {
  try { return JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version } catch { return '?' }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const raw = env.NTH_AES_TOKEN || ''

  // XOR-obfuscate token at build-time — never lands in bundle as plaintext.
  // Key is random per-build and full-length (no repeating pattern).
  // Split into two halves → attacker needs 3 constants + assembly order.
  const K    = randomBytes(Math.max(raw.length, 32))
  const xored = Buffer.from([...raw].map((c, i) => c.charCodeAt(0) ^ K[i % K.length]))
  const half  = Math.ceil(K.length / 2)

  return {
    base: command === 'serve' ? '/' : '/nex-tech-hub/',
    plugins: [react()],
    define: {
      __NTH_D__:  JSON.stringify(xored.toString('base64')),
      __NTH_K1__: JSON.stringify(K.slice(0, half).toString('base64')),
      __NTH_K2__: JSON.stringify(K.slice(half).toString('base64')),
      __VER_REACT__:  JSON.stringify(pkgVer('react')),
      __VER_VITE__:   JSON.stringify(pkgVer('vite')),
      __VER_ROUTER__: JSON.stringify(pkgVer('react-router-dom')),
      __VER_ICONS__:  JSON.stringify(pkgVer('react-icons')),
    },
    build: {
      target: 'es2022',
      minify: 'oxc',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('react-icons'))                                          return 'icons'
            if (['react', 'react-dom', 'react-router-dom'].some(p => id.includes(`/node_modules/${p}/`))) return 'vendor'
          },
        },
      },
    },
  }
})
