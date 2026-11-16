// How Bayt explains a tool call. The risk level comes only from fixed rules
// here, never from a model. Anything Bayt does not recognize is Careful,
// never Safe.

import { t } from './words'
import type { ConceptId, DoorId, Level, RoomId, Txt } from '../types'
export type { Level } from '../types'
const RANK: Record<Level, number> = { safe: 0, careful: 1, danger: 2 }

export type Explanation = {
  level: Level
  title: Txt
  desc: Txt
  concepts: ConceptId[]
  rooms: RoomId[]
  doors: DoorId[]
  /** Files a write touched, with the room each one belongs to. */
  files: { room: RoomId; path: string }[]
  /** How many more steps the command holds beyond the one explained. */
  extra: number
}

type Extras = Partial<Pick<Explanation, 'concepts' | 'rooms' | 'doors' | 'files'>>

const ex = (level: Level, title: Txt, desc: Txt, extras: Extras = {}): Explanation => ({
  level,
  title,
  desc,
  concepts: extras.concepts ?? [],
  rooms: extras.rooms ?? [],
  doors: extras.doors ?? [],
  files: extras.files ?? [],
  extra: 0,
})

// ---------------------------------------------------------------- helpers

const base = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? p
const ENV_FILE = /(^|\/)\.env(\.[\w.-]+)?$/i
const isEnv = (p: string) => ENV_FILE.test(p.trim().replace(/^['"]|['"]$/g, ''))

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/, // OpenAI, Anthropic
  /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/, // Stripe live
  /\bAKIA[0-9A-Z]{16}\b/, // AWS
  /\bgh[pousr]_[A-Za-z0-9]{30,}/, // GitHub
  /\bAIza[0-9A-Za-z_-]{30,}/, // Google API
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]
export const hasSecret = (text: string) => SECRET_PATTERNS.some(p => p.test(text))

const DOOR_PACKAGES: [RegExp, DoorId][] = [
  [/^(next-auth|@auth\/|googleapis|@react-oauth\/google|@google-cloud\/)/, 'google'],
  [/^(stripe|@stripe\/)/, 'stripe'],
  [/^(openai|@ai-sdk\/openai)$/, 'openai'],
  [/^(@anthropic-ai\/|anthropic$|@ai-sdk\/anthropic)/, 'claude'],
  [/^@supabase\//, 'supabase'],
  [/^(firebase|firebase-admin)$/, 'firebase'],
  [/^(resend|@sendgrid\/|nodemailer|postmark)/, 'email'],
]
const DOOR_ENV_KEYS: [RegExp, DoorId][] = [
  [/^(GOOGLE_|AUTH_GOOGLE|NEXTAUTH_)/, 'google'],
  [/^(STRIPE_|NEXT_PUBLIC_STRIPE)/, 'stripe'],
  [/^OPENAI_/, 'openai'],
  [/^ANTHROPIC_/, 'claude'],
  [/^(NEXT_PUBLIC_)?SUPABASE_/, 'supabase'],
  [/^(NEXT_PUBLIC_)?FIREBASE_/, 'firebase'],
  [/^(RESEND_|SENDGRID_|SMTP_|POSTMARK_)/, 'email'],
]

const uniq = <T,>(xs: T[]) => [...new Set(xs)]

export const doorsForPackages = (pkgs: string[]): DoorId[] =>
  uniq(pkgs.flatMap(p => DOOR_PACKAGES.filter(([re]) => re.test(p.replace(/@[^@/]*$/, ''))).map(([, d]) => d)))

export const doorsForEnv = (content: string): DoorId[] =>
  uniq(
    content
      .split('\n')
      .map(l => l.trim().replace(/^export\s+/, '').split('=')[0] ?? '')
      .flatMap(k => DOOR_ENV_KEYS.filter(([re]) => re.test(k)).map(([, d]) => d)),
  )

// ---------------------------------------------------------------- rooms

/** Which room of the house a file belongs to. */
export function roomForPath(path: string, cwd = ''): RoomId {
  let p = path
  if (cwd && p.startsWith(cwd)) p = p.slice(cwd.length)
  p = '/' + p.replace(/^\/+/, '').toLowerCase()
  if (isEnv(p) || /(^|\/)(secrets?|credentials)(\.|\/|$)/.test(p)) return 'secrets'
  if (/\.(test|spec)\.\w+$|\/(tests?|__tests__|e2e|cypress|playwright)\//.test(p)) return 'tests'
  if (/\/(prisma|migrations?|drizzle|supabase|db|database|models?)\/|schema\.prisma$|\.(sql|sqlite|db)$/.test(p)) return 'storage'
  if (
    /\/(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|requirements\.txt|pyproject\.toml|poetry\.lock|gemfile(\.lock)?|go\.(mod|sum)|cargo\.(toml|lock)|dockerfile|docker-compose[\w.-]*|\.gitignore|readme(\.\w+)?|license(\.\w+)?|makefile)$/.test(p) ||
    /\/(tsconfig[\w.-]*\.json|[\w-]+\.config\.[cm]?[jt]s|\.eslintrc[\w.-]*|\.prettierrc[\w.-]*|\.editorconfig|\.nvmrc)$/.test(p) ||
    /\/\.(github|vscode|husky)\//.test(p)
  )
    return 'toolbox'
  if (/\/(api|server|routes?|lib|utils?|services?|hooks|actions|middleware|backend|controllers?)\//.test(p) || /\/(route|middleware)\.[jt]s$/.test(p)) return 'logic'
  if (/\.(tsx|jsx|vue|svelte|astro|html?|css|scss|sass|less|png|jpe?g|svg|gif|webp|ico)$/.test(p) || /\/(app|pages|components|views|public|styles|ui|templates)\//.test(p)) return 'screens'
  if (/\.(ts|js|mjs|cjs|py|go|rb|rs|java|kt|php|swift|cs)$/.test(p)) return 'logic'
  return 'toolbox'
}

const FILE_HINTS: [RegExp, Txt][] = [
  [/\/page\.(tsx|jsx|js|ts)$|\/pages\/[^/]+\.(tsx|jsx)$/, t('A page people can visit.', 'صفحة بيقدر الناس يزوروها.')],
  [/\/layout\.(tsx|jsx)$/, t('The frame around every page: header, fonts, menus.', 'الإطار حوالي كل الصفحات: العنوان، الخطوط، القوائم.')],
  [/\/route\.[jt]s$|\/api\//, t('An API door: other code knocks here to get data.', 'باب API: كود تاني بيدقّ هون ليطلب بيانات.')],
  [/\.(css|scss|sass|less)$/, t("Your app's look: colors, spacing, fonts.", 'شكل تطبيقك: ألوان، مسافات، خطوط.')],
  [/\/components\//, t('A reusable piece of screen.', 'قطعة من الشاشة بتنعاد.')],
  [/\/package\.json$/, t('The list of libraries your app uses, and its scripts.', 'قائمة المكتبات اللي بيستخدمها تطبيقك، وأوامره.')],
  [/\/readme(\.\w+)?$/, t('Instructions for people reading the project.', 'تعليمات للي بيقرأ المشروع.')],
  [/schema\.prisma$/, t('The shape of your data: which tables, which fields.', 'شكل بياناتك: أي جداول وأي حقول.')],
  [/\.gitignore$/, t('Files Git should never save, like your secrets.', 'ملفات لازم Git ما يحفظها أبداً، متل أسرارك.')],
]

// ---------------------------------------------------------------- files

const ROOM_NAME: Record<RoomId, Txt> = {
  screens: t('Screens', 'الشاشات'),
  logic: t('Logic', 'المنطق'),
  storage: t('Storage', 'التخزين'),
  toolbox: t('Toolbox', 'العدّة'),
  tests: t('Tests', 'الفحوصات'),
  secrets: t('Secrets safe', 'خزنة الأسرار'),
}
const ROOM_WHAT: Record<RoomId, Txt> = {
  screens: t('Something people will see and tap.', 'شي رح يشوفوه الناس ويضغطوا عليه.'),
  logic: t('Rules behind the screens.', 'قواعد ورا الشاشات.'),
  storage: t('How your app remembers data.', 'كيف بيتذكّر تطبيقك البيانات.'),
  toolbox: t('Settings and helpers for the project.', 'إعدادات ومساعدين للمشروع.'),
  tests: t('A check that your app still works.', 'فحص إنو تطبيقك لسّا شغّال.'),
  secrets: t('Never share this file or upload it.', 'لا تشارك هالملف ولا ترفعه أبداً.'),
}

export function explainFile(tool: string, path: string, content: string, cwd = ''): Explanation {
  const room = roomForPath(path, cwd)
  const name = base(path)
  const files = [{ room, path }]
  const lower = '/' + path.toLowerCase().replace(/^\/+/, '')

  if (room === 'secrets') {
    return ex(
      'careful',
      t(`Saves a secret key in ${name}`, `يحفظ مفتاح سرّي بـ ${name}`),
      t('This file holds passwords and keys. Never share it or upload it to GitHub.', 'هالملف فيه كلمات سر ومفاتيح. لا تشاركه ولا ترفعه على GitHub أبداً.'),
      { rooms: [room], concepts: ['env'], doors: doorsForEnv(content), files },
    )
  }
  if (hasSecret(content)) {
    return ex(
      'danger',
      t(`Puts a secret key inside ${name}`, `عم يحط مفتاح سرّي جوّا ${name}`),
      t('Keys in code can leak when you upload it. Ask Claude to move it to the .env file.', 'المفاتيح جوّا الكود ممكن تتسرّب لما ترفعه. اطلب من Claude ينقله لملف .env.'),
      { rooms: [room], concepts: ['env'], files },
    )
  }

  const concepts: ConceptId[] = []
  if (room === 'screens' && /\.(tsx|jsx|vue|svelte|astro)$/.test(lower)) concepts.push('component')
  if (/\/api\/|\/route\.[jt]s$|\/routes?\//.test(lower)) concepts.push('api')
  if (room === 'tests') concepts.push('tests')
  if (room === 'storage') concepts.push('database')

  const hint = FILE_HINTS.find(([re]) => re.test(lower))?.[1] ?? ROOM_WHAT[room]
  const isNew = tool === 'Write'
  const r = ROOM_NAME[room]
  return ex(
    'safe',
    isNew
      ? t(`Creates ${name} in the ${r.en} room`, `ينشئ ${name} بغرفة ${r.ar}`)
      : t(`Changes ${name} in the ${r.en} room`, `يعدّل ${name} بغرفة ${r.ar}`),
    hint,
    { rooms: [room], concepts, files },
  )
}

// ---------------------------------------------------------------- commands

const REGENERATED = new Set([
  'node_modules', '.next', 'dist', 'build', 'out', '.cache', '.turbo', 'coverage',
  '__pycache__', '.pytest_cache', '.parcel-cache', '.svelte-kit', '.nuxt', 'target', '.vite',
])

const unknownProgram = (prog: string) =>
  ex(
    'careful',
    t(`Runs a program called ${prog}`, `يشغّل برنامج اسمه ${prog}`),
    t("Bayt doesn't know this one yet, so it's marked Careful. Ask Claude what it's for if you're unsure.", 'بيت لسّا ما بيعرف هالبرنامج، فحطّيناه انتبه. اسأل Claude شو بيعمل إذا مو متأكد.'),
  )

const NOTHING = ex('safe', t('Moves into a folder', 'يفوت على مجلد'), t('Just changes where the next command runs.', 'بس بيغيّر وين بينفّذ الأمر الجاي.'))

function explainPackageManager(prog: string, args: string[]): Explanation {
  const [sub = '', ...rest] = args
  const pkgs = rest.filter(a => !a.startsWith('-'))
  const isGlobal = rest.some(a => a === '-g' || a === '--global') || sub === 'global'

  if (['install', 'i', 'add', 'ci'].includes(sub) || (prog === 'bun' && sub === 'install') || (prog === 'yarn' && sub === '')) {
    if (isGlobal) {
      return ex('careful', t('Installs a tool for your whole Mac', 'ينزّل أداة لكل جهازك'), t('Not just this project: it stays on your computer. Fine if you trust the tool.', 'مو بس لهالمشروع: بتضل على جهازك. تمام إذا بتوثق بالأداة.'), { concepts: ['library'] })
    }
    if (pkgs.length === 0) {
      return ex('safe', t('Downloads the libraries this app needs', 'ينزّل المكتبات اللي بدها ياها التطبيق'), t('Reads the shopping list in package.json and fetches everything on it.', 'بيقرأ قائمة المشتريات بـ package.json وبيجيب كل شي فيها.'), { concepts: ['library'], rooms: ['toolbox'] })
    }
    const shown = pkgs.slice(0, 3).join(', ') + (pkgs.length > 3 ? ` +${pkgs.length - 3}` : '')
    return ex('safe', t(`Downloads ${shown}`, `ينزّل ${shown}`), t('Ready-made code your app will use. Like buying a part instead of making it.', 'كود جاهز رح يستخدمه تطبيقك. متل ما تشتري قطعة بدل ما تصنعها.'), { concepts: ['library'], rooms: ['toolbox'], doors: doorsForPackages(pkgs) })
  }
  if (['uninstall', 'remove', 'rm', 'un'].includes(sub)) {
    return ex('safe', t('Removes a library', 'يشيل مكتبة'), t("Your app stops using it. You can add it back anytime.", 'تطبيقك بيبطّل يستخدمها. فيك ترجّعها وقت ما بدك.'), { concepts: ['library'], rooms: ['toolbox'] })
  }
  if (sub === 'publish') {
    return ex('danger', t('Publishes your code for the whole world', 'ينشر كودك للعالم كلّه'), t("Anyone can download it, and it can't really be taken back. Make sure this is what you want.", 'أي حدا بيقدر ينزّله، وما فيك ترجّعه فعلياً. تأكد إنو هاد اللي بدك ياه.'))
  }
  if (sub === 'create' || (sub === 'init' && pkgs.length > 0)) return explainFramework()
  if (sub === 'init') return ex('safe', t('Starts a new project', 'يبلّش مشروع جديد'), t('Creates package.json, the list of what your app needs.', 'بينشئ package.json، قائمة اللي بيحتاجه تطبيقك.'), { rooms: ['toolbox'] })
  if (sub === 'audit') return ex(rest.includes('--force') ? 'careful' : 'safe', t('Checks libraries for known problems', 'يفحص المكتبات من مشاكل معروفة'), t('Looks for security holes in downloaded code.', 'بيدوّر على ثغرات أمنية بالكود المنزّل.'))
  if (['exec', 'dlx', 'x'].includes(sub)) return explainRunner(pkgs)

  const script = sub === 'run' || sub === 'run-script' ? (pkgs[0] ?? '') : sub
  return explainScript(script)
}

function explainScript(script: string): Explanation {
  if (/^(dev|start|serve|preview|develop)$/.test(script)) {
    return ex('safe', t('Starts your app so you can try it', 'يشغّل تطبيقك لتجرّبه'), t('It runs only on your computer. Open the link it prints to see your app.', 'بيشتغل بس على جهازك. افتح الرابط اللي بيطبعه لتشوف تطبيقك.'), { concepts: ['devserver'] })
  }
  if (/^build/.test(script)) return explainBuild()
  if (/^(test|e2e)/.test(script)) return explainTests()
  if (/^(lint|format|typecheck|check|type-check|prettier)/.test(script)) return explainCheck()
  if (script === '') return ex('careful', t('Runs a package manager', 'يشغّل مدير الحزم'), t("Bayt couldn't tell which part. Ask Claude if you're unsure.", 'بيت ما عرف أي جزء. اسأل Claude إذا مو متأكد.'))
  return ex('careful', t(`Runs the project script "${script}"`, `يشغّل أمر المشروع "${script}"`), t('A shortcut written in package.json. Bayt cannot see inside it.', 'اختصار مكتوب بـ package.json. بيت ما بيقدر يشوف جوّاه.'))
}

const explainBuild = () => ex('safe', t('Builds the final version of your app', 'يبني النسخة النهائية من تطبيقك'), t('Packs everything into a fast version, ready to go online.', 'بيجمّع كل شي بنسخة سريعة، جاهزة تطلع أونلاين.'), { concepts: ['build'] })
const explainTests = () => ex('safe', t('Runs the tests', 'يشغّل الفحوصات'), t('Automatic checks that your app still works.', 'فحوصات تلقائية إنو تطبيقك لسّا شغّال.'), { concepts: ['tests'] })
const explainCheck = () => ex('safe', t('Checks your code for mistakes', 'يفحص الكود من الأغلاط'), t('Reads the code and points out problems. It changes nothing.', 'بيقرأ الكود وبيدلّ على المشاكل. ما بيغيّر شي.'))
const explainFramework = () => ex('safe', t("Builds your app's skeleton", 'يبني هيكل تطبيقك'), t("Like pouring a house's foundation before the rooms.", 'متل صبّ أساسات البيت قبل الغرف.'), { concepts: ['framework'], rooms: ['screens', 'logic', 'toolbox'] })

function explainRunner(args: string[]): Explanation {
  const rest = args.filter(a => !/^-(y|-yes)$/.test(a))
  const [tool = '', ...more] = rest
  const name = tool.replace(/@[^@/]*$/, '')
  if (/^create-|^@[\w-]+\/create-|^degit$|^nuxi$|^sv$/.test(name)) return explainFramework()
  return explainProgram(name, more)
}

function explainPrisma(args: string[]): Explanation {
  const [sub = '', act = ''] = args
  const all = args.join(' ')
  if (sub === 'migrate' && act === 'reset') return wipeDatabase()
  if (/--force-reset|--accept-data-loss/.test(all)) return wipeDatabase()
  if (sub === 'migrate' || (sub === 'db' && act === 'push')) {
    return ex('careful', t("Changes your database's shape", 'يغيّر شكل قاعدة بياناتك'), t('Adds or changes tables. Usually fine; it can drop data if a field is removed.', 'بيضيف أو بيعدّل جداول. غالباً تمام؛ بس ممكن يضيّع بيانات إذا انشال حقل.'), { concepts: ['database'], rooms: ['storage'] })
  }
  if (sub === 'studio') return ex('safe', t('Opens a window to look at your data', 'يفتح شبّاك لتشوف بياناتك'), t('A viewer for your database.', 'عارض لقاعدة بياناتك.'), { concepts: ['database'] })
  if (sub === 'init') return ex('safe', t('Sets up a database helper', 'يجهّز مساعد قاعدة البيانات'), t('Creates the file that describes your data.', 'بينشئ الملف اللي بيوصف بياناتك.'), { concepts: ['database'], rooms: ['storage'] })
  return ex('safe', t('Updates the database helper', 'يحدّث مساعد قاعدة البيانات'), t('Regenerates code that talks to your database. Nothing is deleted.', 'بيرجّع يولّد الكود اللي بيحكي مع قاعدة بياناتك. ما بينحذف شي.'), { concepts: ['database'], rooms: ['storage'] })
}

const wipeDatabase = () =>
  ex('danger', t('Wipes your database and starts it fresh', 'يمسح قاعدة بياناتك ويبلّشها من جديد'), t("All saved data is deleted. Fine for test data; never for real users' data.", 'كل البيانات المحفوظة بتنمسح. تمام لبيانات التجربة؛ أبداً لبيانات مستخدمين حقيقيين.'), { concepts: ['database'] })

function explainGit(args: string[]): Explanation {
  const [sub = '', ...rest] = args
  const flags = rest.filter(a => a.startsWith('-'))
  const g = (level: Level, title: Txt, desc: Txt, extras: Extras = {}) =>
    ex(level, title, desc, { ...extras, concepts: ['git', ...(extras.concepts ?? [])] })

  switch (sub) {
    case 'push':
      if (flags.some(f => f === '--force' || f === '-f' || /^-[a-z]*f/.test(f)) || rest.some(a => /^\+/.test(a))) {
        return g('danger', t("Overwrites your project's history on GitHub", 'يكتب فوق تاريخ مشروعك على GitHub'), t("This can erase work that isn't on your computer. Ask Claude why it needs --force.", 'ممكن يمسح شغل مو موجود على جهازك. اسأل Claude ليش بدو --force.'), { doors: ['github'] })
      }
      return g('careful', t('Uploads your code to GitHub', 'يرفع كودك على GitHub'), t('Anyone with access to the repo will see it. Fine if that is what you want.', 'أي حدا عندو وصول للمستودع رح يشوفه. تمام إذا هاد اللي بدك ياه.'), { doors: ['github'] })
    case 'reset':
      if (flags.includes('--hard')) return g('danger', t('Throws away all unsaved changes', 'يرمي كل التعديلات اللي ما انحفظت'), t("Work you haven't committed is gone, and it can't be undone.", 'الشغل اللي ما عملتلو كوميت بيروح، وما فيك ترجّعه.'))
      return g('careful', t('Moves your project back to an earlier point', 'يرجّع مشروعك لنقطة قديمة'), t('Your files stay, but Git forgets some saved steps.', 'ملفاتك بتضل، بس Git بينسى كم خطوة محفوظة.'))
    case 'clean':
      if (flags.some(f => /f/.test(f))) return g('danger', t("Deletes files Git isn't tracking", 'يحذف الملفات اللي Git مو متابعها'), t('New files you never committed are deleted for good.', 'الملفات الجديدة اللي ما عملتلها كوميت بتنحذف نهائياً.'))
      return g('safe', t('Lists files Git would clean up', 'يعرض الملفات اللي ممكن Git ينظّفها'), t('Only shows them. Nothing is deleted.', 'بس بيعرضها. ما بينحذف شي.'))
    case 'checkout':
    case 'restore':
      if ((rest.includes('.') || rest.includes('--')) && !rest.includes('--staged') && !rest.includes('-b')) {
        return g('danger', t('Throws away your recent edits', 'يرمي تعديلاتك الأخيرة'), t("Files go back to the last saved version. Unsaved edits can't come back.", 'الملفات بترجع لآخر نسخة محفوظة. التعديلات اللي ما انحفظت ما بترجع.'))
      }
      if (rest.includes('-b')) return g('safe', t('Starts a new branch', 'يبلّش فرع جديد'), t('A safe copy to try ideas without touching the main version.', 'نسخة آمنة لتجرّب أفكار بدون ما تلمس النسخة الأساسية.'))
      return g('safe', t('Switches to another version of the project', 'ينقل لنسخة تانية من المشروع'), t('Like walking into another copy of your house.', 'متل ما تفوت على نسخة تانية من بيتك.'))
    case 'switch':
      return g('safe', t('Switches to another branch', 'ينقل لفرع تاني'), t('Like walking into another copy of your house.', 'متل ما تفوت على نسخة تانية من بيتك.'))
    case 'branch':
      if (flags.includes('-D')) return g('careful', t('Deletes a branch', 'يحذف فرع'), t('Even if its work was never merged. Check the name.', 'حتى لو شغلو ما اندمج. تأكد من الاسم.'))
      return g('safe', t('Lists or makes branches', 'يعرض أو يعمل فروع'), t('Branches are copies to try ideas safely.', 'الفروع نسخ لتجرّب أفكار بأمان.'))
    case 'add':
      if (rest.some(isEnv)) return g('danger', t('Puts your secrets file into Git', 'يحط ملف أسرارك بـ Git'), t('Once uploaded, your keys can leak. Secrets should stay out of Git.', 'إذا انرفع، مفاتيحك ممكن تتسرّب. الأسرار لازم تضل برّا Git.'), { concepts: ['env'] })
      return g('safe', t('Picks changes to save', 'يختار التعديلات ليحفظها'), t('Like putting things in a box before you seal it with a commit.', 'متل ما تحط أغراض بصندوق قبل ما تسكّره بكوميت.'))
    case 'commit':
      return g('safe', t('Saves a checkpoint', 'يحفظ نقطة رجوع'), t('You can always come back to this exact version later.', 'فيك دايماً ترجع لهالنسخة بالضبط بعدين.'), { concepts: ['commit'] })
    case 'init':
      return g('safe', t('Starts tracking history', 'يبلّش يسجّل التاريخ'), t('From now on, every saved version can be brought back.', 'من هلق، كل نسخة محفوظة فيك ترجّعها.'))
    case 'clone':
      return g('safe', t('Downloads a project', 'ينزّل مشروع'), t('Makes a full copy of a project on your computer.', 'بيعمل نسخة كاملة من مشروع على جهازك.'))
    case 'pull':
    case 'fetch':
      return g('safe', t('Gets the latest changes', 'يجيب آخر التعديلات'), t('Brings in work saved somewhere else, like GitHub.', 'بيجيب الشغل المحفوظ بمكان تاني، متل GitHub.'))
    case 'stash':
      if (/^(drop|clear)/.test(rest[0] ?? '')) return g('careful', t('Deletes changes set aside earlier', 'يحذف تعديلات كانت محطوطة عجنب'), t("They can't easily come back.", 'ما بترجع بسهولة.'))
      return g('safe', t('Puts changes aside for later', 'يحط التعديلات عجنب لبعدين'), t('Like putting work in a drawer. Nothing is lost.', 'متل ما تحط شغلك بالجارور. ما بيضيع شي.'))
    case 'merge':
    case 'rebase':
    case 'cherry-pick':
      return g('careful', t('Combines two versions of the project', 'يدمج نسختين من المشروع'), t('Usually fine; it can cause conflicts Claude has to fix.', 'غالباً تمام؛ ممكن يعمل تعارضات لازم Claude يصلّحها.'))
    case 'rm':
      return g('careful', t('Removes files from the project', 'يشيل ملفات من المشروع'), t('They are deleted and Git stops tracking them.', 'بينحذفوا وبيبطّل Git يتابعهم.'))
    case 'status':
    case 'log':
    case 'diff':
    case 'show':
    case 'remote':
    case 'blame':
    case 'rev-parse':
    case 'config':
      if (sub === 'config' && rest.filter(a => !a.startsWith('-')).length > 1 && !rest.some(a => a.startsWith('--get') || a === '-l' || a === '--list')) {
        return g('careful', t('Changes a Git setting', 'يغيّر إعداد بـ Git'), t('Settings like your name or email for commits.', 'إعدادات متل اسمك أو إيميلك بالكوميتات.'))
      }
      return g('safe', t("Checks the project's history", 'يشيّك على تاريخ المشروع'), t('Only looks. Nothing changes.', 'بس بيتطلّع. ما بيتغيّر شي.'))
    default:
      return g('careful', t(`Runs git ${sub}`, `يشغّل git ${sub}`), t("A Git action Bayt doesn't explain yet. Ask Claude if you're unsure.", 'حركة بـ Git بيت لسّا ما بيشرحها. اسأل Claude إذا مو متأكد.'))
  }
}

function explainRm(args: string[]): Explanation {
  const flags = args.filter(a => a.startsWith('-'))
  const targets = args.filter(a => !a.startsWith('-')).map(a => a.replace(/^['"]|['"]$/g, ''))
  const recursive = flags.some(f => /^-[a-z]*r/i.test(f) || f === '--recursive')
  const shown = targets.slice(0, 3).join(', ')
  const huge = targets.some(a => /^(\/|~|~\/|\*|\.|\.\.|\.\/|\$HOME\/?|\/\*|~\/\*|\.\/\*)$/.test(a) || /(^|\/)\.git\/?$/.test(a))
  if (huge || targets.length === 0) {
    return ex('danger', t('Deletes a lot, permanently', 'يحذف كتير، نهائياً'), t("This can wipe whole folders or your project's history. It skips the Trash.", 'ممكن يمسح مجلدات كاملة أو تاريخ مشروعك. وما بيمرق عسلة المحذوفات.'))
  }
  if (targets.every(a => REGENERATED.has(base(a)))) {
    return ex('careful', t('Deletes files that come back', 'يحذف ملفات بترجع'), t(`${shown}: downloaded or generated files. They return next time you install or build.`, `${shown}: ملفات منزّلة أو مولّدة. بترجع بأول تنزيل أو بناء.`))
  }
  if (targets.some(isEnv)) {
    return ex('danger', t('Deletes your secrets file', 'يحذف ملف أسرارك'), t("Your keys are gone unless you saved them somewhere else.", 'مفاتيحك بتروح إلا إذا محفوظة بمكان تاني.'))
  }
  if (recursive) {
    return ex('danger', t('Deletes a folder for good', 'يحذف مجلد نهائياً'), t(`${shown}: it skips the Trash, so it can't be undone. Check the name.`, `${shown}: ما بيمرق عسلة المحذوفات، وما فيك ترجّعه. تأكد من الاسم.`))
  }
  return ex('careful', t('Deletes a file for good', 'يحذف ملف نهائياً'), t(`${shown}: it skips the Trash.`, `${shown}: ما بيمرق عسلة المحذوفات.`))
}

function explainProgram(prog: string, args: string[]): Explanation {
  const all = args.join(' ')
  const sub = args[0] ?? ''
  switch (prog) {
    case 'cd':
      return NOTHING
    case 'npm':
    case 'pnpm':
    case 'yarn':
    case 'bun':
      return explainPackageManager(prog, args)
    case 'npx':
    case 'bunx':
      return explainRunner(args)
    case 'git':
      return explainGit(args)
    case 'gh':
      if (sub === 'repo' && args[1] === 'create') {
        return ex(args.includes('--public') ? 'careful' : 'safe', t('Creates a GitHub repository', 'ينشئ مستودع على GitHub'), args.includes('--public') ? t('Public: anyone on the internet can read the code.', 'عام: أي حدا على الإنترنت بيقدر يقرأ الكود.') : t('A home for your code on GitHub.', 'بيت لكودك على GitHub.'), { doors: ['github'], concepts: ['git'] })
      }
      if (sub === 'pr' && args[1] === 'merge') return ex('careful', t('Merges a pull request', 'يدمج طلب سحب'), t('The change becomes part of the main version.', 'التعديل بيصير جزء من النسخة الأساسية.'), { doors: ['github'], concepts: ['git'] })
      return ex('safe', t('Talks to GitHub', 'يحكي مع GitHub'), t('Reads or creates things like issues and pull requests.', 'بيقرأ أو بينشئ أشياء متل المشاكل وطلبات السحب.'), { doors: ['github'] })
    case 'rm':
    case 'rmdir':
      return explainRm(prog === 'rmdir' ? ['-r', ...args] : args)
    case 'sudo':
      return ex('danger', t('Runs with full control of your computer', 'يشتغل بتحكّم كامل بجهازك'), t('sudo gives a command admin power over your whole Mac, not just this project. Ask Claude why it needs it.', 'sudo بيعطي الأمر صلاحية المدير على كل جهازك، مو بس هالمشروع. اسأل Claude ليش بدو ياه.'))
    case 'chmod':
      if (/\b777\b|a\+rwx/.test(all)) return ex('danger', t('Lets anyone change these files', 'يسمح لأي حدا يغيّر هالملفات'), t('Opens the files up completely. Rarely the right fix.', 'بيفتح الملفات عالآخر. نادراً ما يكون الحل الصح.'))
      return ex('careful', t('Changes who can use a file', 'يغيّر مين بيقدر يستخدم ملف'), t('Usually makes a script runnable.', 'غالباً لحتى يصير السكربت قابل للتشغيل.'))
    case 'mkfs':
    case 'dd':
    case 'diskutil':
      return ex('danger', t('Can erase a whole disk', 'ممكن يمسح قرص كامل'), t('Stop and ask Claude why this is needed.', 'وقّف واسأل Claude ليش لازم.'))
    case 'kill':
    case 'pkill':
    case 'killall':
      return ex('careful', t('Stops a running program', 'يوقّف برنامج شغّال'), t('Usually an old copy of your app that is stuck.', 'غالباً نسخة قديمة من تطبيقك علقانة.'))
    case 'ls':
    case 'pwd':
    case 'tree':
    case 'stat':
    case 'du':
    case 'df':
    case 'file':
      return ex('safe', t('Looks at the files', 'يتطلّع عالملفات'), t('Only looks. Nothing changes.', 'بس بيتطلّع. ما بيتغيّر شي.'))
    case 'cat':
    case 'less':
    case 'more':
    case 'head':
    case 'tail':
    case 'wc':
    case 'bat':
      if (args.some(isEnv)) return showsSecrets()
      return ex('safe', t('Reads a file', 'يقرأ ملف'), t('Only looks. Nothing changes.', 'بس بيتطلّع. ما بيتغيّر شي.'))
    case 'env':
    case 'printenv':
      return showsSecrets()
    case 'grep':
    case 'rg':
    case 'ag':
    case 'fd':
    case 'which':
    case 'whereis':
    case 'type':
    case 'ps':
    case 'lsof':
    case 'echo':
    case 'printf':
    case 'date':
    case 'sleep':
    case 'true':
    case 'sort':
    case 'uniq':
    case 'jq':
    case 'diff':
    case 'sw_vers':
    case 'uname':
      return ex('safe', t('Looks something up', 'يدوّر على شي'), t('Searches or prints information. Nothing changes.', 'بيدوّر أو بيطبع معلومات. ما بيتغيّر شي.'))
    case 'find':
      if (/-delete\b|-exec\s+rm\b/.test(all)) return ex('danger', t('Finds files and deletes them', 'يلاقي ملفات ويحذفها'), t('Deletes everything that matches, for good.', 'بيحذف كل شي بيطابق، نهائياً.'))
      return ex('safe', t('Searches for files', 'يدوّر على ملفات'), t('Only looks. Nothing changes.', 'بس بيتطلّع. ما بيتغيّر شي.'))
    case 'mkdir':
      return ex('safe', t('Makes a new folder', 'يعمل مجلد جديد'), t('An empty room to put files in.', 'غرفة فاضية لتحط فيها ملفات.'))
    case 'touch':
      return ex('safe', t('Creates an empty file', 'ينشئ ملف فاضي'), t('A blank page, ready to be written.', 'ورقة بيضا، جاهزة للكتابة.'))
    case 'cp':
      return ex('safe', t('Copies files', 'ينسخ ملفات'), t('Makes a duplicate. The original stays.', 'بيعمل نسخة. الأصل بيضل.'))
    case 'mv':
      return ex('careful', t('Moves or renames files', 'ينقل أو يغيّر اسم ملفات'), t('If a file with the new name exists, it gets replaced.', 'إذا في ملف بنفس الاسم الجديد، بينمسح مكانه.'))
    case 'open':
    case 'code':
    case 'cursor':
      return ex('safe', t('Opens it on your Mac', 'يفتحه على جهازك'), t('Shows a file, folder or link in an app.', 'بيعرض ملف أو مجلد أو رابط بتطبيق.'))
    case 'node':
    case 'python':
    case 'python3':
    case 'deno':
    case 'ruby':
    case 'go':
      if (/^-?-?v(ersion)?$/.test(sub)) return ex('safe', t("Checks what's installed", 'يشيّك شو منزّل'), t('Prints a version number.', 'بيطبع رقم النسخة.'))
      if (sub === '-m' && args[1] === 'venv') return ex('safe', t('Makes a private box for Python libraries', 'يعمل صندوق خاص لمكتبات بايثون'), t('Keeps this project separate from the rest of your Mac.', 'بيخلّي هالمشروع مفصول عن باقي جهازك.'))
      if (sub === '-m' && args[1] === 'pip') return explainPip(args.slice(2))
      if (sub === '-m' && args[1] === 'pytest') return explainTests()
      if (sub === '-c' || sub === '-e') return ex('careful', t('Runs a few lines of code', 'يشغّل كم سطر كود'), t('Code typed right into the command. Usually a quick check.', 'كود مكتوب جوّا الأمر. غالباً فحص سريع.'))
      return ex('safe', t('Runs a file from your project', 'يشغّل ملف من مشروعك'), t('Starts code that Claude or you wrote.', 'بيشغّل كود كتبه Claude أو إنت.'))
    case 'pip':
    case 'pip3':
    case 'uv':
    case 'poetry':
      return explainPip(args)
    case 'brew':
      if (sub === 'install') return ex('careful', t('Installs a program on your Mac', 'ينزّل برنامج على جهازك'), t('It stays on your computer, not just in this project.', 'بيضل على جهازك، مو بس بهالمشروع.'))
      return ex('safe', t('Uses Homebrew', 'يستخدم Homebrew'), t('The Mac app store for developer tools.', 'متجر أدوات المطوّرين على الماك.'))
    case 'curl':
    case 'wget':
      if (/-X\s*(POST|PUT|PATCH|DELETE)|--data|-d\s|-F\s|--form/.test(all)) return ex('careful', t('Sends data to a website', 'يبعت بيانات لموقع'), t('Check where it goes, especially if it holds keys.', 'شوف لوين رايحة، خصوصاً إذا فيها مفاتيح.'))
      if (/localhost|127\.0\.0\.1/.test(all)) return ex('safe', t('Checks your app is answering', 'يشيّك إنو تطبيقك عم يرد'), t('Knocks on your own app to see if it is up.', 'بيدقّ على تطبيقك ليشوف إذا شغّال.'))
      return ex('safe', t('Downloads from the internet', 'ينزّل من الإنترنت'), t('Fetches a page or file. It does not run it.', 'بيجيب صفحة أو ملف. ما بيشغّله.'))
    case 'docker':
      if (/prune|rm\b|rmi\b/.test(all)) return ex('careful', t('Deletes Docker leftovers', 'يحذف بقايا Docker'), t('Old containers or images. Data inside them is lost.', 'حاويات أو صور قديمة. البيانات جوّاها بتروح.'))
      return ex('safe', t("Runs your app's helper services", 'يشغّل خدمات مساعدة لتطبيقك'), t('Things like a database, in a sealed box.', 'أشياء متل قاعدة بيانات، بصندوق مسكّر.'))
    case 'next':
    case 'vite':
    case 'nuxt':
    case 'astro':
      if (sub === 'build') return explainBuild()
      if (sub === 'lint') return explainCheck()
      return explainScript(sub === '' ? 'dev' : sub)
    case 'tsc':
    case 'eslint':
    case 'prettier':
    case 'biome':
    case 'ruff':
    case 'mypy':
    case 'black':
      return explainCheck()
    case 'jest':
    case 'vitest':
    case 'pytest':
    case 'playwright':
    case 'cypress':
    case 'mocha':
      return explainTests()
    case 'prisma':
      return explainPrisma(args)
    case 'vercel':
    case 'netlify':
    case 'fly':
    case 'flyctl':
    case 'wrangler':
      if (/--prod|deploy/.test(all) || sub === '') return ex('careful', t('Puts your app on the internet', 'يرفع تطبيقك على الإنترنت'), t('Anyone with the link can open it. Make sure secrets stay in .env.', 'أي حدا معو الرابط بيقدر يفتحه. تأكد إنو الأسرار بـ .env.'), { concepts: ['deploy'], doors: ['live'] })
      return ex('careful', t(`Uses ${prog}`, `يستخدم ${prog}`), t('A hosting tool. Ask Claude what this step does.', 'أداة استضافة. اسأل Claude شو بتعمل هالخطوة.'), { concepts: ['deploy'] })
    case 'supabase':
      if (/db\s+reset/.test(all)) return wipeDatabase()
      return ex('careful', t('Uses Supabase', 'يستخدم Supabase'), t('Your online database. Some actions change real data.', 'قاعدة بياناتك أونلاين. في حركات بتغيّر بيانات حقيقية.'), { doors: ['supabase'], concepts: ['database'] })
    case 'firebase':
      if (sub === 'deploy') return ex('careful', t('Puts your app on the internet', 'يرفع تطبيقك على الإنترنت'), t('Anyone with the link can open it.', 'أي حدا معو الرابط بيقدر يفتحه.'), { concepts: ['deploy'], doors: ['live', 'firebase'] })
      return ex('careful', t('Uses Firebase', 'يستخدم Firebase'), t("Google's online database and login.", 'قاعدة بيانات وتسجيل دخول من Google.'), { doors: ['firebase'] })
    case 'psql':
    case 'mysql':
    case 'sqlite3':
      return ex('careful', t('Talks to your database directly', 'يحكي مع قاعدة بياناتك مباشرة'), t('It can read or change saved data.', 'بيقدر يقرأ أو يغيّر البيانات المحفوظة.'), { concepts: ['database'] })
    case 'dropdb':
      return wipeDatabase()
    case 'source':
    case '.':
      return ex('safe', t('Turns on project settings', 'يشغّل إعدادات المشروع'), t('Usually switches on the Python box for this project.', 'غالباً بيشغّل صندوق بايثون لهالمشروع.'))
    case 'export':
      if (/(KEY|SECRET|TOKEN|PASSWORD)/i.test(all)) return ex('careful', t('Sets a secret for this terminal', 'يحط سر لهالتيرمنال'), t('The key shows in this chat. Better to keep it in .env.', 'المفتاح بيبيّن بهالمحادثة. الأحسن تخلّيه بـ .env.'), { concepts: ['env'] })
      return ex('safe', t('Sets a setting for this terminal', 'يحط إعداد لهالتيرمنال'), t('Lasts until the terminal closes.', 'بيضل لحتى يتسكّر التيرمنال.'))
    default:
      return unknownProgram(prog)
  }
}

function explainPip(args: string[]): Explanation {
  const [sub = ''] = args
  if (sub === 'install' || sub === 'add' || sub === 'sync') {
    return ex('safe', t('Downloads Python libraries', 'ينزّل مكتبات بايثون'), t('Ready-made code your app will use.', 'كود جاهز رح يستخدمه تطبيقك.'), { concepts: ['library'], rooms: ['toolbox'] })
  }
  if (sub === 'uninstall' || sub === 'remove') return ex('safe', t('Removes a Python library', 'يشيل مكتبة بايثون'), t('You can add it back anytime.', 'فيك ترجّعها وقت ما بدك.'), { concepts: ['library'] })
  if (sub === 'run') return ex('safe', t('Runs a file from your project', 'يشغّل ملف من مشروعك'), t('Starts code that Claude or you wrote.', 'بيشغّل كود كتبه Claude أو إنت.'))
  return ex('safe', t('Uses the Python package tool', 'يستخدم أداة حزم بايثون'), t('Lists or manages libraries.', 'بيعرض أو بيرتّب المكتبات.'))
}

const showsSecrets = () =>
  ex('careful', t('Shows your secret keys on screen', 'يعرض مفاتيحك السرّية عالشاشة'), t('Anyone who sees this chat or your screen can read them.', 'أي حدا بيشوف هالمحادثة أو شاشتك بيقدر يقرأها.'), { concepts: ['env'] })

/** Danger that only shows when looking at the whole command at once. */
function wholeCommand(command: string): Explanation | null {
  if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(command)) {
    return ex('danger', t('Downloads a script and runs it right away', 'ينزّل سكربت ويشغّله فوراً'), t("You can't see what it does before it runs. Only OK from a site you trust.", 'ما فيك تشوف شو بيعمل قبل ما يشتغل. تمام بس من موقع بتوثق فيه.'))
  }
  if (/\b(drop\s+(table|database|schema)|truncate\s+(table\s+)?\w)/i.test(command) || /\bdelete\s+from\s+\w+\s*(;|"|'|$)/i.test(command)) {
    return ex('danger', t('Deletes data from your database', 'يحذف بيانات من قاعدة بياناتك'), t("Deleted rows can't come back unless you have a backup.", 'السطور المحذوفة ما بترجع إلا إذا عندك نسخة احتياطية.'), { concepts: ['database'] })
  }
  return null
}

/** Redirects like `> file` overwrite; `>> file` adds. */
function explainRedirect(segment: string): Explanation | null {
  const m = segment.match(/(?:^|[^>&\d])>\s*([^\s&|;>]+)/)
  if (!m || !m[1] || m[1] === '/dev/null') return null
  const target = m[1]
  if (isEnv(target)) {
    return ex('careful', t('Saves a secret key', 'يحفظ مفتاح سرّي'), t('Never share this file or upload it to GitHub.', 'لا تشارك هالملف ولا ترفعه على GitHub أبداً.'), { concepts: ['env'], rooms: ['secrets'] })
  }
  return ex('careful', t(`Overwrites ${base(target)}`, `يكتب فوق ${base(target)}`), t('Whatever was in the file is replaced.', 'كل شي كان بالملف بينمسح ويتبدّل.'))
}

function splitSegments(command: string): string[] {
  return command
    .split(/\s*(?:&&|\|\||;|\n|\|)\s*/)
    .map(s => s.trim())
    .filter(s => s !== '' && !s.startsWith('#'))
}

function explainSegment(segment: string): Explanation {
  const cleaned = segment
    .replace(/^\(+|\)+$/g, '')
    .replace(/^(\w+=("[^"]*"|'[^']*'|\S*)\s+)+/, '')
    .replace(/^(time|nohup|exec|command)\s+/, '')
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const prog = base(tokens[0] ?? '')
  const main = explainProgram(prog, tokens.slice(1))
  const redirect = explainRedirect(cleaned)
  return redirect && RANK[redirect.level] > RANK[main.level] ? redirect : main
}

const merge = (into: Explanation, from: Explanation): Explanation => ({
  ...into,
  concepts: uniq([...into.concepts, ...from.concepts]),
  rooms: uniq([...into.rooms, ...from.rooms]),
  doors: uniq([...into.doors, ...from.doors]),
})

export function explainBash(command: string): Explanation {
  const whole = wholeCommand(command)
  const parts = splitSegments(command).map(explainSegment)
  const meaningful = parts.filter(p => p !== NOTHING)
  const pool = meaningful.length > 0 ? meaningful : parts
  if (pool.length === 0) return unknownProgram('?')

  let top = pool[0]!
  // The riskiest step wins; on a tie, the last step, which is usually the point of the command.
  for (const p of pool) if (RANK[p.level] >= RANK[top.level]) top = p
  if (whole && RANK[whole.level] >= RANK[top.level]) top = whole

  let out: Explanation = { ...top, extra: Math.max(0, pool.length - 1) }
  out = merge(out, ex('safe', out.title, out.desc, { concepts: ['terminal'] }))
  for (const p of pool) out = merge(out, p)
  return out
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** The explanation for one tool call, or null for a tool Bayt stays quiet about. */
export function explainCall(tool: string, input: unknown, cwd = ''): Explanation | null {
  const i = (input ?? {}) as Record<string, unknown>
  if (tool === 'Bash') return str(i.command) ? explainBash(str(i.command)) : null
  if (tool === 'Write') return str(i.file_path) ? explainFile('Write', str(i.file_path), str(i.content), cwd) : null
  if (tool === 'Edit' || tool === 'MultiEdit') {
    const edits = Array.isArray(i.edits) ? (i.edits as Record<string, unknown>[]).map(x => str(x.new_string)).join('\n') : ''
    return str(i.file_path) ? explainFile('Edit', str(i.file_path), str(i.new_string) + edits, cwd) : null
  }
  return null
}

export const levelRank = (l: Level) => RANK[l]
