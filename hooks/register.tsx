// Bayt (بيت): your app as a house, explained while Claude Code builds it.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Lang, Latest, Level, Selected, SessionStats } from '../types'
import { builtRooms, cardPage, cleanHouse, describeHouse, drawCard, drawHouse, EMPTY_HOUSE, grow } from './house'
import { explainCall } from './rules'
import type { Explanation } from './rules'
import { CONCEPT_IDS, CONCEPTS, DOORS, ROOM_IDS, ROOMS, UI } from './words'

const PANE = 'bayt'
const PANE_TITLE = 'Bayt · بيت'

const houseA = atom({ plugin: 'bayt', key: 'house' } as const, EMPTY_HOUSE, { shape: 'house-1' })
const langA = atom({ plugin: 'bayt', key: 'lang' } as const, 'en' as Lang)
const cwdA = atom({ plugin: 'bayt', key: 'cwd' } as const, '')
const latestA = atom({ plugin: 'bayt', key: 'latest' } as const, null as Latest | null, { shape: 'latest-1' })
const sessionA = atom({ plugin: 'bayt', key: 'session' } as const, { steps: 0, rooms: [], concepts: [] } as SessionStats, { shape: 'session-1' })
const selectedA = atom({ plugin: 'bayt', key: 'selected' } as const, null as Selected | null)

const LEVEL_COLOR: Record<Level, 'success' | 'warning' | 'error'> = { safe: 'success', careful: 'warning', danger: 'error' }
const LEVEL_DOT: Record<Level, string> = { safe: '●', careful: '▲', danger: '■' }

const storeKey = (cwd: string) => `house:${cwd}`
const dirOf = (lang: Lang) => (lang === 'ar' ? 'rtl' : undefined)

/** Adds what one finished tool call built to the house, and says what is new. */
async function record($: EngineInterface, ex: Explanation) {
  const cwd = await read($, cwdA)
  const lang = await read($, langA)
  let growth = grow(EMPTY_HOUSE, ex, cwd)
  await update($, houseA, house => {
    growth = grow(house, ex, cwd)
    return growth.house
  })
  await $.store.set(storeKey(cwd), growth.house)
  await update($, latestA, () => ({ title: ex.title, level: ex.level, rooms: [...ex.rooms, ...ex.files.map(f => f.room)], doors: ex.doors }))
  await update($, sessionA, s => ({
    steps: s.steps + 1,
    rooms: [...new Set([...s.rooms, ...ex.rooms, ...ex.files.map(f => f.room)])],
    concepts: [...new Set([...s.concepts, ...growth.newConcepts])],
  }))

  const news: string[] = []
  for (const r of growth.newRooms) news.push(`${ROOMS[r].built[lang]}`)
  for (const d of growth.newDoors) news.push(`${UI.newDoor[lang]}: ${DOORS[d].what[lang]}`)
  for (const c of growth.newConcepts) news.push(`${UI.newConcept[lang]}: ${CONCEPTS[c].name[lang]}`)
  if (news.length > 0) $.ui.toast(`Bayt · ${news.slice(0, 2).join(' · ')}`)
}

async function toggleLang($: EngineInterface) {
  const next: Lang = (await read($, langA)) === 'en' ? 'ar' : 'en'
  await update($, langA, () => next)
  await $.store.set('lang', next)
}

async function shareHouse($: EngineInterface) {
  const house = await read($, houseA)
  const lang = await read($, langA)
  const cwd = await read($, cwdA)
  if (!cwd) return
  const project = cwd.split('/').filter(Boolean).pop() ?? 'my app'
  const path = `${cwd}/bayt-house-card.html`
  await $.fs.write(path, cardPage(drawCard(house, lang, project), lang))
  let opened = false
  try {
    opened = (await $.process.run(['open', path])).exitCode === 0
  } catch {
    opened = false
  }
  $.ui.toast(opened ? UI.shared[lang] : UI.sharedNoOpen[lang])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get('lang')
    const lang: Lang = stored === 'ar' ? 'ar' : 'en'
    const house = cleanHouse(await $.store.get(storeKey(e.cwd)))
    await update($, cwdA, () => e.cwd)
    await update($, langA, () => lang)
    await update($, houseA, () => house)

    await $.command.register({ name: 'bayt', description: 'Open Bayt: your app as a house, explained in plain words' })
    void $.ui.open({ id: PANE, title: PANE_TITLE })
    return next(e)
  })

  on('command.run', { command: 'bayt' }, async $ => {
    await $.ui.open({ id: PANE, title: PANE_TITLE })
    return { text: UI.opened[await read($, langA)] }
  })

  // Learn from every call that finished. Explaining never blocks or changes a call.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const cwd = await read($, cwdA)
    const ex = explainCall(String(e.tool), e, cwd)
    if (ex) await record($, ex)
    return ran
  }).catch(($, e, next) => next(e))

  // A plain-words card under each command and file change in the chat.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const row = await next(e)
    const cwd = await read($, cwdA)
    const ex = explainCall(e.props.tool, e.props.input, cwd)
    if (!ex) return row
    const lang = await read($, langA)
    const { Box, Text } = $.ui.resolve(e)
    const color = LEVEL_COLOR[ex.level]
    const level = UI[ex.level][lang]
    const isFile = e.props.tool !== 'Bash'

    if (isFile && ex.level === 'safe') {
      return (
        <Box flexDirection="column">
          {row}
          <Text dimColor dir={dirOf(lang)}>
            <Text color={color}>{LEVEL_DOT.safe} </Text>
            {ex.title[lang]}. {ex.desc[lang]}
          </Text>
        </Box>
      )
    }

    const concept = ex.concepts.find(c => c !== 'terminal')
    return (
      <Box flexDirection="column">
        {row}
        <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
          <Text dir={dirOf(lang)}>
            <Text color={color} weight="semibold">
              {LEVEL_DOT[ex.level]} {level}
            </Text>
            <Text weight="semibold"> · {ex.title[lang]}</Text>
          </Text>
          <Text dir={dirOf(lang)}>{ex.desc[lang]}</Text>
          {(ex.extra > 0 || concept !== undefined) && (
            <Text dimColor size="footnote" dir={dirOf(lang)}>
              {ex.extra > 0 ? `+${ex.extra} ${UI.moreSteps[lang]}` : ''}
              {ex.extra > 0 && concept !== undefined ? ' · ' : ''}
              {concept !== undefined ? `${UI.concept[lang]}: ${CONCEPTS[concept].name[lang]}` : ''}
            </Text>
          )}
        </Box>
      </Box>
    )
  })

  // The house, beside the chat.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const house = await read($, houseA)
    const lang = await read($, langA)
    const latest = await read($, latestA)
    const session = await read($, sessionA)
    const selected: Selected | null = await read($, selectedA)
    const dir = dirOf(lang)
    const L = (x: { en: string; ar: string }) => x[lang]
    const built = builtRooms(house)
    const highlight = { rooms: latest?.rooms ?? [], doors: latest?.doors ?? [] }

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Text weight="bold" dir={dir}>{L(UI.title)}</Text>
          {ROOM_IDS.map(id => (
            <Text dimColor={house.rooms[id] === undefined} dir={dir}>
              {house.rooms[id] === undefined ? '□' : '■'} {L(ROOMS[id].name)}
              {house.rooms[id] !== undefined ? ` (${house.rooms[id]?.length ?? 0})` : ''}
            </Text>
          ))}
          <Text dir={dir}>
            {L(UI.doors)}: {house.doors.length > 0 ? house.doors.map(d => L(DOORS[d].name)).join(', ') : '-'}
          </Text>
          <Text dir={dir}>
            {L(UI.concepts)}: {house.concepts.length}/{CONCEPT_IDS.length}
          </Text>
          {latest && (
            <Text color="suggestion" dir={dir}>
              {L(UI.latest)}: {L(latest.title)}
            </Text>
          )}
          <Button key="lang" label={L(UI.langButton)} onPress={() => toggleLang($)} />
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const svg = <Svg source={drawHouse(house, lang, highlight)} alt={describeHouse(house, lang)} isInteractive />

    if (e.props.placement === 'widget') {
      return (
        <Box flexDirection="column" gap={1}>
          {svg}
          {latest && <Text size="footnote" dir={dir}>{L(latest.title)}</Text>}
        </Box>
      )
    }

    const selRoom = selected?.kind === 'room' ? selected.id : null
    const selConcept = selected?.kind === 'concept' ? selected.id : null
    const select = (s: Selected) => update($, selectedA, cur => (cur?.kind === s.kind && cur.id === s.id ? null : s))

    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text size="heading" weight="semibold" dir={dir}>{L(UI.title)}</Text>
          <Button key="lang" label={L(UI.langButton)} onPress={() => toggleLang($)} />
        </Box>

        {svg}

        {latest ? (
          <Text dir={dir}>
            <Text color={LEVEL_COLOR[latest.level]}>{LEVEL_DOT[latest.level]} </Text>
            <Text dimColor>{L(UI.latest)}: </Text>
            {L(latest.title)}
          </Text>
        ) : (
          built.length === 0 && <Text dimColor dir={dir}>{L(UI.emptyLot)}</Text>
        )}

        {built.length > 0 && (
          <Box flexDirection="column" gap={1}>
            <Text weight="semibold" dir={dir}>{L(UI.rooms)}</Text>
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {built.map(id => (
                <Button
                  key={`room-${id}`}
                  label={`${L(ROOMS[id].name)} · ${house.rooms[id]?.length ?? 0}`}
                  variant={selRoom === id ? 'primary' : undefined}
                  onPress={() => select({ kind: 'room', id })}
                />
              ))}
            </Box>
            {selRoom === null ? (
              <Text dimColor size="footnote" dir={dir}>{L(UI.tapRoom)}</Text>
            ) : (
              <Box flexDirection="column" borderStyle="round" paddingX={1}>
                <Text weight="semibold" dir={dir}>{L(ROOMS[selRoom].name)}</Text>
                <Text dir={dir}>{L(ROOMS[selRoom].what)}</Text>
                {(house.rooms[selRoom] ?? []).slice(0, 6).map(f => (
                  <Text dimColor mono size="footnote">{f}</Text>
                ))}
                {(house.rooms[selRoom]?.length ?? 0) > 6 && (
                  <Text dimColor size="footnote">+{(house.rooms[selRoom]?.length ?? 0) - 6}</Text>
                )}
              </Box>
            )}
          </Box>
        )}

        <Box flexDirection="column" gap={1}>
          <Text weight="semibold" dir={dir}>
            {L(UI.concepts)} · {house.concepts.length}/{CONCEPT_IDS.length}
          </Text>
          {house.concepts.length === 0 ? (
            <Text dimColor size="footnote" dir={dir}>{L(UI.noConcepts)}</Text>
          ) : (
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {house.concepts.map(c => (
                <Button
                  key={`concept-${c}`}
                  label={L(CONCEPTS[c].name)}
                  variant={selConcept === c ? 'primary' : undefined}
                  onPress={() => select({ kind: 'concept', id: c })}
                />
              ))}
            </Box>
          )}
          {selConcept !== null && <Text dir={dir}>{L(CONCEPTS[selConcept].what)}</Text>}
        </Box>

        {session.steps > 0 && (
          <Text dimColor size="footnote" dir={dir}>
            {L(UI.session)}: {session.steps} {L(UI.steps)} · {session.rooms.length} {L(UI.newRooms)} · {session.concepts.length} {L(UI.newConcepts)}
          </Text>
        )}

        {built.length > 0 && <Button key="share" label={L(UI.share)} onPress={() => shareHouse($)} />}
      </Box>
    )
  })
}
