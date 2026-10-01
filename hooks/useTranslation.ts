'use client';

import { useAppStore } from '@/lib/store';
import { translations, TranslationKey } from '@/lib/i18n';

// A dynamic translation registry for database items like LMS titles, categories, and descriptions.
export const curriculumTranslations: Record<string, { kh: string; zh: string }> = {
  // Categories
  'Poomsae Patterns': {
    kh: 'វិញ្ញាសាមេគុន (Poomsae)',
    zh: '品势特训 (Poomsae)'
  },
  'Kicking Basics': {
    kh: 'មូលដ្ឋានគ្រឹះនៃការទាត់ (Kicking)',
    zh: '腿法基本功 (Kicking)'
  },
  'Acrobatics': {
    kh: 'កាយសម្ព័ន្ធ (Acrobatics)',
    zh: '特技空翻 (Acrobatics)'
  },
  'Tricking': {
    kh: 'ក្បាច់ទាត់ពិសេស (Tricking)',
    zh: '极限特技 (Tricking)'
  },
  'All Categories': {
    kh: 'គ្រប់ប្រភេទ',
    zh: '全部教学类型'
  },
  'All': {
    kh: 'ទាំងអស់',
    zh: '全部'
  },
  'Kicks (Chagi)': {
    kh: 'ការទាត់ (Chagi)',
    zh: '腿法踢击 (Chagi)'
  },
  'Strikes (Jirugi)': {
    kh: 'ការវាយ (Jirugi)',
    zh: '拳法击打 (Jirugi)'
  },
  'Blocks (Makki)': {
    kh: 'ការរង (Makki)',
    zh: '防守格挡 (Makki)'
  },
  'Stances (Seogi)': {
    kh: 'ជំហរ (Seogi)',
    zh: '步法站姿 (Seogi)'
  },
  'Poomsae Flow': {
    kh: 'មេគុន (Poomsae)',
    zh: '品势套路 (Poomsae)'
  },
  'Tricking & Acrobatics': {
    kh: 'កាយសម្ព័ន្ធ & Tricking',
    zh: '特技与空翻'
  },
  // Grading Rubrics
  'Needs Work': {
    kh: 'ត្រូវការកែលម្អ',
    zh: '需要加强'
  },
  'Developing': {
    kh: 'កំពុងអភិវឌ្ឍ',
    zh: '尚可/在提高'
  },
  'Proficient': {
    kh: 'ស្ទាត់ជំនាញ',
    zh: '熟练/达标'
  },
  'Outstanding': {
    kh: 'ល្អឥតខ្ចោះ',
    zh: '优秀/卓越'
  },

  // Video Titles
  'Taegeuk 1 Jang': {
    kh: 'តេគុក ១ យ៉ាង (Taegeuk 1 Jang)',
    zh: '太极一章 (Taegeuk 1 Jang)'
  },
  'Taegeuk 1 (Il) Jang': {
    kh: 'តេគុក ១ យ៉ាង (Taegeuk 1 Jang)',
    zh: '太极一章 (Taegeuk 1 Jang)'
  },
  'Taegeuk 2 Jang': {
    kh: 'តេគុក ២ យ៉ាង (Taegeuk 2 Jang)',
    zh: '太极二章 (Taegeuk 2 Jang)'
  },
  'Taegeuk 2 (Ee) Jang': {
    kh: 'តេគុក ២ យ៉ាង (Taegeuk 2 Jang)',
    zh: '太极二章 (Taegeuk 2 Jang)'
  },
  'Taegeuk 3 Jang': {
    kh: 'តេគុក ៣ យ៉ាង (Taegeuk 3 Jang)',
    zh: '太极三章 (Taegeuk 3 Jang)'
  },
  'Taegeuk 3 (Sam) Jang': {
    kh: 'តេគុក ៣ យ៉ាង (Taegeuk 3 Jang)',
    zh: '太极三章 (Taegeuk 3 Jang)'
  },
  'Taegeuk 4 Jang': {
    kh: 'តេគុក ៤ យ៉ាង (Taegeuk 4 Jang)',
    zh: '太极四章 (Taegeuk 4 Jang)'
  },
  'Taegeuk 4 (Sa) Jang': {
    kh: 'តេគុក ៤ យ៉ាង (Taegeuk 4 Jang)',
    zh: '太极四章 (Taegeuk 4 Jang)'
  },
  'Taegeuk 5 Jang': {
    kh: 'តេគុក ៥ យ៉ាង (Taegeuk 5 Jang)',
    zh: '太极五章 (Taegeuk 5 Jang)'
  },
  'Taegeuk 5 (Oh) Jang': {
    kh: 'តេគុក ៥ យ៉ាង (Taegeuk 5 Jang)',
    zh: '太极五章 (Taegeuk 5 Jang)'
  },
  'Taegeuk 6 Jang': {
    kh: 'តេគុក ៦ យ៉ាង (Taegeuk 6 Jang)',
    zh: '太极六章 (Taegeuk 6 Jang)'
  },
  'Taegeuk 6 (Yuk) Jang': {
    kh: 'តេគុក ៦ យ៉ាង (Taegeuk 6 Jang)',
    zh: '太极六章 (Taegeuk 6 Jang)'
  },
  'Taegeuk 7 Jang': {
    kh: 'តេគុក ៧ យ៉ាង (Taegeuk 7 Jang)',
    zh: '太极七章 (Taegeuk 7 Jang)'
  },
  'Taegeuk 7 (Chil) Jang': {
    kh: 'តេគុក ៧ យ៉ាង (Taegeuk 7 Jang)',
    zh: '太极七章 (Taegeuk 7 Jang)'
  },
  'Taegeuk 8 Jang': {
    kh: 'តេគុក ៨ យ៉ាង (Taegeuk 8 Jang)',
    zh: '太极八章 (Taegeuk 8 Jang)'
  },
  'Taegeuk 8 (Pal) Jang': {
    kh: 'តេគុក ៨ យ៉ាង (Taegeuk 8 Jang)',
    zh: '太极八章 (Taegeuk 8 Jang)'
  },
  'Koryo': {
    kh: 'កូយ៉ូ (Koryo)',
    zh: '高丽品势 (Koryo)'
  },
  'Koryo Poomsae': {
    kh: 'កូយ៉ូ (Koryo)',
    zh: '高丽品势 (Koryo)'
  },
  'Front Kick Basics': {
    kh: 'មូលដ្ឋាននៃការទាត់ត្រង់ (Front Kick)',
    zh: '前踢基本功 (Front Kick)'
  },
  'Roundhouse Kick Basics': {
    kh: 'មូលដ្ឋាននៃការទាត់ឆៀង (Roundhouse Kick)',
    zh: '横踢基本功 (Roundhouse Kick)'
  },
  'Side Kick Basics': {
    kh: 'មូលដ្ឋាននៃការទាត់ចំហៀង (Side Kick)',
    zh: '侧踢基本功 (Side Kick)'
  },
  'Back Kick Basics': {
    kh: 'មូលដ្ឋាននៃការទាត់បកក្រោយ (Back Kick)',
    zh: '后踢基本功 (Back Kick)'
  },
  'Spinning Hook Kick': {
    kh: 'ការទាត់បកក្រោយកោង (Spinning Hook Kick)',
    zh: '后旋踢特训 (Spinning Hook Kick)'
  },
  'Butterfly Kick Tutorial': {
    kh: 'របៀបទាត់មេអំបៅ (Butterfly Kick)',
    zh: '蝴蝶步空翻教学 (Butterfly Kick)'
  },
  '540 Kick Progression': {
    kh: 'វគ្គហ្វឹកហ្វឺនទាត់ ៥៤០ អង្សារ (540 Kick)',
    zh: '540度旋风踢进阶 (540 Kick)'
  },
  '720 Kick Tutorial': {
    kh: 'របៀបទាត់ ៧២០ អង្សារ (720 Kick)',
    zh: '720度旋风踢特训 (720 Kick)'
  },
  'Cartwheel & Aerial': {
    kh: 'ក្បាច់បង្វិលខ្លួន និងផ្លោះអាកាស',
    zh: '侧空翻与空中转体'
  },
  'Backflip Basics': {
    kh: 'មូលដ្ឋានគ្រឹះនៃការហក់បកក្រោយ (Backflip)',
    zh: '后空翻基本功 (Backflip)'
  },

  // Video Descriptions (fuzzy or exact match fallbacks)
  'Master the first basic Taekwondo pattern. Required for Yellow Belt testing.': {
    kh: 'រៀនមេគុនដំបូងបង្អស់នៃកីឡាតេក្វាន់ដូ។ តម្រូវឱ្យមានសម្រាប់ការប្រឡងឡើងខ្សែក្រវាត់លឿង។',
    zh: '掌握跆拳道最基础的第一套品势。黄带晋级考核必修。'
  },
  'Master the second basic Taekwondo pattern. Required for Green Belt testing.': {
    kh: 'រៀនមេគុនមូលដ្ឋានទីពីរនៃកីឡាតេក្វាន់ដូ។ តម្រូវឱ្យមានសម្រាប់ការប្រឡងឡើងខ្សែក្រវាត់បៃតង។',
    zh: '掌握第二套基础跆拳道品势。绿带晋级考核必修。'
  },
  'Master the third basic Taekwondo pattern. Required for Blue Belt testing.': {
    kh: 'រៀនមេគុនមូលដ្ឋានទីបីនៃកីឡាតេក្វាន់ដូ។ តម្រូវឱ្យមានសម្រាប់ការប្រឡងឡើងខ្សែក្រវាត់ខៀវ។',
    zh: '掌握第三套基础跆拳道品势。蓝带晋级考核必修。'
  },
  'Step-by-step breakdown of the front kick (Ap Chagi) with key techniques.': {
    kh: 'ការបំបែកជំហាននៃការទាត់ត្រង់ (Ap Chagi) ជាមួយនឹងបច្ចេកទេសសំខាន់ៗ។',
    zh: '前踢 (Ap Chagi) 技术分解与动作要领详解。'
  },
  'Detailed instruction on generating hip power for the roundhouse kick.': {
    kh: 'ការណែនាំលម្អិតអំពីការបញ្ចេញកម្លាំងត្រគាកសម្រាប់ការទាត់ឆៀង។',
    zh: '横踢中如何利用腰胯发力的深度剖析教学。'
  },
  'Learn to execute a powerful and crisp side kick with perfect alignment.': {
    kh: 'រៀនទាត់ចំហៀងឱ្យមានកម្លាំងខ្លាំង និងច្បាស់លាស់ ជាមួយនឹងជំហរត្រឹមត្រូវល្អឥតខ្ចោះ។',
    zh: '学习如何以完美的身体对齐姿势踢出有力且干净利落的侧踢。'
  },
  'Advanced 540 spinning kick progression. Learn to jump, rotate, and land safely.': {
    kh: 'វគ្គហ្វឹកហ្វឺនកម្រិតខ្ពស់នៃការទាត់បង្វិល ៥៤០ អង្សារ។ រៀនលោត បង្វិលខ្លួន និងចុះចតដោយសុវត្ថិភាព។',
    zh: '高级540度旋风踢教学。包含起跳、空中旋转以及安全着陆技巧。'
  },
  'Learn the fundamentals of the martial arts tricking butterfly kick.': {
    kh: 'រៀនពីមូលដ្ឋានគ្រឹះនៃការទាត់មេអំបៅក្នុងក្បាច់ទាត់ពិសេស (Tricking)។',
    zh: '学习极限特技（Tricking）中蝴蝶步空翻的基础动作要领。'
  }
};

export type TranslatorFn = ((key: TranslationKey) => string) & {
  translateText: (text: string | undefined) => string;
};

export function useT(): TranslatorFn {
  const { state } = useAppStore();
  const lang = state.language || 'en';

  const translate = (key: TranslationKey): string => {
    const localeDict = translations[lang] || translations.en;
    return localeDict[key] || translations.en[key] || String(key);
  };

  const translateText = (text: string | undefined): string => {
    if (!text) return '';
    if (lang === 'en') return text;
    const entry = curriculumTranslations[text];
    if (entry) {
      return entry[lang === 'kh' ? 'kh' : 'zh'] || text;
    }
    return text;
  };

  return Object.assign(translate, { translateText });
}
export type TFunction = TranslatorFn;
