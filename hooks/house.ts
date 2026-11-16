// The house: what is built so far, and how to draw it as SVG.

import type { Explanation } from './rules'
import { CONCEPT_IDS, CONCEPTS, DOORS, ROOM_IDS, ROOMS, UI, t } from './words'
import type { ConceptId, DoorId, House, Lang, RoomId } from '../types'
export type { House } from '../types'

export const EMPTY_HOUSE: House = { rooms: {}, doors: [], concepts: [], steps: 0 }

const MAX_FILES = 30

export function relative(path: string, cwd: string): string {
  if (cwd && path.startsWith(cwd + '/')) return path.slice(cwd.length + 1)
  return path
}

export type Growth = { house: House; newRooms: RoomId[]; newDoors: DoorId[]; newConcepts: ConceptId[] }

/** Adds what one explained tool call built to the house. */
export function grow(house: House, ex: Explanation, cwd: string): Growth {
  const rooms: Partial<Record<RoomId, string[]>> = { ...house.rooms }
  const newRooms: RoomId[] = []
  const touch = (room: RoomId) => {
    if (rooms[room] === undefined) {
      rooms[room] = []
      newRooms.push(room)
    }
  }
  for (const room of ex.rooms) touch(room)
  for (const f of ex.files) {
    touch(f.room)
    const rel = relative(f.path, cwd)
    rooms[f.room] = [rel, ...(rooms[f.room] ?? []).filter(p => p !== rel)].slice(0, MAX_FILES)
  }
  const newDoors = ex.doors.filter(d => !house.doors.includes(d))
  const newConcepts = ex.concepts.filter(c => !house.concepts.includes(c))
  return {
    house: {
      rooms,
      doors: [...house.doors, ...newDoors],
      concepts: [...house.concepts, ...newConcepts],
      steps: house.steps + 1,
    },
    newRooms,
    newDoors,
    newConcepts,
  }
}

/** Reads a house from storage, dropping anything an older or broken file holds. */
export function cleanHouse(value: unknown): House {
  if (typeof value !== 'object' || value === null) return EMPTY_HOUSE
  const v = value as Record<string, unknown>
  const rooms: Partial<Record<RoomId, string[]>> = {}
  const rawRooms = (typeof v.rooms === 'object' && v.rooms !== null ? v.rooms : {}) as Record<string, unknown>
  for (const id of ROOM_IDS) {
    const files = rawRooms[id]
    if (Array.isArray(files)) rooms[id] = files.filter((f): f is string => typeof f === 'string').slice(0, MAX_FILES)
  }
  const doors = (Array.isArray(v.doors) ? v.doors : []).filter((d): d is DoorId => typeof d === 'string' && d in DOORS)
  const concepts = (Array.isArray(v.concepts) ? v.concepts : []).filter((c): c is ConceptId => typeof c === 'string' && c in CONCEPTS)
  const steps = typeof v.steps === 'number' && Number.isFinite(v.steps) ? v.steps : 0
  return { rooms, doors, concepts, steps }
}

export const builtRooms = (house: House) => ROOM_IDS.filter(id => house.rooms[id] !== undefined)

// ---------------------------------------------------------------- drawing

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// fill, stroke, text: light then dark.
const PAL: Record<RoomId | 'door', [string, string, string, string, string, string]> = {
  screens: ['#EEEDFE', '#7F77DD', '#3C3489', '#3C3489', '#AFA9EC', '#EEEDFE'],
  logic: ['#E1F5EE', '#1D9E75', '#085041', '#085041', '#5DCAA5', '#E1F5EE'],
  storage: ['#E6F1FB', '#378ADD', '#0C447C', '#0C447C', '#85B7EB', '#E6F1FB'],
  toolbox: ['#F1EFE8', '#888780', '#444441', '#444441', '#B4B2A9', '#F1EFE8'],
  tests: ['#EAF3DE', '#639922', '#27500A', '#27500A', '#97C459', '#EAF3DE'],
  secrets: ['#FAEEDA', '#BA7517', '#633806', '#633806', '#EF9F27', '#FAEEDA'],
  door: ['#FBEAF0', '#D4537E', '#72243E', '#72243E', '#ED93B1', '#FBEAF0'],
}

function style(theme: 'auto' | 'light'): string {
  const rules = (dark: boolean) => {
    const k = dark ? 3 : 0
    const room = (Object.keys(PAL) as (keyof typeof PAL)[])
      .map(id => {
        const p = PAL[id]
        return `.r-${id} .box{fill:${p[k]};stroke:${p[k + 1]}}.r-${id} text{fill:${p[k + 2]}}`
      })
      .join('')
    return (
      room +
      `.wall{stroke:${dark ? '#B4B2A9' : '#888780'}}` +
      `.roof{fill:${dark ? '#712B13' : '#F5C4B3'};stroke:${dark ? '#F0997B' : '#D85A30'}}` +
      `.chim{fill:${dark ? '#4A1B0C' : '#F0997B'}}` +
      `.ground{fill:${dark ? '#27500A' : '#C0DD97'}}` +
      `.empty .box{fill:none;stroke:${dark ? '#5F5E5A' : '#D3D1C7'}}.empty text{fill:${dark ? '#888780' : '#B4B2A9'}}` +
      `.muted{fill:${dark ? '#B4B2A9' : '#888780'}}` +
      `.lamp{fill:${dark ? '#EF9F27' : '#FAC775'}}` +
      `.link{stroke:${dark ? '#ED93B1' : '#D4537E'}}`
    )
  }
  const font = `text{font-family:-apple-system,BlinkMacSystemFont,"SF Arabic","Geeza Pro","Segoe UI",system-ui,sans-serif}`
  return theme === 'light'
    ? `<style>${font}${rules(false)}</style>`
    : `<style>${font}${rules(false)}@media (prefers-color-scheme: dark){${rules(true)}}</style>`
}

const pulse = `<animate attributeName="stroke-width" values="1.5;4;1.5" dur="1.4s" repeatCount="4"/>`

export type Highlight = { rooms: RoomId[]; doors: DoorId[] }

/** Shorter names that fit inside a room of the drawing. */
const SHORT: Partial<Record<RoomId, { en: string; ar: string }>> = { secrets: t('Secrets', 'الأسرار') }

/** The house as an SVG document, 360 by 290. */
export function drawHouse(house: House, lang: Lang, highlight: Highlight = { rooms: [], doors: [] }, theme: 'auto' | 'light' = 'auto'): string {
  const rtl = lang === 'ar' ? ' direction="rtl"' : ''
  const L = (x: { en: string; ar: string }) => esc(x[lang])
  const built = builtRooms(house)
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 290" width="360" height="290">`)
  out.push(style(theme))

  // ground, chimney, roof, walls
  out.push(`<rect class="ground" x="0" y="262" width="360" height="7" rx="3.5"/>`)
  for (const gx of [8, 300, 336]) out.push(`<path class="link" d="M${gx} 262 q3 -10 6 0 q3 -8 6 0" fill="none" stroke-width="1.2"/>`)
  out.push(`<rect class="chim" x="198" y="44" width="18" height="44" rx="2"/>`)
  out.push(`<polygon class="roof" points="6,110 136,30 266,110" stroke-width="2" stroke-linejoin="round"/>`)
  out.push(`<rect class="wall" x="16" y="108" width="240" height="154" rx="4" fill="none" stroke-width="2"${built.length === 0 ? ' stroke-dasharray="6 5"' : ''}/>`)

  // rooms: 3 columns, 2 rows
  ROOM_IDS.forEach((id, i) => {
    const x = 26 + (i % 3) * 76
    const y = 118 + Math.floor(i / 3) * 72
    const files = house.rooms[id]
    const isBuilt = files !== undefined
    const isNew = highlight.rooms.includes(id)
    const count = files?.length ?? 0
    out.push(`<g class="${isBuilt ? `r-${id}` : 'empty'}"><title>${L(ROOMS[id].name)}: ${L(ROOMS[id].what)}</title>`)
    out.push(`<rect class="box" x="${x}" y="${y}" width="68" height="64" rx="6" stroke-width="1.5"${isBuilt ? '' : ' stroke-dasharray="4 4"'}>${isNew ? pulse : ''}</rect>`)
    if (isBuilt) out.push(`<circle class="lamp" cx="${x + 58}" cy="${y + 10}" r="4"/>`)
    out.push(`<text x="${x + 34}" y="${y + 30}" text-anchor="middle" font-size="11.5" font-weight="600"${rtl}>${L(SHORT[id] ?? ROOMS[id].name)}</text>`)
    const sub = isBuilt ? (count === 0 ? '' : `${count} ${L(count === 1 ? UI.file : UI.files)}`) : '?'
    if (sub) out.push(`<text x="${x + 34}" y="${y + 47}" text-anchor="middle" font-size="10"${rtl}>${sub}</text>`)
    out.push(`</g>`)
  })

  if (built.length === 0) {
    out.push(`<text class="muted" x="136" y="100" text-anchor="middle" font-size="11"${rtl}>${L(t('Empty lot', 'أرض فاضية'))}</text>`)
  }

  // doors to the outside world
  out.push(`<text class="muted" x="312" y="104" text-anchor="middle" font-size="10.5" font-weight="600"${rtl}>${L(UI.doors)}</text>`)
  const shown = house.doors.slice(0, 5)
  if (shown.length === 0) {
    out.push(`<text class="muted" x="312" y="126" text-anchor="middle" font-size="9.5"${rtl}>${L(t('none yet', 'لسّا ما في'))}</text>`)
  }
  shown.forEach((d, i) => {
    const y = 114 + i * 30
    const isNew = highlight.doors.includes(d)
    const label = i === 4 && house.doors.length > 5 ? `+${house.doors.length - 4}` : L(DOORS[d].name)
    out.push(`<line class="link" x1="257" y1="${y + 12}" x2="272" y2="${y + 12}" stroke-width="1.5" stroke-dasharray="3 3"/>`)
    out.push(`<g class="r-door"><title>${L(DOORS[d].what)}</title>`)
    out.push(`<rect class="box" x="272" y="${y}" width="80" height="24" rx="12" stroke-width="1.5">${isNew ? pulse : ''}</rect>`)
    out.push(`<text x="312" y="${y + 16}" text-anchor="middle" font-size="10.5" font-weight="600">${label}</text></g>`)
  })

  out.push(`</svg>`)
  return out.join('')
}

export function describeHouse(house: House, lang: Lang): string {
  const rooms = builtRooms(house).map(id => ROOMS[id].name[lang])
  const doors = house.doors.map(d => DOORS[d].name[lang])
  if (rooms.length === 0) return UI.emptyLot[lang]
  return lang === 'ar'
    ? `بيت فيه ${rooms.length} غرف: ${rooms.join('، ')}.${doors.length ? ` أبواب: ${doors.join('، ')}.` : ''}`
    : `A house with ${rooms.length} rooms: ${rooms.join(', ')}.${doors.length ? ` Doors: ${doors.join(', ')}.` : ''}`
}

// ---------------------------------------------------------------- share card

/** A square 1080 card for LinkedIn and friends, as one SVG document. */
export function drawCard(house: House, lang: Lang, project: string): string {
  const L = (x: { en: string; ar: string }) => esc(x[lang])
  const rtl = lang === 'ar' ? ' direction="rtl"' : ''
  const inner = drawHouse(house, lang, { rooms: [], doors: [] }, 'light')
    .replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 290" width="360" height="290">', '<svg x="90" y="190" width="900" height="725" viewBox="0 0 360 290">')
  const rooms = builtRooms(house).length
  const concepts = house.concepts.length
  const stat = (x: number, n: number, label: { en: string; ar: string }) =>
    `<text x="${x}" y="975" text-anchor="middle" font-size="52" font-weight="700" fill="#2C2C2A">${n}</text>` +
    `<text x="${x}" y="1015" text-anchor="middle" font-size="24" fill="#5F5E5A"${rtl}>${L(label)}</text>`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">`,
    `<style>text{font-family:-apple-system,BlinkMacSystemFont,"SF Arabic","Geeza Pro","Segoe UI",system-ui,sans-serif}</style>`,
    `<rect width="1080" height="1080" fill="#FAF9F5"/>`,
    `<text x="540" y="110" text-anchor="middle" font-size="58" font-weight="700" fill="#2C2C2A"${rtl}>${L(t('My app, as a house', 'تطبيقي، كأنو بيت'))}</text>`,
    `<text x="540" y="160" text-anchor="middle" font-size="30" fill="#5F5E5A">${esc(project)}</text>`,
    inner,
    stat(270, rooms, t('rooms', 'غرف')),
    stat(540, house.doors.length, t('doors', 'أبواب')),
    stat(810, concepts, t(`of ${CONCEPT_IDS.length} concepts learned`, `من ${CONCEPT_IDS.length} مفهوم تعلّمتهم`)),
    `<text x="540" y="1058" text-anchor="middle" font-size="20" fill="#888780"${rtl}>${L(UI.cardFooter)}</text>`,
    `</svg>`,
  ].join('')
}

/** A page that shows the card and saves it as a PNG. */
export function cardPage(card: string, lang: Lang): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bayt</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:#EFEDE6;font-family:-apple-system,system-ui,sans-serif;padding:16px;box-sizing:border-box}
#card svg{width:min(90vw,640px);height:auto;border-radius:18px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
button{font:inherit;font-size:17px;padding:12px 26px;border-radius:999px;border:0;background:#2C2C2A;color:#fff;cursor:pointer}</style></head>
<body><div id="card">${card}</div><button id="dl">${esc(UI.cardDownload[lang])}</button>
<script>
document.getElementById('dl').onclick=function(){var s=new XMLSerializer().serializeToString(document.querySelector('#card svg'));var img=new Image();img.onload=function(){var c=document.createElement('canvas');c.width=2160;c.height=2160;var x=c.getContext('2d');x.drawImage(img,0,0,2160,2160);c.toBlob(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='my-bayt-house.png';a.click()},'image/png')};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)};
</script></body></html>`
}
