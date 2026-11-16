import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const toolRow = (command: string) =>
  ({
    plugin: 'bayt',
    component: 'ToolUse',
    requestId: 'tu1',
    props: { tool_use_id: 'tu1', tool: 'Bash', input: { command }, isRunning: false, isErrored: false, isInterrupted: false },
  }) as const

const PANE = {
  plugin: 'bayt',
  component: 'Pane',
  requestId: 'bayt',
  props: { title: 'Bayt', isFocused: false, bodyColumns: 48, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('a plain-words card sits under a command, on every surface', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...toolRow('git push --force'), surface })
    expect((await ui.find({ type: 'Text', text: /engine row/ }))?.text).toBe('engine row')
    expect(await ui.find({ type: 'Text', text: /Danger/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Overwrites your project's history/ })).toBeDefined()
    await ui.unmount()
  }
})

const engine = (on: On) => {
  on('command.register', () => ({ value: { command: 'bayt' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('ui.toast', () => ({ value: undefined }))
}

test('the house grows from tool calls', async ($, on) => {
  mock.store(on)
  engine(on)
  await $.session.start({ cwd: '/proj', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Write', file_path: '/proj/app/page.tsx', content: 'export default function Page() {}' })
  await $.tool.call({ tool: 'Bash', command: 'npm install stripe' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Your app as a house/ })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'room-screens' }))?.text).toBe('Screens · 1')
  expect(await ui.find({ key: 'concept-library' })).toBeDefined()
  await ui.press({ key: 'lang' })
  expect(await ui.find({ type: 'Text', text: /تطبيقك كأنو بيت/ })).toBeDefined()
  await ui.unmount()
})

test('a project keeps its house between sessions', async ($, on) => {
  mock.store(on, { 'house:/proj': { rooms: { storage: ['prisma/schema.prisma'] }, doors: ['github'], concepts: ['git'], steps: 3 } })
  engine(on)
  await $.session.start({ cwd: '/proj', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'room-storage' }))?.text).toBe('Storage · 1')
  expect(await ui.find({ key: 'concept-git' })).toBeDefined()
  await ui.unmount()
})
