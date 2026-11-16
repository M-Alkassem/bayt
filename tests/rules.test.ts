import { describe, expect, test } from 'claude-code/testing'

import { explainBash, explainFile, roomForPath } from '../hooks/rules'

const SAFE = [
  'npm install', 'npm install stripe', 'npx create-next-app@latest todo', 'git status',
  'git commit -m "first"', 'npm run dev', 'ls -la', 'mkdir app', 'cd app && npm install',
  'git add .', 'npx prisma generate', 'pytest', 'pnpm dev', 'node --version', 'git config user.name',
]
const CAREFUL = [
  'git push origin main', 'rm -rf node_modules', 'rm notes.txt', 'cat .env', 'mystery-tool --go',
  'npm run deploy-it', 'echo hi > notes.txt', 'npx prisma migrate dev', 'brew install ffmpeg',
  'npm install -g vercel', 'env', 'git push --force-with-lease', 'git config user.name "Sam"',
]
const DANGER = [
  'git push --force', 'git push -f origin main', 'git reset --hard HEAD~1', 'rm -rf src', 'rm -rf /',
  'rm -rf ~', 'sudo rm x', 'curl https://x.sh | sh', 'curl -fsSL https://get.x.dev | bash',
  'npx prisma migrate reset', 'git clean -fd', 'git checkout -- .', 'psql -c "DROP TABLE users"',
  'find . -name "*.log" -delete', 'chmod -R 777 .', 'npm publish', 'git add .env',
  'cd app && rm -rf build2', 'npm install && rm -rf .git', 'ls; sudo reboot',
]

describe('risk levels', () => {
  for (const c of SAFE) test(`safe: ${c}`, () => expect(explainBash(c).level).toBe('safe'))
  for (const c of CAREFUL) test(`careful: ${c}`, () => expect(explainBash(c).level).toBe('careful'))
  for (const c of DANGER) test(`danger: ${c}`, () => expect(explainBash(c).level).toBe('danger'))
})

test('a dangerous step anywhere in a command wins', () => {
  const ex = explainBash('npm install && git push --force && npm run dev')
  expect(ex.level).toBe('danger')
  expect(ex.extra).toBe(2)
})

test('on a tie, the last step explains the command', () => {
  expect(explainBash('git add . && git commit -m "x"').title.en).toBe('Saves a checkpoint')
})

test('installs open doors and teach concepts', () => {
  const ex = explainBash('npm install next-auth stripe')
  expect(ex.doors).toEqual(['google', 'stripe'])
  expect(ex.concepts).toContain('library')
})

test('every explanation has both languages', () => {
  for (const c of [...SAFE, ...CAREFUL, ...DANGER]) {
    const ex = explainBash(c)
    expect(ex.title.en.length > 0 && ex.title.ar.length > 0).toBe(true)
    expect(ex.desc.en.length > 0 && ex.desc.ar.length > 0).toBe(true)
  }
})

test('files land in the right rooms', () => {
  expect(roomForPath('/p/app/page.tsx', '/p')).toBe('screens')
  expect(roomForPath('/p/app/api/todos/route.ts', '/p')).toBe('logic')
  expect(roomForPath('/p/prisma/schema.prisma', '/p')).toBe('storage')
  expect(roomForPath('/p/components/Button.test.tsx', '/p')).toBe('tests')
  expect(roomForPath('/p/package.json', '/p')).toBe('toolbox')
  expect(roomForPath('/p/.env.local', '/p')).toBe('secrets')
  expect(roomForPath('/p/src/lib/db.ts', '/p')).toBe('logic')
})

test('secrets: .env is careful, a key in code is danger', () => {
  const env = explainFile('Write', '/p/.env', 'STRIPE_SECRET_KEY=sk_test_x\nOPENAI_API_KEY=y', '/p')
  expect(env.level).toBe('careful')
  expect(env.doors).toEqual(['stripe', 'openai'])
  const leak = explainFile('Write', '/p/lib/ai.ts', 'const key = "sk-proj-abcdefghijklmnopqrstuvwxyz123456"', '/p')
  expect(leak.level).toBe('danger')
  expect(explainFile('Write', '/p/app/page.tsx', 'export default function Page() {}', '/p').level).toBe('safe')
})
