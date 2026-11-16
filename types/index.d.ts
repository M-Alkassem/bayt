// Bayt's type contract: the values it keeps in $.state, and the words they use.

export type Lang = 'en' | 'ar'
export type Txt = { en: string; ar: string }
export type Level = 'safe' | 'careful' | 'danger'

export type RoomId = 'screens' | 'logic' | 'storage' | 'toolbox' | 'tests' | 'secrets'
export type DoorId = 'google' | 'stripe' | 'openai' | 'claude' | 'supabase' | 'firebase' | 'email' | 'github' | 'live'
export type ConceptId =
  | 'terminal' | 'library' | 'framework' | 'component' | 'database' | 'env' | 'git'
  | 'commit' | 'devserver' | 'build' | 'tests' | 'api' | 'deploy'

export type House = {
  /** Each built room and the project files in it (relative paths, newest first). */
  rooms: { [K in RoomId]?: string[] }
  doors: DoorId[]
  concepts: ConceptId[]
  steps: number
}

/** The last thing Claude did, for the pane's "Latest" line and the glow. */
export type Latest = { title: Txt; level: Level; rooms: RoomId[]; doors: DoorId[] }

/** What happened in this session alone. */
export type SessionStats = { steps: number; rooms: RoomId[]; concepts: ConceptId[] }

export type Selected = { kind: 'room'; id: RoomId } | { kind: 'concept'; id: ConceptId }

declare module 'claude-code' {
  interface PluginState {
    bayt: {
      house: Shaped<House>
      lang: Lang
      cwd: string
      latest: Shaped<Latest | null>
      session: Shaped<SessionStats>
      selected: Selected | null
    }
  }
}
