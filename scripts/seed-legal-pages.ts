/**
 * Seed legal pages — Terms of Service, Privacy Policy, Cancellation & Refunds, AI Usage Statement
 *
 * Idempotent — safe to run multiple times (upserts by slug).
 * Uses direct MongoDB access via getContentDb().
 *
 * Usage: pnpm tsx scripts/seed-legal-pages.ts
 */
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { getContentDb } from '@/server/repos/mongo'

// ─── Types ────────────────────────────────────────────────────────────────────

type LexicalTextNode = {
  type: 'text'
  text: string
  format?: number
  mode?: string
  style?: string
}

type LexicalParagraphNode = {
  type: 'paragraph'
  children: LexicalTextNode[]
  direction?: string
  format?: string
  indent?: number
  version?: number
}

type LexicalHeadingNode = {
  type: 'heading'
  tag: string
  children: LexicalTextNode[]
  direction?: string
  format?: string
  indent?: number
  version?: number
}

type LexicalRootNode = {
  root: {
    children: Array<LexicalParagraphNode | LexicalHeadingNode>
    type: 'root'
    direction: string
    format: string
    indent: number
    version: number
  }
}

// ─── Lexical JSON helpers ──────────────────────────────────────────────────────

function makeText(text: string): LexicalTextNode {
  return { type: 'text', text, format: 0 }
}

function makeParagraph(lines: string[], direction: string): LexicalParagraphNode {
  return {
    type: 'paragraph',
    children: lines.map(makeText),
    direction,
    format: '',
    indent: 0,
    version: 1,
  }
}

function makeHeading(tag: string, text: string, direction: string): LexicalHeadingNode {
  return {
    type: 'heading',
    tag,
    children: [makeText(text)],
    direction,
    format: '',
    indent: 0,
    version: 1,
  }
}

function makeRichText(
  sections: Array<{ heading?: string; paragraphs: string[] }>,
  direction: string,
): LexicalRootNode {
  const children: Array<LexicalParagraphNode | LexicalHeadingNode> = []
  for (const section of sections) {
    if (section.heading) {
      children.push(makeHeading('h2', section.heading, direction))
    }
    for (const para of section.paragraphs) {
      children.push(makeParagraph([para], direction))
    }
  }
  return {
    root: {
      children,
      type: 'root',
      direction,
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

// ─── Page definitions ─────────────────────────────────────────────────────────

const RTL = 'rtl'
const LTR = 'ltr'

const PAGES = [
  {
    slug: 'terms-of-service',
    titleHe: 'תנאי שימוש',
    titleEn: 'Terms of Service',
    metaTitleHe: 'תנאי שימוש | A-Guy',
    metaDescHe: 'תנאי השימוש בפלטפורמת A-Guy ללמידה מקוונת',
    metaTitleEn: 'Terms of Service | A-Guy',
    metaDescEn: 'Terms of service for the A-Guy online learning platform',
    contentHe: makeRichText(
      [
        {
          heading: 'הקדמה',
          paragraphs: [
            'A-Guy היא פלטפורמת למידה מקוונת המסופקת על ידי A-Guy ("החברה", "אנחנו", "שלנו"). השימוש בפלטפורמה כפוף לתנאים הבאים. השימוש בשירות מהווה הסכמה לתנאים אלה.',
          ],
        },
        {
          heading: 'הגדרות',
          paragraphs: [
            '"שירות" – הפלטפורמה וכל התכנים, השירותים והמוצרים המוצעים בה. "משתמש" – כל אדם שנרשם לשירות או עושה בו שימוש. "תוכן" – כל מידע, טקסט, גרפיקה, תמונות, וידאו או שמע המוצגים בשירות.',
          ],
        },
        {
          heading: 'חשבון משתמש',
          paragraphs: [
            'המשתמש מתחייב לספק מידע מדויק ומלא בעת ההרשמה. המשתמש אחראי לשמור על סיסמת הגישה לחשבונו. החברה שומרת לעצמה את הזכות להשעות או לסגור חשבון שמפר את התנאים.',
          ],
        },
        {
          heading: 'שימוש מותר בשירות',
          paragraphs: [
            'השירות מיועד לשימוש אישי וחינוכי בלבד. אסור להעתיק, להפיץ, לשנות או ליצור יצירות נגזרות מתוכן הפלטפורמה ללא אישור מפורש מהחברה. אסור להשתמש בשירות למטרות מסחריות בלתי חוקיות או לפגוע בזכויות צד שלישי.',
          ],
        },
        {
          heading: 'קניין רוחני',
          paragraphs: [
            'כל זכויות הקניין הרוחני בפלטפורמה, לרבות עיצוב, קוד, סימנים מסחריים ותוכן — שייכות לחברה או לספקי התוכן שלה. אין להעתיק או להשתמש בהן ללא הרשאה.',
          ],
        },
        {
          heading: 'רכישות ותשלומים',
          paragraphs: [
            'הרכישות בשירות כפופות למדיניות התשלומים המפורטת בדף הרכישה ובמדיניות הביטולים וההחזרים. החברה שומרת לעצמה את הזכות לשנות מחירים בכל עת.',
          ],
        },
        {
          heading: 'הגבלת אחריות',
          paragraphs: [
            'השירות ניתן "כפי שהוא" (AS IS). החברה אינה מתחייבת שהשירות יהיה זמין בכל עת ללא הפסקות. החברה אינה אחראית לנזקים עקיפים, מקריים או תוצאתיים הנובעים מהשימוש בשירות.',
          ],
        },
        {
          heading: 'שינויים בתנאים',
          paragraphs: [
            'החברה רשאית לשנות תנאים אלה מעת לעת. שינויים יפורסמו בדף זה. המשך השימוש בשירות לאחר פרסום השינויים מהווה הסכמה לתנאים המעודכנים.',
          ],
        },
        {
          heading: 'סיום השימוש',
          paragraphs: [
            'המשתמש רשאי להפסיק את השימוש בשירות בכל עת. החברה רשאית לסיים או להשעות גישה לשירות לפי שיקול דעתה הבלעדי, לרבות במקרה של הפרת תנאים אלה.',
          ],
        },
        {
          heading: 'סמכות שיפוט',
          paragraphs: [
            'תנאים אלה כפופים לדין הישראלי. סמכות השיפוט הייחודית בעניינים הנובעים מתנאים אלה תהא לבית המשפט המוסמך במחוז תל אביב.',
          ],
        },
      ],
      RTL,
    ),
  },
  {
    slug: 'privacy-policy',
    titleHe: 'מדיניות פרטיות',
    titleEn: 'Privacy Policy',
    metaTitleHe: 'מדיניות פרטיות | A-Guy',
    metaDescHe: 'מדיניות הפרטיות של פלטפורמת A-Guy — כיצד אנו אוספים ומגנים על המידע שלך',
    metaTitleEn: 'Privacy Policy | A-Guy',
    metaDescEn: 'Privacy policy for the A-Guy online learning platform',
    contentHe: makeRichText(
      [
        {
          heading: 'מבוא',
          paragraphs: [
            'A-Guy ("אנחנו", "החברה") מחויבת להגן על פרטיות המשתמשים שלה. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע האישי שלך בעת השימוש בפלטפורמת הלמידה שלנו.',
          ],
        },
        {
          heading: 'מידע שאנו אוספים',
          paragraphs: [
            'מידע אישי — שם, כתובת דואר אלקטרוני, וגיל/כיתה שנמסרים בעת ההרשמה. מידע על שימוש — נתוני למידה, התקדמות בשיעורים, תרגילים שנפתרו ושאלות שנשאלו. מידע טכני — כתובת IP, סוג דפדפן ומערכת הפעלה.',
          ],
        },
        {
          heading: 'כיצד אנו משתמשים במידע',
          paragraphs: [
            'לספק ולשפר את השירות — התאמה אישית של חוויית הלמידה, מעקב אחר התקדמות וזיהוי תחומים לשיפור. לתקשר עם המשתמש — שליחת עדכונים, הודעות טכניות ותמיכה. לשמור על אבטחה — ניטור ומניעה של שימוש לא מורשה בשירות.',
          ],
        },
        {
          heading: 'שיתוף מידע עם צדדים שלישיים',
          paragraphs: [
            'אנו לא מוכרים את המידע האישי שלך לצדדים שלישיים. מידע עשוי להימסר לספקי שירותים (כגון מעבדי תשלומים וספקי אחסון נתונים) לצורך הפעלת השירות בלבד, ובכפוף להתחייבויות סודיות.',
          ],
        },
        {
          heading: 'שימור נתונים',
          paragraphs: [
            'אנו שומרים את המידע האישי שלך כל עוד החשבון פעיל, ולתקופה נוספת כנדרש על פי חוק. מידע על שימוש נשמר באופן אנונימי לצורכי שיפור השירות.',
          ],
        },
        {
          heading: 'זכויותיך',
          paragraphs: [
            'המשתמש רשאי לבקש גישה למידע האישי שלו, לבקש תיקון או מחיקה של מידע. להסיר את הסכמתו לקבלת הודעות שיווקיות בכל עת. לפנות אלינו בכתובת הדואר האלקטרוני שלנו לכל שאלה בנושא פרטיות.',
          ],
        },
        {
          heading: 'אבטחת מידע',
          paragraphs: [
            'אנו נוקטים באמצעי אבטחה טכניים וארגוניים מתקדמים להגנה על המידע האישי שלך, לרבות הצפנה, בקרות גישה וניטור מערכת.',
          ],
        },
        {
          heading: 'קובצי Cookie',
          paragraphs: [
            'הפלטפורמה משתמשת בקובצי Cookie לצורך הפעלת השירות, שמירת העדפות ואיסוף נתוני שימוש אנונימיים. המשתמש יכול לנטרל קובצי Cookie בהגדרות הדפדפן, אך ייתכן שפעולה זו תשפיע על תפקוד השירות.',
          ],
        },
        {
          heading: 'שינויים במדיניות',
          paragraphs: [
            'אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. שינויים מהותיים יובאו לידיעתך באמצעות דואר אלקטרוני או הודעה בפלטפורמה. מומלץ לעיין במדיניות זו מעת לעת.',
          ],
        },
        {
          heading: 'יצירת קשר',
          paragraphs: [
            'לכל שאלה, בקשה או תלונה בנוגע למדיניות פרטיות זו, ניתן לפנות אלינו בכתובת הדואר האלקטרוני: support@aguy.co.il',
          ],
        },
      ],
      RTL,
    ),
  },
  {
    slug: 'cancellation-refund',
    titleHe: 'מדיניות ביטולים והחזרים',
    titleEn: 'Cancellation & Refunds',
    metaTitleHe: 'מדיניות ביטולים והחזרים | A-Guy',
    metaDescHe: 'מדיניות הביטולים וההחזרים של פלטפורמת A-Guy',
    metaTitleEn: 'Cancellation & Refunds | A-Guy',
    metaDescEn: 'Cancellation and refund policy for the A-Guy online learning platform',
    contentHe: makeRichText(
      [
        {
          heading: 'מדיניות ביטול עסקה',
          paragraphs: [
            'בהתאם לחוק הגנת הצרכן (תשמ"א-1981), המשתמש רשאי לבטל עסקה תוך 14 ימים מיום ביצוע הרכישה, ובלבד שטרם נעשה שימוש בשירות. ביטול יתבצע באמצעות פנייה בכתובת הדואר האלקטרוני: support@aguy.co.il תוך ציון פרטי העסקה.',
          ],
        },
        {
          heading: 'תנאים לקבלת החזר',
          paragraphs: [
            'ההחזר יינתן בכפוף לכל התנאים הבאים: הבקשה הוגשה תוך 14 ימים ממועד הרכישה. לא נעשה שימוש משמעותי בשירות (גישה לשיעורים, צפייה בתכנים או שימוש בתרגולים). הבקשה נשלחה בכתב לכתובת הדואר האלקטרוני של השירות.',
          ],
        },
        {
          heading: 'סכום ההחזר',
          paragraphs: [
            'ההחזר יינתן במלואו בגין עלות המנוי, למעט דמי טיפול בסך 5% מסכום העסקה או 100 שקלים (לפי הנמוך מביניהם), כנדרש על פי חוק. ההחזר יועבר באמצעות אותו אמצעי תשלום ששימש לביצוע העסקה, תוך 14 ימי עסקים מאישור הבקשה.',
          ],
        },
        {
          heading: 'מקרים בהם לא יינתן החזר',
          paragraphs: [
            'לא יינתן החזר כספי במקרים הבאים: לאחר תום 14 הימים מיום הרכישה. במידה ונעשה שימוש משמעותי בשירות (צפייה ביותר מ-5 שיעורים או תרגול ביותר מ-20 תרגילים). במידה וההצעה כללה תוכן או שירות שסופקו באופן מיידי והמשתמש הסכים לתנאים.',
          ],
        },
        {
          heading: 'ביטול מנוי חוזר',
          paragraphs: [
            'ניתן לבטל את המנוי החוזר (מנוי חודשי/שנתי) בכל עת לפני תחילת תקופת החיוב הבאה. הביטול ייכנס לתוקף בסיום תקופת המנוי הנוכחית ששולמה, ולא יינתן החזר בגין תקופה שכבר נוצלה.',
          ],
        },
        {
          heading: 'שינויים בתוכנית המנוי',
          paragraphs: [
            'החברה שומרת לעצמה את הזכות לשנות את תנאי המנוי, לרבות המחירים, בכפוף להודעה מראש של 30 ימים. במקרה של העלאת מחיר מהותית, יוצע למשתמש האפשרות לבטל את המנוי ללא קנס.',
          ],
        },
        {
          heading: 'צור קשר בנושא החזרים',
          paragraphs: [
            'לבקשות החזר או ביטול, אנא פנו אלינו בכתובת: support@aguy.co.il עם פרטי העסקה המלאים (מספר עסקה, תאריך, סכום ואמצעי תשלום). נחזור אליך תוך 3 ימי עסקים.',
          ],
        },
      ],
      RTL,
    ),
  },
  {
    slug: 'ai-usage-statement',
    titleHe: 'הצהרת שימוש בבינה מלאכותית',
    titleEn: 'AI Usage Statement',
    metaTitleHe: 'הצהרת שימוש בבינה מלאכותית | A-Guy',
    metaDescHe: 'הצהרת השימוש בבינה מלאכותית של פלטפורמת A-Guy',
    metaTitleEn: 'AI Usage Statement | A-Guy',
    metaDescEn: 'AI usage statement for the A-Guy online learning platform',
    contentHe: makeRichText(
      [
        {
          heading: 'מבוא',
          paragraphs: [
            'פלטפורמת A-Guy משלבת טכנולוגיות בינה מלאכותית (AI) כחלק מהותי מחוויית הלמידה. הצהרה זו נועדה להסביר בשקיפות מלאה כיצד אנו משתמשים ב-AI, מהם המגבלות שלה, וכיצד אנו מגנים על פרטיותך.',
          ],
        },
        {
          heading: 'מהו המורה הדיגיטלי (AI Tutor)?',
          paragraphs: [
            'המורה הדיגיטלי הוא ממשק שיחה מבוסס AI המשולב ישירות בתהליך הלמידה. הוא מספק הסברים, רמזים והכוונה בזמן אמת, בהתאם להקשר התרגיל או השיעור הנוכחי. המורה הדיגיטלי מכיר את מלוא ההקשר הלימודי — השיעור, הפרק, הקורס והתקדמות המשתמש.',
          ],
        },
        {
          heading: 'מגבלות המורה הדיגיטלי',
          paragraphs: [
            'המורה הדיגיטלי הוא כלי עזר לימודי ואינו מהווה תחליף למורה אנושי מוסמך. ייתכנו מקרים שבהם ההסברים אינם מדויקים, אינם שלמים או אינם מתאימים להקשר הספציפי של המשתמש. המשתמש מתבקש לגלות שיקול דעת ולא לסמוך על תשובות המערכת באופן עיוור — במיוחד בנושאים קריטיים או מורכבים.',
          ],
        },
        {
          heading: 'כיצד אנו משתמשים בשיחות עם ה-AI?',
          paragraphs: [
            'כל השיחות עם המורה הדיגיטלי נשמרות לצורך: שיפור ההקשר הלימודי — המערכת לומדת את הידע ואת הפערים של המשתמש כדי להתאים את התוכן ואת רמת הקושי. שיפור מודלים — ניתוח אנונימי של דפוסי שימוש לצורך שיפור המודלים. מעקב התקדמות — זיהוי נושאים שבהם המשתמש נתקע או זקוק לחיזוק נוסף.',
          ],
        },
        {
          heading: 'פרטיות ו-AI',
          paragraphs: [
            'המידע מהשיחות משמש אך ורק לצורכי השירות ואינו נמכר או מועבר לצדדים שלישיים למטרות שיווק. פרטים נוספים זמינים במדיניות הפרטיות שלנו. חלק מהשיחות עשויות להישלח לספקי AI חיצוניים (כגון OpenAI או Google Gemini) לצורך עיבוד — בכפוף להסכמי סודיות ותנאי שימוש מחמירים.',
          ],
        },
        {
          heading: 'אחריות על תוכן AI',
          paragraphs: [
            'החברה עושה מאמצים סבירים להבטיח שהתוכן המופק על ידי ה-AI הוא מדויק ומועיל. עם זאת, החברה אינה יכולה להתחייב לשלמות המידע. המשתמש נושא באחריות הסופית לבדיקת התשובות ולפנייה לתמיכה במידת הצורך.',
          ],
        },
        {
          heading: 'הסכמה',
          paragraphs: [
            "השימוש במורה הדיגיטלי מהווה הסכמה לתנאים המפורטים בהצהרה זו. אם אינך מסכים, תוכל להשבית את הצ'אט או לפנות אלינו לביטול השימוש ב-AI בחשבונך.",
          ],
        },
      ],
      RTL,
    ),
  },
]

// ─── Footer navItems ───────────────────────────────────────────────────────────

const FOOTER_NAV_ITEMS = {
  he: [
    { title: 'תנאי שימוש', link: { type: 'custom', url: '/terms-of-service' }, order: 90 },
    { title: 'מדיניות פרטיות', link: { type: 'custom', url: '/privacy-policy' }, order: 91 },
    { title: 'ביטולים והחזרים', link: { type: 'custom', url: '/cancellation-refund' }, order: 92 },
    {
      title: 'שימוש בבינה מלאכותית',
      link: { type: 'custom', url: '/ai-usage-statement' },
      order: 93,
    },
  ],
  en: [
    { title: 'Terms of Service', link: { type: 'custom', url: '/terms-of-service' }, order: 90 },
    { title: 'Privacy Policy', link: { type: 'custom', url: '/privacy-policy' }, order: 91 },
    {
      title: 'Cancellation & Refunds',
      link: { type: 'custom', url: '/cancellation-refund' },
      order: 92,
    },
    {
      title: 'AI Usage Statement',
      link: { type: 'custom', url: '/ai-usage-statement' },
      order: 93,
    },
  ],
}

// ─── i18n updates ─────────────────────────────────────────────────────────────

const I18N_LEGAL_KEYS = {
  he: {
    termsOfService: 'תנאי שימוש',
    privacyPolicy: 'מדיניות פרטיות',
    cancellationRefund: 'ביטולים והחזרים',
    aiUsageStatement: 'שימוש בבינה מלאכותית',
  },
  en: {
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    cancellationRefund: 'Cancellation & Refunds',
    aiUsageStatement: 'AI Usage Statement',
  },
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function upsertPage(db: Awaited<ReturnType<typeof getContentDb>>, page: (typeof PAGES)[0]) {
  const doc = {
    slug: page.slug,
    title: page.titleHe,
    _status: 'published',
    isActive: true,
    hero: {
      type: 'lowImpact',
      richText: page.contentHe,
    },
    meta: {
      title: page.metaTitleHe,
      description: page.metaDescHe,
    },
    updatedAt: new Date().toISOString(),
  }

  await db.collection('pages').updateOne({ slug: page.slug }, { $set: doc }, { upsert: true })
  console.log(`  ✓ Creating/updating page: ${page.slug}`)
}

async function upsertFooterNavItems(
  db: Awaited<ReturnType<typeof getContentDb>>,
  locale: 'he' | 'en',
  items: (typeof FOOTER_NAV_ITEMS)[typeof locale],
) {
  // Payload 3.x stores all globals in a single `globals` collection,
  // discriminated by `globalType` — matches the reader in
  // src/infra/utils/footer-data.ts.
  const footer = await db.collection('globals').findOne({ globalType: 'footer' })

  const existingVariants = footer?.variants ?? []
  const existingLocaleVariant = existingVariants.find(
    (v: { locale?: string }) => v.locale === locale,
  )
  const existingNavItems: Array<{ link?: { url?: string } }> = existingLocaleVariant?.navItems ?? []

  const existingUrls = new Set(existingNavItems.map((n) => n.link?.url).filter(Boolean))
  const newItems = items.filter((n) => !existingUrls.has(n.link.url))

  const mergedNavItems = [...existingNavItems, ...newItems].sort((a, b) => {
    const orderA = (a as { order?: number }).order ?? 0
    const orderB = (b as { order?: number }).order ?? 0
    return orderA - orderB
  })

  const updatedVariants = existingVariants.map((v: { locale?: string }) =>
    v.locale === locale ? { ...v, navItems: mergedNavItems } : v,
  )

  if (!updatedVariants.find((v: { locale?: string }) => v.locale === locale)) {
    updatedVariants.push({ locale, navItems: mergedNavItems })
  }

  await db.collection('globals').updateOne(
    { globalType: 'footer' },
    {
      $set: {
        globalType: 'footer',
        variants: updatedVariants,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  )

  console.log(`  ✓ Updated footer navItems for locale: ${locale} (+${newItems.length} new items)`)
}

async function updateI18nFile(
  filePath: string,
  locale: 'he' | 'en',
  keys: (typeof I18N_LEGAL_KEYS)[typeof locale],
) {
  const content = await readFile(filePath, 'utf-8')
  const data = JSON.parse(content)

  data.legal = {
    ...(data.legal ?? {}),
    ...keys,
  }

  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log(`  ✓ Updated i18n file: ${filePath}`)
}

async function main() {
  const db = await getContentDb()

  console.log('\n--- Creating/Updating Legal Pages ---')
  for (const page of PAGES) {
    await upsertPage(db, page)
  }

  console.log('\n--- Updating Footer NavItems ---')
  await upsertFooterNavItems(db, 'he', FOOTER_NAV_ITEMS.he)
  await upsertFooterNavItems(db, 'en', FOOTER_NAV_ITEMS.en)

  console.log('\n--- Updating i18n Files ---')
  const i18nDir = join(process.cwd(), 'src', 'i18n')
  await updateI18nFile(join(i18nDir, 'he.json'), 'he', I18N_LEGAL_KEYS.he)
  await updateI18nFile(join(i18nDir, 'en.json'), 'en', I18N_LEGAL_KEYS.en)

  console.log('\nDone!\n')
}

main().catch((err) => {
  console.error('Failed to seed legal pages:', err)
  process.exit(1)
})
