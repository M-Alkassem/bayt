// Every word Bayt shows, in English and Arabic (friendly Shami).

import type { ConceptId, DoorId, RoomId, Txt } from '../types'
export type { ConceptId, DoorId, Lang, RoomId, Txt } from '../types'

export const t = (en: string, ar: string): Txt => ({ en, ar })

export const ROOM_IDS: readonly RoomId[] = ['screens', 'logic', 'storage', 'toolbox', 'tests', 'secrets']

export const ROOMS: Record<RoomId, { name: Txt; what: Txt; built: Txt }> = {
  screens: {
    name: t('Screens', 'الشاشات'),
    what: t('Everything people see and tap: pages, buttons, colors.', 'كل شي بيشوفوه الناس وبيضغطوا عليه: صفحات، أزرار، ألوان.'),
    built: t('Screens room: something people will see.', 'غرفة الشاشات: شي رح يشوفوه الناس.'),
  },
  logic: {
    name: t('Logic', 'المنطق'),
    what: t('The rules behind the screens, like what happens when someone taps Save.', 'القواعد ورا الشاشات، مثل شو بيصير لما حدا يضغط حفظ.'),
    built: t('Logic room: the rules of your app.', 'غرفة المنطق: قواعد تطبيقك.'),
  },
  storage: {
    name: t('Storage', 'التخزين'),
    what: t("Where your app keeps data, so it's still there tomorrow.", 'وين بيحفظ تطبيقك البيانات، لتضل موجودة بكرا.'),
    built: t('Storage room: your app can remember things.', 'غرفة التخزين: صار تطبيقك يتذكّر.'),
  },
  toolbox: {
    name: t('Toolbox', 'العدّة'),
    what: t('Settings and the list of libraries your app uses.', 'الإعدادات وقائمة المكتبات اللي بيستخدمها تطبيقك.'),
    built: t('Toolbox: settings and helpers.', 'العدّة: إعدادات ومساعدين.'),
  },
  tests: {
    name: t('Tests', 'الفحوصات'),
    what: t('Small checks that make sure your app still works after changes.', 'فحوصات صغيرة بتتأكد إنو تطبيقك لسّا شغّال بعد كل تعديل.'),
    built: t('Tests room: your app checks itself.', 'غرفة الفحوصات: تطبيقك عم يفحص حالو.'),
  },
  secrets: {
    name: t('Secrets safe', 'خزنة الأسرار'),
    what: t('Passwords and keys your app needs. Never share them or upload them.', 'كلمات سر ومفاتيح بيحتاجها تطبيقك. لا تشاركها ولا ترفعها أبداً.'),
    built: t('Secrets safe: keep it locked.', 'خزنة الأسرار: خلّيها مقفولة.'),
  },
}

export const DOORS: Record<DoorId, { name: Txt; what: Txt }> = {
  google: { name: t('Google', 'Google'), what: t('People can sign in with Google.', 'الناس بيقدروا يدخلوا بحساب Google.') },
  stripe: { name: t('Stripe', 'Stripe'), what: t('Your app can take payments.', 'تطبيقك صار يقدر ياخد مدفوعات.') },
  openai: { name: t('OpenAI', 'OpenAI'), what: t('Your app can talk to an AI model.', 'تطبيقك صار يحكي مع ذكاء اصطناعي.') },
  claude: { name: t('Claude', 'Claude'), what: t('Your app can talk to Claude.', 'تطبيقك صار يحكي مع Claude.') },
  supabase: { name: t('Supabase', 'Supabase'), what: t('A database that lives online.', 'قاعدة بيانات عايشة على الإنترنت.') },
  firebase: { name: t('Firebase', 'Firebase'), what: t("Google's online database and login.", 'قاعدة بيانات وتسجيل دخول من Google على الإنترنت.') },
  email: { name: t('Email', 'إيميل'), what: t('Your app can send emails.', 'تطبيقك صار يبعت إيميلات.') },
  github: { name: t('GitHub', 'GitHub'), what: t('A copy of your code lives on GitHub.', 'نسخة من كودك عايشة على GitHub.') },
  live: { name: t('Live', 'أونلاين'), what: t('Your app is on the internet.', 'تطبيقك صار على الإنترنت.') },
}

export const CONCEPT_IDS: readonly ConceptId[] = [
  'terminal', 'library', 'framework', 'component', 'database', 'env', 'git',
  'commit', 'devserver', 'build', 'tests', 'api', 'deploy',
]

export const CONCEPTS: Record<ConceptId, { name: Txt; what: Txt }> = {
  terminal: { name: t('Terminal command', 'أمر بالتيرمنال'), what: t('A typed instruction to your computer. Claude runs these for you.', 'تعليمة مكتوبة لكمبيوترك. Claude بينفّذها عنك.') },
  library: { name: t('Library', 'مكتبة'), what: t('Code someone else wrote that your app plugs in, so nobody starts from zero.', 'كود كتبه غيرك وبيضيفه تطبيقك، لحتى ما حدا يبلّش من الصفر.') },
  framework: { name: t('Framework', 'إطار عمل'), what: t('A ready-made skeleton for a whole app, like a house kit.', 'هيكل جاهز لتطبيق كامل، متل بيت جاهز للتركيب.') },
  component: { name: t('Component', 'مكوّن'), what: t('A reusable piece of screen, like a button or a card.', 'قطعة من الشاشة بتنعاد، متل زر أو بطاقة.') },
  database: { name: t('Database', 'قاعدة بيانات'), what: t('Organized storage that remembers data between visits.', 'مخزن مرتّب بيتذكّر البيانات بين الزيارات.') },
  env: { name: t('.env file', 'ملف .env'), what: t('A private file for passwords and keys. It must never go online.', 'ملف خاص لكلمات السر والمفاتيح. ممنوع يطلع على الإنترنت.') },
  git: { name: t('Git', 'Git'), what: t('A time machine that saves every version of your project.', 'آلة زمن بتحفظ كل نسخة من مشروعك.') },
  commit: { name: t('Commit', 'كوميت'), what: t('A saved checkpoint you can always go back to.', 'نقطة حفظ فيك ترجعلها وقت ما بدك.') },
  devserver: { name: t('Dev server', 'سيرفر التطوير'), what: t('Runs your app on your own computer so you can try it before anyone else.', 'بيشغّل تطبيقك على جهازك لتجرّبه قبل أي حدا.') },
  build: { name: t('Build', 'البناء'), what: t('Packs your app into its final, fast version.', 'بيجمّع تطبيقك بنسخته النهائية والسريعة.') },
  tests: { name: t('Tests', 'الفحوصات'), what: t("Automatic checks that catch mistakes before your users do.", 'فحوصات تلقائية بتلقط الأغلاط قبل ما يلقطها المستخدمين.') },
  api: { name: t('API', 'API'), what: t('A door other programs knock on to ask your app for data.', 'باب بتدقّ عليه برامج تانية لتطلب بيانات من تطبيقك.') },
  deploy: { name: t('Deploy', 'النشر'), what: t('Putting your app on the internet so anyone can open it.', 'رفع تطبيقك على الإنترنت ليفتحه أي حدا.') },
}

export const UI = {
  title: t('Your app as a house', 'تطبيقك كأنو بيت'),
  emptyLot: t('Empty lot. Ask Claude to build something.', 'أرض فاضية. اطلب من Claude يبني شي.'),
  doors: t('Doors', 'الأبواب'),
  files: t('files', 'ملفات'),
  file: t('file', 'ملف'),
  rooms: t('Rooms', 'الغرف'),
  tapRoom: t('Tap a room to see what it does.', 'اضغط على غرفة لتعرف شو بتعمل.'),
  concepts: t('Concepts you met', 'مفاهيم تعرّفت عليها'),
  noConcepts: t('None yet. They unlock as Claude works.', 'لسّا ولا وحدة. بتنفتح وClaude عم يشتغل.'),
  locked: t('locked', 'مقفولة'),
  session: t('This session', 'هالجلسة'),
  steps: t('steps explained', 'خطوة انشرحت'),
  newRooms: t('rooms touched', 'غرف اتعدّلت'),
  newConcepts: t('new concepts', 'مفاهيم جديدة'),
  share: t('Share my house', 'شارك بيتي'),
  shared: t('Saved bayt-house-card.html in your project and opened it.', 'انحفظ bayt-house-card.html بمشروعك وانفتح.'),
  sharedNoOpen: t('Saved bayt-house-card.html in your project. Open it in a browser.', 'انحفظ bayt-house-card.html بمشروعك. افتحه بالمتصفح.'),
  newConcept: t('New concept', 'مفهوم جديد'),
  concept: t('Concept', 'مفهوم'),
  moreSteps: t('more steps in this command', 'خطوات كمان بهالأمر'),
  safe: t('Safe', 'آمن'),
  careful: t('Careful', 'انتبه'),
  danger: t('Danger', 'خطر'),
  langButton: t('عربي', 'English'),
  latest: t('Latest', 'آخر شي'),
  newDoor: t('New door', 'باب جديد'),
  inRoom: t('In this room', 'بهالغرفة'),
  opened: t('Bayt is open beside the chat.', 'بيت مفتوح جنب المحادثة.'),
  cardFooter: t('Built with Claude Code. Explained by Bayt.', 'انبنى بـ Claude Code. وشرحه بيت.'),
  cardDownload: t('Download PNG', 'نزّل الصورة'),
}
