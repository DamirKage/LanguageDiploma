import { choice, choiceRu, dialogue, fill, listen, match, order, speak, translate, translateBack, type LanguageSpec } from '../builders';

export const german: LanguageSpec = {
  code: 'de',
  name: 'Немецкий',
  nativeName: 'Deutsch',
  ttsLocale: 'de-DE',
  specialChars: ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'],
  order: 4,
  courses: [
    {
      level: 'A1',
      title: 'Немецкий A1: первые шаги',
      description: 'Знакомство, числа, семья и повседневные ситуации. Глагол sein, артикли и порядок слов в простом предложении.',
      modules: [
        {
          title: 'Знакомство',
          description: 'Приветствия, глагол sein и числа.',
          lessons: [
            {
              key: 'de-a1-greetings',
              title: 'Привет и знакомство',
              objective: 'Поздороваться, представиться и попрощаться в неформальной и вежливой ситуации.',
              topic: 'greetings',
              minutes: 8,
              theory: [
                {
                  title: 'du или Sie',
                  body: 'В немецком, как и в русском, есть «ты» и «Вы». du — для друзей, семьи и детей; Sie (всегда с заглавной буквы) — для незнакомых взрослых, коллег и в официальной обстановке. Если сомневаетесь, используйте Sie.',
                  examples: [
                    ['Wie heißt du?', 'Как тебя зовут?'],
                    ['Wie heißen Sie?', 'Как Вас зовут?'],
                  ],
                },
                {
                  title: 'Приветствие зависит от времени суток',
                  body: 'Guten Morgen — до полудня, Guten Tag — днём, Guten Abend — вечером. Hallo подходит в любое время в неформальной обстановке. Gute Nacht говорят только перед сном.',
                },
              ],
              words: [
                ['Hallo', 'привет', 'interjection', 'Hallo, ich bin Anna.', 'Привет, я Анна.'],
                ['Guten Tag', 'добрый день', 'phrase', 'Guten Tag, Frau Schmidt!', 'Добрый день, госпожа Шмидт!'],
                ['Guten Morgen', 'доброе утро', 'phrase', 'Guten Morgen! Wie geht es Ihnen?', 'Доброе утро! Как у Вас дела?'],
                ['Tschüss', 'пока', 'interjection', 'Tschüss, bis morgen!', 'Пока, до завтра!'],
                ['Auf Wiedersehen', 'до свидания', 'phrase', 'Auf Wiedersehen, Herr Weber.', 'До свидания, господин Вебер.'],
                ['danke', 'спасибо', 'interjection', 'Mir geht es gut, danke.', 'У меня всё хорошо, спасибо.'],
                ['heißen', 'называться, зваться', 'verb', 'Ich heiße Daniyar.', 'Меня зовут Данияр.'],
              ],
              exercises: [
                choice('Как вежливо поздороваться с коллегой днём?', ['Guten Tag!', 'Gute Nacht!', 'Tschüss!'], 0, 'Guten Tag — нейтральное дневное приветствие. Gute Nacht говорят перед сном, Tschüss — «пока».'),
                match(
                  [
                    ['Guten Morgen', 'доброе утро'],
                    ['Guten Abend', 'добрый вечер'],
                    ['Tschüss', 'пока'],
                    ['danke', 'спасибо'],
                  ],
                  'Приветствия меняются в течение дня: Morgen — утро, Tag — день, Abend — вечер.',
                ),
                fill('Ich ___ Daniyar.', ['heiße'], 'С местоимением ich глагол heißen получает окончание -e: ich heiße.', { s: 'grammar', t: 'present_tense' }, {
                  translation: 'Меня зовут Данияр.',
                  options: ['heiße', 'heißt', 'heißen'],
                }),
                dialogue(
                  [
                    ['A', 'Guten Tag! Wie heißen Sie?', 'Добрый день! Как Вас зовут?'],
                    ['B', null],
                    ['A', 'Freut mich!', 'Очень приятно!'],
                  ],
                  ['Ich heiße Aigerim Nurlanova.', 'Tschüss, Aigerim!', 'Ich bin müde.'],
                  0,
                  'На вопрос «Wie heißen Sie?» отвечают «Ich heiße …» — «Меня зовут …».',
                ),
                choice('Вы обращаетесь к незнакомому пожилому человеку. Как спросить его имя?', ['Wie heißen Sie?', 'Wie heißt du?', 'Wer bist du?'], 0, 'С незнакомыми взрослыми используют вежливое Sie и форму глагола heißen.', { t: 'pronouns', s: 'grammar', d: 2 }),
                listen('Guten Abend!', 'Abend — «вечер». Ударение на первый слог: А́-бент.', {}, { options: ['Guten Abend!', 'Guten Morgen!', 'Gute Nacht!'], translation: 'Добрый вечер!' }),
                translate('Привет, меня зовут Анна.', ['Hallo, ich heiße Anna.', 'Hallo, ich bin Anna.'], 'Представиться можно двумя способами: ich heiße … или ich bin …'),
                speak('Guten Tag!', 'Добрый день!', 'Звук «g» в Guten твёрдый, как в слове «губы». В Tag звонкая «g» на конце звучит глухо: [та:к].'),
              ],
            },
            {
              key: 'de-a1-sein',
              title: 'Кто я и откуда',
              objective: 'Рассказать о себе с глаголом sein: имя, профессия, город и страна.',
              topic: 'to_be',
              minutes: 10,
              theory: [
                {
                  title: 'Глагол sein — «быть»',
                  body: 'В русском языке «быть» в настоящем времени обычно опускают: «Я студент». В немецком глагол обязателен: Ich bin Student. Формы неправильные, их стоит выучить: ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie/Sie sind.',
                  examples: [
                    ['Ich bin Lehrerin.', 'Я учительница.'],
                    ['Wir sind aus Almaty.', 'Мы из Алматы.'],
                  ],
                },
                {
                  title: 'Откуда вы?',
                  body: 'Происхождение выражают через kommen aus или sein aus: Ich komme aus Kasachstan. Профессию называют без артикля: Er ist Arzt.',
                },
              ],
              words: [
                ['sein', 'быть', 'verb', 'Ich bin müde.', 'Я устал.'],
                ['kommen', 'приходить; происходить', 'verb', 'Ich komme aus Kasachstan.', 'Я из Казахстана.'],
                ['der Student', 'студент', 'noun', 'Er ist Student.', 'Он студент.', 'm'],
                ['die Lehrerin', 'учительница', 'noun', 'Meine Mutter ist Lehrerin.', 'Моя мама — учительница.', 'f'],
                ['die Stadt', 'город', 'noun', 'Almaty ist eine große Stadt.', 'Алматы — большой город.', 'f'],
                ['das Land', 'страна', 'noun', 'Deutschland ist ein Land in Europa.', 'Германия — страна в Европе.', 'n'],
                ['wohnen', 'жить, проживать', 'verb', 'Wir wohnen in Astana.', 'Мы живём в Астане.'],
              ],
              exercises: [
                fill('Ich ___ Student.', ['bin'], 'С ich глагол sein имеет форму bin.', {}, { translation: 'Я студент.', options: ['bin', 'bist', 'ist', 'sind'] }),
                fill('Du ___ aus Almaty.', ['bist'], 'С du — bist: du bist.', {}, { translation: 'Ты из Алматы.', options: ['bin', 'bist', 'ist', 'seid'] }),
                fill('Wir ___ in Astana.', ['sind', 'wohnen'], 'С wir: wir sind (мы находимся) или wir wohnen (мы живём).', { d: 2 }, { translation: 'Мы (живём) в Астане.' }),
                match(
                  [
                    ['ich', 'bin'],
                    ['er', 'ist'],
                    ['ihr', 'seid'],
                    ['sie (они)', 'sind'],
                  ],
                  'Формы sein неправильные: bin, bist, ist, sind, seid, sind.',
                  { s: 'grammar' },
                ),
                order(['Ich', 'komme', 'aus', 'Kasachstan'], 'Я из Казахстана.', 'В утвердительном предложении глагол стоит на втором месте.'),
                choice('Как правильно сказать «Она врач»?', ['Sie ist Ärztin.', 'Sie ist eine die Ärztin.', 'Sie Ärztin.'], 0, 'Профессию называют без артикля, а глагол sein обязателен.', { s: 'grammar', d: 2 }),
                translateBack('Wir wohnen in Berlin.', ['Мы живём в Берлине', 'Мы живем в Берлине'], 'wohnen — «жить, проживать», in Berlin — «в Берлине».'),
                listen('Ich komme aus Kasachstan.', 'Kasachstan произносится с ударением на последний слог: ка-зах-ста́н.', {}, { translation: 'Я из Казахстана.' }),
                speak('Ich bin Student.', 'Я студент.', 'В начале слова «st» произносится как «шт»: [ш-тудент].'),
              ],
            },
            {
              key: 'de-a1-numbers',
              title: 'Числа и возраст',
              objective: 'Называть числа до 100, говорить о возрасте и диктовать номер телефона.',
              topic: 'numbers',
              minutes: 9,
              theory: [
                {
                  title: 'Единицы перед десятками',
                  body: 'Числа от 21 до 99 немцы читают «наоборот»: сначала единицы, потом десятки, через und. 21 — einundzwanzig («один-и-двадцать»), 47 — siebenundvierzig.',
                  examples: [
                    ['einundzwanzig', '21'],
                    ['fünfunddreißig', '35'],
                  ],
                },
                {
                  title: 'Сколько тебе лет?',
                  body: 'Возраст выражают глаголом sein: Ich bin 25 Jahre alt. Вопрос: Wie alt bist du? / Wie alt sind Sie?',
                },
              ],
              words: [
                ['eins', 'один', 'numeral', 'Ich habe eins.', 'У меня один.'],
                ['zwölf', 'двенадцать', 'numeral', 'Es ist zwölf Uhr.', 'Сейчас двенадцать часов.'],
                ['zwanzig', 'двадцать', 'numeral', 'Sie ist zwanzig.', 'Ей двадцать.'],
                ['alt', 'старый; в возрасте', 'adjective', 'Wie alt bist du?', 'Сколько тебе лет?'],
                ['das Jahr', 'год', 'noun', 'Ich bin 19 Jahre alt.', 'Мне 19 лет.', 'n'],
                ['die Nummer', 'номер', 'noun', 'Wie ist deine Nummer?', 'Какой у тебя номер?', 'f'],
              ],
              exercises: [
                match(
                  [
                    ['drei', '3'],
                    ['sieben', '7'],
                    ['zwölf', '12'],
                    ['dreißig', '30'],
                  ],
                  'Обратите внимание: dreißig пишется через ß, а не через z, как zwanzig.',
                ),
                choice('Как будет 25?', ['fünfundzwanzig', 'zwanzigfünf', 'fünfzwanzig'], 0, 'Сначала единицы, потом десятки, между ними und: fünf-und-zwanzig.', { s: 'grammar', d: 2 }),
                fill('Ich bin 30 Jahre ___.', ['alt'], 'Возраст: Ich bin … Jahre alt.', { s: 'grammar' }, { translation: 'Мне 30 лет.' }),
                listen('siebenundvierzig', 'Слушайте конец слова: vierzig — сорок, значит, 47.', {}, { options: ['47', '74', '27'], answers: ['47'] }),
                translate('Сколько тебе лет?', ['Wie alt bist du?'], 'Дословно «Как стар ты?». С вежливым Sie: Wie alt sind Sie?', { s: 'grammar', t: 'questions' }),
                dialogue(
                  [
                    ['A', 'Wie alt sind Sie?', 'Сколько Вам лет?'],
                    ['B', null],
                  ],
                  ['Ich bin zweiundvierzig Jahre alt.', 'Ich habe zweiundvierzig.', 'Es ist zweiundvierzig Uhr.'],
                  0,
                  'Возраст выражается через sein: ich bin … Jahre alt.',
                ),
                choiceRu('Что означает это число?', 'dreiundsechzig', ['63', '36', '33'], 0, 'drei (3) + und + sechzig (60) = 63.', { d: 2 }),
                speak('Ich bin zwanzig Jahre alt.', 'Мне двадцать лет.', 'z в начале слова звучит как «ц»: [ц-ванцих].'),
              ],
            },
          ],
        },
        {
          title: 'Мой мир',
          description: 'Семья, еда и первые бытовые ситуации.',
          lessons: [
            {
              key: 'de-a1-family',
              title: 'Моя семья',
              objective: 'Рассказать о членах семьи с притяжательными местоимениями mein / meine.',
              topic: 'family',
              minutes: 10,
              theory: [
                {
                  title: 'mein или meine',
                  body: 'Притяжательное местоимение согласуется с родом существительного: mein Vater (м. р.), meine Mutter (ж. р.), mein Kind (ср. р.), meine Eltern (мн. ч.). Это похоже на русское «мой / моя», но род слова в немецком может не совпадать с русским: das Mädchen («девочка») — средний род.',
                  examples: [
                    ['Das ist mein Bruder.', 'Это мой брат.'],
                    ['Das ist meine Schwester.', 'Это моя сестра.'],
                  ],
                },
              ],
              words: [
                ['die Familie', 'семья', 'noun', 'Meine Familie ist groß.', 'Моя семья большая.', 'f'],
                ['die Mutter', 'мать', 'noun', 'Meine Mutter heißt Gulnara.', 'Мою маму зовут Гульнара.', 'f'],
                ['der Vater', 'отец', 'noun', 'Mein Vater ist Ingenieur.', 'Мой отец — инженер.', 'm'],
                ['der Bruder', 'брат', 'noun', 'Ich habe einen Bruder.', 'У меня есть брат.', 'm'],
                ['die Schwester', 'сестра', 'noun', 'Meine Schwester wohnt in Köln.', 'Моя сестра живёт в Кёльне.', 'f'],
                ['die Eltern', 'родители', 'noun', 'Meine Eltern sind Ärzte.', 'Мои родители — врачи.'],
                ['das Kind', 'ребёнок', 'noun', 'Sie haben zwei Kinder.', 'У них двое детей.', 'n'],
              ],
              exercises: [
                match(
                  [
                    ['die Mutter', 'мать'],
                    ['der Vater', 'отец'],
                    ['der Bruder', 'брат'],
                    ['die Schwester', 'сестра'],
                  ],
                  'Учите слова сразу с артиклем: der — мужской, die — женский, das — средний род.',
                ),
                fill('Das ist ___ Mutter.', ['meine'], 'Mutter — женского рода (die), поэтому meine.', { s: 'grammar', t: 'possessive' }, { options: ['mein', 'meine'] }),
                fill('Das ist ___ Vater.', ['mein'], 'Vater — мужского рода (der), поэтому mein.', { s: 'grammar', t: 'possessive' }, { options: ['mein', 'meine'] }),
                fill('Das sind ___ Eltern.', ['meine'], 'Во множественном числе — meine, независимо от рода.', { s: 'grammar', t: 'possessive', d: 2 }, { options: ['mein', 'meine', 'meinen'] }),
                choice('Какой артикль у слова Kind?', ['das', 'der', 'die'], 0, 'Kind — среднего рода: das Kind, мн. ч. die Kinder.', { s: 'grammar', t: 'articles', d: 2 }),
                translate('У меня есть сестра.', ['Ich habe eine Schwester.'], 'haben + винительный падеж: eine Schwester (жен. р. не меняется).', { s: 'grammar', d: 2 }),
                translateBack('Meine Eltern wohnen in Almaty.', ['Мои родители живут в Алматы'], 'Eltern — «родители», всегда во множественном числе.'),
                order(['Mein', 'Bruder', 'ist', 'zwanzig', 'Jahre', 'alt'], 'Моему брату двадцать лет.', 'Глагол ist стоит на втором месте после подлежащего «Mein Bruder».'),
                speak('Das ist meine Familie.', 'Это моя семья.', 'В Familie ударение на второй слог: фа-ми́-ли-е.'),
              ],
            },
            {
              key: 'de-a1-cafe',
              title: 'В кафе',
              objective: 'Заказать еду и напитки, попросить счёт и уточнить цену.',
              topic: 'food',
              minutes: 11,
              theory: [
                {
                  title: 'Вежливая просьба',
                  body: 'В кафе удобно говорить Ich hätte gern … или Ich möchte … («я бы хотел …»). Это вежливее, чем Ich will …, которое звучит как требование.',
                  examples: [
                    ['Ich hätte gern einen Tee.', 'Я бы хотел чай.'],
                    ['Die Rechnung, bitte.', 'Счёт, пожалуйста.'],
                  ],
                },
                {
                  title: 'Винительный падеж: einen',
                  body: 'После möchte, hätte gern и haben существительное стоит в винительном падеже (Akkusativ). Меняется только мужской род: ein Kaffee → einen Kaffee. Женский и средний род не меняются: eine Suppe, ein Wasser.',
                },
              ],
              words: [
                ['der Kaffee', 'кофе', 'noun', 'Einen Kaffee, bitte.', 'Кофе, пожалуйста.', 'm'],
                ['der Tee', 'чай', 'noun', 'Ich trinke gern Tee.', 'Я люблю пить чай.', 'm'],
                ['das Wasser', 'вода', 'noun', 'Ein Wasser ohne Kohlensäure, bitte.', 'Воду без газа, пожалуйста.', 'n'],
                ['die Suppe', 'суп', 'noun', 'Die Suppe ist heiß.', 'Суп горячий.', 'f'],
                ['die Rechnung', 'счёт', 'noun', 'Die Rechnung, bitte!', 'Счёт, пожалуйста!', 'f'],
                ['bitte', 'пожалуйста', 'adverb', 'Ein Brot, bitte.', 'Хлеб, пожалуйста.'],
                ['kosten', 'стоить', 'verb', 'Was kostet der Kuchen?', 'Сколько стоит пирог?'],
              ],
              exercises: [
                fill('Ich hätte gern ___ Kaffee.', ['einen'], 'Kaffee — мужского рода, в винительном падеже ein → einen.', { s: 'grammar', t: 'cases', d: 2 }, { options: ['ein', 'einen', 'eine'] }),
                fill('Ich möchte ___ Suppe.', ['eine'], 'Suppe — женского рода; в винительном падеже eine не меняется.', { s: 'grammar', t: 'cases', d: 2 }, { options: ['ein', 'einen', 'eine'] }),
                choice('Как попросить счёт?', ['Die Rechnung, bitte.', 'Die Karte, danke.', 'Ich bin die Rechnung.'], 0, 'Rechnung — «счёт». Speisekarte или Karte — «меню».'),
                dialogue(
                  [
                    ['A', 'Was möchten Sie trinken?', 'Что Вы будете пить?'],
                    ['B', null],
                    ['A', 'Gern. Sonst noch etwas?', 'Хорошо. Что-нибудь ещё?'],
                  ],
                  ['Einen Tee, bitte.', 'Ich heiße Tee.', 'Tschüss!'],
                  0,
                  'Официант спрашивает о напитке — отвечаем названием напитка и bitte.',
                  {},
                  'Вы в кафе в Берлине.',
                ),
                translate('Сколько стоит кофе?', ['Was kostet der Kaffee?', 'Wie viel kostet der Kaffee?'], 'Вопрос о цене: Was kostet …? или Wie viel kostet …?', { t: 'questions', s: 'grammar' }),
                match(
                  [
                    ['das Wasser', 'вода'],
                    ['die Suppe', 'суп'],
                    ['der Tee', 'чай'],
                    ['das Brot', 'хлеб'],
                  ],
                  'Слова о еде лучше учить вместе с артиклем — он понадобится при заказе.',
                ),
                listen('Die Rechnung, bitte.', 'Rechnung: ch после e звучит мягко, как «хь».', {}, { translation: 'Счёт, пожалуйста.' }),
                order(['Ich', 'möchte', 'ein', 'Wasser'], 'Я бы хотел воды.', 'Порядок: подлежащее — глагол — дополнение.', {}, { distractors: ['einen'] }),
                speak('Einen Kaffee, bitte.', 'Кофе, пожалуйста.', 'В Kaffee ударение на первый слог в немецком варианте: ка́-фе.'),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'A2',
      title: 'Немецкий A2: события и поездки',
      description: 'Прошедшее время Perfekt, модальные глаголы и ориентирование в городе.',
      modules: [
        {
          title: 'Истории и поездки',
          description: 'Рассказ о прошлом и путешествия.',
          lessons: [
            {
              key: 'de-a2-perfekt',
              title: 'Что было вчера',
              objective: 'Рассказать о вчерашнем дне в прошедшем времени Perfekt.',
              topic: 'past_events',
              minutes: 12,
              theory: [
                {
                  title: 'Perfekt = haben/sein + Partizip II',
                  body: 'В разговорной речи о прошлом говорят в Perfekt. Вспомогательный глагол стоит на втором месте, причастие — в конце предложения: Ich habe gestern Pizza gegessen. Это «рамка», которой нет в русском.',
                  examples: [
                    ['Ich habe ein Buch gelesen.', 'Я прочитал книгу.'],
                    ['Wir sind nach Berlin gefahren.', 'Мы поехали в Берлин.'],
                  ],
                },
                {
                  title: 'haben или sein',
                  body: 'С sein образуют Perfekt глаголы движения и изменения состояния: fahren, gehen, kommen, fliegen. Большинство остальных глаголов — с haben.',
                },
              ],
              words: [
                ['gestern', 'вчера', 'adverb', 'Gestern war ich im Kino.', 'Вчера я был в кино.'],
                ['essen', 'есть, кушать', 'verb', 'Ich habe Pizza gegessen.', 'Я ел пиццу.'],
                ['lesen', 'читать', 'verb', 'Sie hat ein Buch gelesen.', 'Она прочитала книгу.'],
                ['fahren', 'ехать', 'verb', 'Wir sind nach Hause gefahren.', 'Мы поехали домой.'],
                ['arbeiten', 'работать', 'verb', 'Er hat lange gearbeitet.', 'Он долго работал.'],
                ['das Wochenende', 'выходные', 'noun', 'Was hast du am Wochenende gemacht?', 'Что ты делал на выходных?', 'n'],
              ],
              exercises: [
                fill('Ich ___ gestern Pizza gegessen.', ['habe'], 'essen образует Perfekt с haben: ich habe gegessen.', { s: 'grammar', t: 'past_tense' }, { options: ['habe', 'bin', 'hat'] }),
                fill('Wir ___ nach Berlin gefahren.', ['sind'], 'fahren — глагол движения, поэтому sein: wir sind gefahren.', { s: 'grammar', t: 'past_tense', d: 2 }, { options: ['haben', 'sind', 'seid'] }),
                choice('Какое причастие у глагола lesen?', ['gelesen', 'gelest', 'gelesent'], 0, 'lesen — сильный глагол, его Partizip II оканчивается на -en: gelesen.', { s: 'grammar', t: 'past_tense', d: 2 }),
                order(['Ich', 'habe', 'gestern', 'lange', 'gearbeitet'], 'Вчера я долго работал.', 'habe — на втором месте, причастие gearbeitet — в конце предложения.', { s: 'grammar', t: 'word_order', d: 2 }),
                translate('Что ты делал на выходных?', ['Was hast du am Wochenende gemacht?'], 'machen → gemacht; am Wochenende — «на выходных».', { s: 'grammar', t: 'past_tense', d: 3 }),
                dialogue(
                  [
                    ['A', 'Was hast du gestern gemacht?', 'Что ты делал вчера?'],
                    ['B', null],
                  ],
                  ['Ich habe einen Film gesehen.', 'Ich sehe einen Film.', 'Ich werde einen Film sehen.'],
                  0,
                  'Вопрос в прошедшем времени — отвечаем тоже в Perfekt: habe … gesehen.',
                  { t: 'past_tense' },
                ),
                listen('Wir sind nach Hause gefahren.', 'nach Hause — «домой» (направление).', {}, { translation: 'Мы поехали домой.' }),
                translateBack('Sie hat ein Buch gelesen.', ['Она прочитала книгу', 'Она читала книгу'], 'hat gelesen — Perfekt от lesen.'),
              ],
            },
            {
              key: 'de-a2-travel',
              title: 'В дороге',
              objective: 'Спросить дорогу, купить билет и попросить о помощи с модальными глаголами.',
              topic: 'travel',
              minutes: 11,
              theory: [
                {
                  title: 'Модальные глаголы: können, müssen, möchten',
                  body: 'Модальный глагол стоит на втором месте, а основной глагол — в инфинитиве в конце: Ich muss in Köln umsteigen. Können Sie mir helfen? — вежливая просьба о помощи.',
                  examples: [
                    ['Ich muss umsteigen.', 'Мне нужно сделать пересадку.'],
                    ['Kann ich hier bezahlen?', 'Можно здесь оплатить?'],
                  ],
                },
              ],
              words: [
                ['der Bahnhof', 'вокзал', 'noun', 'Wo ist der Bahnhof?', 'Где вокзал?', 'm'],
                ['die Fahrkarte', 'билет (на транспорт)', 'noun', 'Ich brauche eine Fahrkarte nach München.', 'Мне нужен билет до Мюнхена.', 'f'],
                ['umsteigen', 'делать пересадку', 'verb', 'Sie müssen in Köln umsteigen.', 'Вам нужно пересесть в Кёльне.'],
                ['links', 'налево, слева', 'adverb', 'Gehen Sie hier links.', 'Здесь идите налево.'],
                ['rechts', 'направо, справа', 'adverb', 'Der Bahnhof ist rechts.', 'Вокзал справа.'],
                ['können', 'мочь, уметь', 'verb', 'Können Sie mir helfen?', 'Вы можете мне помочь?'],
              ],
              exercises: [
                choice('Как спросить, где вокзал?', ['Wo ist der Bahnhof?', 'Wer ist der Bahnhof?', 'Wie ist der Bahnhof?'], 0, 'wo — «где», wer — «кто», wie — «как».', { t: 'questions', s: 'grammar' }),
                fill('Sie ___ in Köln umsteigen.', ['müssen'], 'С Sie модальный глагол müssen имеет форму müssen.', { s: 'grammar', t: 'modal_verbs', d: 2 }, { options: ['muss', 'müssen', 'musst'] }),
                order(['Können', 'Sie', 'mir', 'helfen'], 'Вы можете мне помочь?', 'В вопросе без вопросительного слова глагол стоит на первом месте, инфинитив — в конце.', { t: 'modal_verbs', d: 2 }),
                match(
                  [
                    ['links', 'налево'],
                    ['rechts', 'направо'],
                    ['geradeaus', 'прямо'],
                    ['die Fahrkarte', 'билет'],
                  ],
                  'Эти слова чаще всего встречаются в объяснении дороги.',
                ),
                translate('Мне нужен билет до Мюнхена.', ['Ich brauche eine Fahrkarte nach München.', 'Ich brauche ein Ticket nach München.'], 'brauchen — «нуждаться»; nach + город — направление.', { d: 2 }),
                dialogue(
                  [
                    ['A', 'Entschuldigung, wie komme ich zum Bahnhof?', 'Извините, как пройти к вокзалу?'],
                    ['B', null],
                  ],
                  ['Gehen Sie geradeaus und dann links.', 'Ich komme aus Almaty.', 'Der Zug ist blau.'],
                  0,
                  'На вопрос о дороге отвечают указанием направления: geradeaus — прямо, links — налево.',
                ),
                listen('Der Zug fährt um acht Uhr ab.', 'abfahren — отправляться; приставка ab уходит в конец предложения.', {}, { translation: 'Поезд отправляется в восемь часов.', answers: ['Der Zug fährt um acht Uhr ab.', 'Der Zug fährt um 8 Uhr ab.'] }),
                speak('Wo ist der Bahnhof?', 'Где вокзал?', 'В Bahnhof h после a не читается, а удлиняет гласную: [ба:нхоф].'),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'B1',
      title: 'Немецкий B1: мнения и аргументы',
      description: 'Придаточные предложения с weil и dass, выражение мнения.',
      modules: [
        {
          title: 'Своё мнение',
          description: 'Как высказать и обосновать точку зрения.',
          lessons: [
            {
              key: 'de-b1-opinions',
              title: 'Я думаю, что…',
              objective: 'Высказать мнение и обосновать его придаточными с dass и weil.',
              topic: 'opinions',
              minutes: 12,
              theory: [
                {
                  title: 'Глагол в конце придаточного',
                  body: 'В придаточных предложениях с dass («что») и weil («потому что») спрягаемый глагол уходит в самый конец: Ich glaube, dass Deutsch nützlich ist. Ich lerne Deutsch, weil ich in Berlin arbeiten möchte.',
                  examples: [
                    ['Ich finde, dass das eine gute Idee ist.', 'Я считаю, что это хорошая идея.'],
                    ['Ich bleibe zu Hause, weil ich krank bin.', 'Я остаюсь дома, потому что болею.'],
                  ],
                },
                {
                  title: 'Полезные фразы',
                  body: 'Meiner Meinung nach … — «по моему мнению» (после неё глагол стоит сразу: Meiner Meinung nach ist das richtig). Ich bin dafür / dagegen — «я за / против».',
                },
              ],
              words: [
                ['die Meinung', 'мнение', 'noun', 'Meiner Meinung nach ist das falsch.', 'По-моему, это неверно.', 'f'],
                ['glauben', 'полагать, верить', 'verb', 'Ich glaube, dass er recht hat.', 'Думаю, что он прав.'],
                ['weil', 'потому что', 'conjunction', 'Ich lerne, weil ich eine Prüfung habe.', 'Я учусь, потому что у меня экзамен.'],
                ['wichtig', 'важный', 'adjective', 'Bildung ist wichtig.', 'Образование важно.'],
                ['der Vorteil', 'преимущество', 'noun', 'Das hat viele Vorteile.', 'У этого много преимуществ.', 'm'],
                ['der Nachteil', 'недостаток', 'noun', 'Ein Nachteil ist der Preis.', 'Один из недостатков — цена.', 'm'],
              ],
              exercises: [
                order(['Ich', 'glaube', 'dass', 'Deutsch', 'nützlich', 'ist'], 'Я думаю, что немецкий полезен.', 'После dass спрягаемый глагол ist стоит в конце.', { s: 'grammar', t: 'word_order', d: 2 }),
                choice('Выберите правильный вариант.', ['Ich lerne Deutsch, weil ich in Wien arbeite.', 'Ich lerne Deutsch, weil ich arbeite in Wien.', 'Ich lerne Deutsch, weil arbeite ich in Wien.'], 0, 'В придаточном с weil глагол arbeite стоит последним.', { s: 'grammar', t: 'word_order', d: 2 }),
                fill('Meiner Meinung nach ___ das eine gute Idee.', ['ist'], 'После вводного «Meiner Meinung nach» сразу идёт глагол (он на втором месте).', { s: 'grammar', t: 'word_order', d: 3 }, { options: ['ist', 'sind', 'bin'] }),
                translate('Я думаю, что это важно.', ['Ich glaube, dass das wichtig ist.', 'Ich denke, dass das wichtig ist.', 'Ich finde, dass das wichtig ist.'], 'dass + глагол в конце: … dass das wichtig ist.', { s: 'grammar', t: 'word_order', d: 3 }),
                match(
                  [
                    ['der Vorteil', 'преимущество'],
                    ['der Nachteil', 'недостаток'],
                    ['die Meinung', 'мнение'],
                    ['wichtig', 'важный'],
                  ],
                  'Слова для аргументации: Vorteil и Nachteil образуют пару.',
                ),
                dialogue(
                  [
                    ['A', 'Was denkst du über Online-Unterricht?', 'Что ты думаешь об онлайн-обучении?'],
                    ['B', null],
                  ],
                  ['Ich finde ihn praktisch, weil ich Zeit spare.', 'Ich finde ihn praktisch, weil ich spare Zeit.', 'Online-Unterricht heißt Anna.'],
                  0,
                  'Обоснование с weil требует глагол в конце: … weil ich Zeit spare.',
                  { t: 'word_order', d: 2 },
                ),
                translateBack('Ein Nachteil ist, dass es teuer ist.', ['Один недостаток в том, что это дорого', 'Недостаток в том, что это дорого'], 'Nachteil — «недостаток», teuer — «дорогой».', { d: 2 }),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'B2',
      title: 'Немецкий B2: гипотезы и вежливость',
      description: 'Konjunktiv II: нереальные условия, пожелания и вежливые просьбы.',
      modules: [
        {
          title: 'Если бы…',
          description: 'Нереальные условия и пожелания.',
          lessons: [
            {
              key: 'de-b2-konjunktiv',
              title: 'Если бы у меня было время',
              objective: 'Говорить о нереальных ситуациях и пожеланиях с помощью Konjunktiv II.',
              topic: 'hypotheticals',
              minutes: 13,
              theory: [
                {
                  title: 'würde + инфинитив',
                  body: 'Нереальное условие строится так: Wenn ich Zeit hätte, würde ich mehr reisen. Для большинства глаголов используют würde + инфинитив; у sein и haben есть собственные формы: wäre, hätte.',
                  examples: [
                    ['Wenn ich reich wäre, würde ich ein Haus kaufen.', 'Если бы я был богат, я бы купил дом.'],
                    ['Ich hätte gern mehr Zeit.', 'Я бы хотел больше времени.'],
                  ],
                },
              ],
              words: [
                ['wenn', 'если; когда', 'conjunction', 'Wenn ich Zeit hätte, käme ich.', 'Если бы у меня было время, я бы пришёл.'],
                ['wäre', 'был бы (Konj. II от sein)', 'verb', 'Das wäre schön.', 'Это было бы здорово.'],
                ['hätte', 'имел бы (Konj. II от haben)', 'verb', 'Ich hätte gern einen Rat.', 'Мне бы хотелось получить совет.'],
                ['reisen', 'путешествовать', 'verb', 'Ich würde gern nach Japan reisen.', 'Я бы с удовольствием поехал в Японию.'],
                ['die Möglichkeit', 'возможность', 'noun', 'Das ist eine gute Möglichkeit.', 'Это хорошая возможность.', 'f'],
              ],
              exercises: [
                fill('Wenn ich Zeit ___, würde ich mehr lesen.', ['hätte'], 'Нереальное условие с haben: hätte.', { s: 'grammar', t: 'conditionals', d: 3 }, { options: ['habe', 'hätte', 'hatte'] }),
                fill('Wenn ich reich ___, würde ich reisen.', ['wäre'], 'Нереальное условие с sein: wäre.', { s: 'grammar', t: 'conditionals', d: 3 }, { options: ['bin', 'war', 'wäre'] }),
                order(['Ich', 'würde', 'gern', 'nach', 'Japan', 'reisen'], 'Я бы с удовольствием поехал в Японию.', 'würde на втором месте, инфинитив reisen — в конце.', { s: 'grammar', t: 'conditionals', d: 3 }),
                choice('Какая фраза звучит вежливее всего?', ['Könnten Sie mir bitte helfen?', 'Helfen Sie mir!', 'Sie müssen mir helfen.'], 0, 'Konjunktiv II (könnten) смягчает просьбу.', { s: 'grammar', t: 'conditionals', d: 2 }),
                translate('Это было бы здорово.', ['Das wäre schön.', 'Das wäre toll.', 'Das wäre super.'], 'wäre — Konjunktiv II от sein.', { s: 'grammar', t: 'conditionals', d: 3 }),
                translateBack('Wenn ich mehr Zeit hätte, würde ich Gitarre lernen.', ['Если бы у меня было больше времени, я бы научился играть на гитаре', 'Если бы у меня было больше времени, я бы учился играть на гитаре'], 'hätte … würde lernen — нереальное условие.', { d: 3 }),
              ],
            },
          ],
        },
      ],
    },
  ],
  placement: [
    { level: 'A1', exercise: choice('Как сказать «Меня зовут Анна»?', ['Ich heiße Anna.', 'Ich bin heiße Anna.', 'Mein heiße Anna.'], 0, 'ich heiße — «меня зовут».', { t: 'greetings' }) },
    { level: 'A1', exercise: fill('Wir ___ aus Kasachstan.', ['sind', 'kommen'], 'wir sind / wir kommen aus …', { s: 'grammar', t: 'to_be' }, { options: ['sind', 'ist', 'bin'] }) },
    { level: 'A1', exercise: choice('Das ist ___ Mutter.', ['meine', 'mein', 'meinen'], 0, 'Mutter — женского рода: meine.', { s: 'grammar', t: 'possessive' }) },
    { level: 'A2', exercise: fill('Gestern ___ ich ins Kino gegangen.', ['bin'], 'gehen образует Perfekt с sein.', { s: 'grammar', t: 'past_tense' }, { options: ['bin', 'habe', 'war'] }) },
    { level: 'A2', exercise: choice('Sie ___ hier umsteigen.', ['müssen', 'muss', 'musst'], 0, 'С Sie: müssen.', { s: 'grammar', t: 'modal_verbs' }) },
    { level: 'A2', exercise: choice('Ich hätte gern ___ Kaffee.', ['einen', 'ein', 'eine'], 0, 'Akkusativ мужского рода: einen.', { s: 'grammar', t: 'cases' }) },
    { level: 'B1', exercise: choice('Выберите правильное предложение.', ['Ich weiß, dass er morgen kommt.', 'Ich weiß, dass er kommt morgen.', 'Ich weiß, dass kommt er morgen.'], 0, 'В придаточном с dass глагол в конце.', { s: 'grammar', t: 'word_order' }) },
    { level: 'B1', exercise: fill('Ich bleibe zu Hause, weil ich krank ___.', ['bin'], 'weil + глагол в конце.', { s: 'grammar', t: 'word_order' }, { options: ['bin', 'ist', 'sein'] }) },
    { level: 'B1', exercise: choice('Das ist der Mann, ___ ich gestern gesehen habe.', ['den', 'der', 'dem'], 0, 'Относительное местоимение в Akkusativ: den.', { s: 'grammar', t: 'cases' }) },
    { level: 'B2', exercise: fill('Wenn ich Zeit ___, würde ich kommen.', ['hätte'], 'Konjunktiv II от haben: hätte.', { s: 'grammar', t: 'conditionals' }, { options: ['hätte', 'habe', 'hatte'] }) },
    { level: 'B2', exercise: choice('Das Haus ___ letztes Jahr gebaut.', ['wurde', 'wird', 'hat'], 0, 'Пассив в прошедшем времени: wurde gebaut.', { s: 'grammar', t: 'passive' }) },
    { level: 'B2', exercise: choice('Trotz ___ Regens gingen wir spazieren.', ['des', 'dem', 'den'], 0, 'trotz требует родительного падежа: des Regens.', { s: 'grammar', t: 'cases' }) },
  ],
};
