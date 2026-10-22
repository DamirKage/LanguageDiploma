import { choice, choiceRu, dialogue, fill, listen, match, order, speak, translate, translateBack, type LanguageSpec } from '../builders';

export const english: LanguageSpec = {
  code: 'en',
  name: 'Английский',
  nativeName: 'English',
  ttsLocale: 'en-GB',
  specialChars: [],
  order: 2,
  courses: [
    {
      level: 'A1',
      title: 'Английский A1: первые шаги',
      description: 'Знакомство, глагол to be, числа, семья и заказ в кафе.',
      modules: [
        {
          title: 'Знакомство',
          description: 'Приветствия, to be и числа.',
          lessons: [
            {
              key: 'en-a1-greetings',
              title: 'Привет и знакомство',
              objective: 'Поздороваться, представиться и спросить, как дела.',
              topic: 'greetings',
              minutes: 8,
              theory: [
                {
                  title: 'Формальное и неформальное приветствие',
                  body: 'Hi и Hello подходят почти всегда; Hi — проще и дружелюбнее. Good morning / Good afternoon / Good evening звучат официальнее. В английском нет отдельного вежливого «Вы»: you подходит и для друга, и для начальника — вежливость выражается словами please, could, would.',
                  examples: [
                    ['Hi, I’m Dana.', 'Привет, я Дана.'],
                    ['Nice to meet you.', 'Приятно познакомиться.'],
                  ],
                },
              ],
              words: [
                ['hello', 'здравствуйте, привет', 'interjection', 'Hello, my name is Arman.', 'Здравствуйте, меня зовут Арман.'],
                ['goodbye', 'до свидания', 'interjection', 'Goodbye, see you tomorrow!', 'До свидания, увидимся завтра!'],
                ['name', 'имя', 'noun', 'What is your name?', 'Как тебя зовут?'],
                ['nice to meet you', 'приятно познакомиться', 'phrase', 'Nice to meet you, Tom.', 'Приятно познакомиться, Том.'],
                ['thank you', 'спасибо', 'phrase', 'I’m fine, thank you.', 'У меня всё хорошо, спасибо.'],
                ['how are you', 'как дела', 'phrase', 'Hi, Kate! How are you?', 'Привет, Кейт! Как дела?'],
              ],
              exercises: [
                choice('Как ответить на «How are you?»', ['I’m fine, thank you.', 'I’m Anna.', 'Goodbye!'], 0, 'На вопрос о делах отвечают: I’m fine / I’m good / Not bad.'),
                match(
                  [
                    ['hello', 'здравствуйте'],
                    ['goodbye', 'до свидания'],
                    ['thank you', 'спасибо'],
                    ['name', 'имя'],
                  ],
                  'Базовые слова для первого разговора.',
                ),
                fill('My ___ is Arman.', ['name'], 'My name is … — «Меня зовут …», дословно «моё имя — …».', {}, { translation: 'Меня зовут Арман.', options: ['name', 'names', 'nome'] }),
                dialogue(
                  [
                    ['A', 'Hi! I’m Kate.', 'Привет! Я Кейт.'],
                    ['B', null],
                  ],
                  ['Nice to meet you, Kate. I’m Daniyar.', 'Goodbye, Kate.', 'I’m fine, thank you.'],
                  0,
                  'Когда человек представляется, принято ответить «Nice to meet you» и назвать себя.',
                ),
                translate('Приятно познакомиться.', ['Nice to meet you.', 'Pleased to meet you.'], 'Устойчивая фраза при знакомстве.'),
                listen('Good evening!', 'evening — «вечер», ударение на первый слог.', {}, { options: ['Good evening!', 'Good morning!', 'Good night!'], translation: 'Добрый вечер!' }),
                order(['What', 'is', 'your', 'name'], 'Как тебя зовут?', 'В вопросе с what глагол is стоит перед подлежащим.', { s: 'grammar', t: 'questions' }),
                speak('Nice to meet you.', 'Приятно познакомиться.', 'meet и you часто сливаются: [ми:чу].'),
              ],
            },
            {
              key: 'en-a1-to-be',
              title: 'Кто я и откуда',
              objective: 'Рассказать о себе с глаголом to be: имя, профессия, страна.',
              topic: 'to_be',
              minutes: 10,
              theory: [
                {
                  title: 'am, is, are',
                  body: 'В русском «быть» в настоящем времени опускается, в английском — никогда: I am a student. Формы: I am, he/she/it is, we/you/they are. В разговоре используют сокращения: I’m, he’s, they’re.',
                  examples: [
                    ['She is a doctor.', 'Она врач.'],
                    ['We are from Kazakhstan.', 'Мы из Казахстана.'],
                  ],
                },
                {
                  title: 'Артикль a перед профессией',
                  body: 'Профессию в единственном числе называют с артиклем a/an: I am a teacher, he is an engineer (an — перед гласным звуком).',
                },
              ],
              words: [
                ['student', 'студент', 'noun', 'I am a student.', 'Я студент.'],
                ['teacher', 'учитель', 'noun', 'My mother is a teacher.', 'Моя мама — учитель.'],
                ['doctor', 'врач', 'noun', 'He is a doctor.', 'Он врач.'],
                ['engineer', 'инженер', 'noun', 'She is an engineer.', 'Она инженер.'],
                ['country', 'страна', 'noun', 'Kazakhstan is a big country.', 'Казахстан — большая страна.'],
                ['city', 'город', 'noun', 'Almaty is my city.', 'Алматы — мой город.'],
                ['from', 'из', 'preposition', 'I’m from Astana.', 'Я из Астаны.'],
              ],
              exercises: [
                fill('I ___ a student.', ['am'], 'С I — am: I am.', {}, { options: ['am', 'is', 'are'] }),
                fill('They ___ from Shymkent.', ['are'], 'С they — are.', {}, { options: ['am', 'is', 'are'] }),
                fill('She ___ an engineer.', ['is'], 'С she — is.', {}, { options: ['am', 'is', 'are'] }),
                choice('Как правильно сказать «Он учитель»?', ['He is a teacher.', 'He teacher.', 'He is teacher.'], 0, 'Нужен глагол is и артикль a перед профессией.', { s: 'grammar', t: 'articles', d: 2 }),
                choice('Выберите правильный артикль: ___ engineer', ['an', 'a', '—'], 0, 'engineer начинается с гласного звука, поэтому an.', { s: 'grammar', t: 'articles', d: 2 }),
                translate('Мы из Казахстана.', ['We are from Kazakhstan.', 'We’re from Kazakhstan.'], 'to be + from + страна.'),
                translateBack('My sister is a doctor.', ['Моя сестра врач', 'Моя сестра — врач', 'Моя сестра работает врачом'], 'В русском переводе глагол «быть» опускается.'),
                listen('I’m from Kazakhstan.', 'I’m = I am.', {}, { translation: 'Я из Казахстана.', answers: ['I’m from Kazakhstan.', 'I am from Kazakhstan.'] }),
                speak('I am a student.', 'Я студент.', 'Звук [æ] в слове am — открытый, между «а» и «э».'),
              ],
            },
            {
              key: 'en-a1-numbers',
              title: 'Числа и возраст',
              objective: 'Называть числа до 100 и говорить о возрасте.',
              topic: 'numbers',
              minutes: 8,
              theory: [
                {
                  title: '-teen и -ty',
                  body: 'Числа 13–19 оканчиваются на -teen с ударением на конец (thirTEEN), десятки — на -ty с ударением на начало (THIRty). Их легко перепутать на слух: обращайте внимание на ударение.',
                  examples: [
                    ['fifteen — fifty', '15 — 50'],
                    ['I am twenty-one years old.', 'Мне двадцать один год.'],
                  ],
                },
                {
                  title: 'Возраст через to be',
                  body: 'Как и в немецком, возраст выражают глаголом to be: I am 25 (years old). Нельзя сказать «I have 25 years».',
                },
              ],
              words: [
                ['three', 'три', 'numeral', 'I have three brothers.', 'У меня три брата.'],
                ['twelve', 'двенадцать', 'numeral', 'It’s twelve o’clock.', 'Сейчас двенадцать часов.'],
                ['fifteen', 'пятнадцать', 'numeral', 'She is fifteen.', 'Ей пятнадцать.'],
                ['fifty', 'пятьдесят', 'numeral', 'My father is fifty.', 'Моему папе пятьдесят.'],
                ['old', 'старый; в возрасте', 'adjective', 'How old are you?', 'Сколько тебе лет?'],
                ['phone number', 'номер телефона', 'noun', 'What’s your phone number?', 'Какой у тебя номер телефона?'],
              ],
              exercises: [
                match(
                  [
                    ['three', '3'],
                    ['twelve', '12'],
                    ['fifteen', '15'],
                    ['fifty', '50'],
                  ],
                  '-teen — числа 13–19, -ty — десятки.',
                ),
                listen('fifteen', 'Ударение в конце — это -teen, значит 15.', {}, { options: ['15', '50', '5'], answers: ['15'] }),
                choice('Как сказать «Мне 20 лет»?', ['I am twenty years old.', 'I have twenty years.', 'I am twenty years.'], 0, 'Возраст: to be + число (+ years old). «have … years» — ошибка из-за русского «мне … лет».', { s: 'grammar', t: 'to_be', d: 2 }),
                fill('How ___ are you?', ['old'], 'How old are you? — «Сколько тебе лет?»', { s: 'grammar', t: 'questions' }, { options: ['old', 'many', 'much'] }),
                translate('Сколько тебе лет?', ['How old are you?'], 'Дословно «Насколько ты стар?»', { t: 'questions', s: 'grammar' }),
                choiceRu('Какое это число?', 'forty-two', ['42', '24', '402'], 0, 'forty (40) + two (2). Обратите внимание: forty пишется без u.', {}),
                dialogue(
                  [
                    ['A', 'What’s your phone number?', 'Какой у тебя номер телефона?'],
                    ['B', null],
                  ],
                  ['It’s 8 701 555 23 41.', 'I’m 23.', 'It’s my phone.'],
                  0,
                  'На вопрос о номере называют цифры: It’s …',
                ),
                speak('I am twenty-one years old.', 'Мне двадцать один год.', 'twenty-one звучит как [ту́энти уа́н], а years начинается со звука [й].'),
              ],
            },
          ],
        },
        {
          title: 'Мой мир',
          description: 'Семья и кафе.',
          lessons: [
            {
              key: 'en-a1-family',
              title: 'Моя семья',
              objective: 'Рассказать о семье с have got / has и притяжательным ’s.',
              topic: 'family',
              minutes: 10,
              theory: [
                {
                  title: 'Притяжательный ’s',
                  body: 'Принадлежность часто выражают через ’s: my mother’s car — «машина моей мамы», Aigerim’s brother — «брат Айгерим». Это короче, чем конструкция с of.',
                  examples: [
                    ['This is my brother’s room.', 'Это комната моего брата.'],
                  ],
                },
                {
                  title: 'have / has',
                  body: '«У меня есть» передаётся глаголом have: I have a sister. С he/she/it — has: She has two children.',
                },
              ],
              words: [
                ['family', 'семья', 'noun', 'My family is big.', 'Моя семья большая.'],
                ['mother', 'мать', 'noun', 'My mother is a nurse.', 'Моя мама — медсестра.'],
                ['father', 'отец', 'noun', 'His father works in a bank.', 'Его отец работает в банке.'],
                ['brother', 'брат', 'noun', 'I have an older brother.', 'У меня есть старший брат.'],
                ['sister', 'сестра', 'noun', 'My sister is ten.', 'Моей сестре десять.'],
                ['parents', 'родители', 'noun', 'My parents live in Almaty.', 'Мои родители живут в Алматы.'],
                ['children', 'дети', 'noun', 'They have three children.', 'У них трое детей.'],
              ],
              exercises: [
                match(
                  [
                    ['mother', 'мать'],
                    ['father', 'отец'],
                    ['parents', 'родители'],
                    ['children', 'дети'],
                  ],
                  'children — неправильное множественное число от child.',
                ),
                fill('She ___ two children.', ['has'], 'С she — has.', { s: 'grammar', t: 'present_tense' }, { options: ['have', 'has', 'is'] }),
                fill('I ___ a sister.', ['have'], 'С I — have.', { s: 'grammar', t: 'present_tense' }, { options: ['have', 'has', 'am'] }),
                choice('Как сказать «машина моего отца»?', ['my father’s car', 'my father car', 'the car my father'], 0, 'Принадлежность: существительное + ’s.', { s: 'grammar', t: 'possessive', d: 2 }),
                translate('У меня есть брат.', ['I have a brother.', 'I’ve got a brother.', 'I have got a brother.'], 'have (got) + a + существительное.', { s: 'grammar', d: 2 }),
                translateBack('My parents live in Astana.', ['Мои родители живут в Астане'], 'parents — «родители», live — «жить».'),
                order(['My', 'brother’s', 'name', 'is', 'Timur'], 'Моего брата зовут Тимур.', 'brother’s name — «имя брата».', { t: 'possessive' }),
                speak('This is my family.', 'Это моя семья.', 'th в this — звонкий межзубный звук: кончик языка между зубами.'),
              ],
            },
            {
              key: 'en-a1-cafe',
              title: 'В кафе',
              objective: 'Заказать еду и напитки, вежливо попросить и узнать цену.',
              topic: 'food',
              minutes: 10,
              theory: [
                {
                  title: 'Вежливые просьбы',
                  body: 'Can I have …? и Could I have …? — стандартные вежливые формулы заказа. I’d like … (= I would like) — «я бы хотел». Прямое «Give me …» звучит грубо.',
                  examples: [
                    ['Could I have a cup of tea, please?', 'Можно мне чашку чая, пожалуйста?'],
                    ['Can I have the bill, please?', 'Можно счёт, пожалуйста?'],
                  ],
                },
                {
                  title: 'a / an / some',
                  body: 'Перед исчисляемыми существительными — a/an (a sandwich), перед неисчисляемыми — some (some water) или a glass of / a cup of.',
                },
              ],
              words: [
                ['coffee', 'кофе', 'noun', 'A coffee with milk, please.', 'Кофе с молоком, пожалуйста.'],
                ['tea', 'чай', 'noun', 'I’d like some tea.', 'Я бы хотел чаю.'],
                ['water', 'вода', 'noun', 'A glass of water, please.', 'Стакан воды, пожалуйста.'],
                ['menu', 'меню', 'noun', 'Can I see the menu?', 'Можно посмотреть меню?'],
                ['bill', 'счёт', 'noun', 'Can I have the bill, please?', 'Можно счёт, пожалуйста?'],
                ['how much', 'сколько (о цене)', 'phrase', 'How much is the cake?', 'Сколько стоит торт?'],
              ],
              exercises: [
                choice('Как вежливо заказать кофе?', ['Could I have a coffee, please?', 'Give me coffee.', 'I coffee.'], 0, 'Could I have … please? — вежливая формула заказа.'),
                fill('I’d ___ a sandwich, please.', ['like'], 'I’d like = I would like — «я бы хотел».', { s: 'grammar', t: 'modal_verbs' }, { options: ['like', 'want', 'likes'] }),
                fill('Can I have ___ glass of water?', ['a'], 'glass — исчисляемое, поэтому a glass of water.', { s: 'grammar', t: 'articles', d: 2 }, { options: ['a', 'an', 'some'] }),
                dialogue(
                  [
                    ['A', 'Are you ready to order?', 'Вы готовы сделать заказ?'],
                    ['B', null],
                    ['A', 'Sure. Anything else?', 'Конечно. Что-нибудь ещё?'],
                  ],
                  ['Yes, I’d like the soup, please.', 'Yes, I’m Anna.', 'Goodbye!'],
                  0,
                  'На вопрос о заказе отвечают I’d like … please.',
                  {},
                  'Вы в кафе в Лондоне.',
                ),
                translate('Сколько стоит чай?', ['How much is the tea?', 'How much does the tea cost?'], 'Вопрос о цене: How much is …?', { t: 'questions', s: 'grammar', d: 2 }),
                match(
                  [
                    ['bill', 'счёт'],
                    ['menu', 'меню'],
                    ['water', 'вода'],
                    ['tea', 'чай'],
                  ],
                  'В британском английском «счёт» в кафе — bill, в американском — check.',
                ),
                listen('Can I have the bill, please?', 'bill — счёт в ресторане (британский вариант).', {}, { translation: 'Можно счёт, пожалуйста?' }),
                speak('Could I have a coffee, please?', 'Можно мне кофе, пожалуйста?', 'В could буква l не читается: [кʊд].'),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'A2',
      title: 'Английский A2: события и поездки',
      description: 'Past Simple, вопросы о прошлом и ориентирование в путешествии.',
      modules: [
        {
          title: 'Истории и поездки',
          description: 'Рассказ о прошлом и путешествия.',
          lessons: [
            {
              key: 'en-a2-past-simple',
              title: 'Что было вчера',
              objective: 'Рассказать о прошедших событиях в Past Simple, включая неправильные глаголы.',
              topic: 'past_events',
              minutes: 12,
              theory: [
                {
                  title: 'Past Simple',
                  body: 'Правильные глаголы получают окончание -ed: work → worked. Неправильные нужно запомнить: go → went, see → saw, eat → ate. В вопросах и отрицаниях появляется did, а глагол возвращается в начальную форму: Did you see the film? I didn’t go.',
                  examples: [
                    ['I watched a film yesterday.', 'Вчера я посмотрел фильм.'],
                    ['We went to the mountains.', 'Мы поехали в горы.'],
                  ],
                },
              ],
              words: [
                ['yesterday', 'вчера', 'adverb', 'I was at home yesterday.', 'Вчера я был дома.'],
                ['went', 'пошёл, поехал (go)', 'verb', 'She went to London last year.', 'В прошлом году она ездила в Лондон.'],
                ['saw', 'увидел (see)', 'verb', 'We saw a great film.', 'Мы посмотрели отличный фильм.'],
                ['ate', 'съел (eat)', 'verb', 'I ate pizza for dinner.', 'На ужин я ел пиццу.'],
                ['last week', 'на прошлой неделе', 'phrase', 'Last week I visited my parents.', 'На прошлой неделе я навестил родителей.'],
                ['weekend', 'выходные', 'noun', 'What did you do at the weekend?', 'Что ты делал на выходных?'],
              ],
              exercises: [
                fill('Yesterday I ___ to the cinema.', ['went'], 'go — неправильный глагол: go → went.', { s: 'grammar', t: 'past_tense' }, { options: ['go', 'went', 'goed'] }),
                fill('___ you see the match?', ['Did'], 'Вопрос в Past Simple: Did + подлежащее + глагол в начальной форме.', { s: 'grammar', t: 'past_tense', d: 2 }, { options: ['Did', 'Do', 'Were'] }),
                choice('Где ошибка?', ['I didn’t went to work.', 'I didn’t go to work.', 'I went to work.'], 0, 'После didn’t глагол стоит в начальной форме: didn’t go.', { s: 'grammar', t: 'past_tense', d: 2 }),
                match(
                  [
                    ['go', 'went'],
                    ['see', 'saw'],
                    ['eat', 'ate'],
                    ['buy', 'bought'],
                  ],
                  'Неправильные глаголы нужно запоминать парами.',
                  { s: 'grammar', t: 'past_tense' },
                ),
                translate('Что ты делал на выходных?', ['What did you do at the weekend?', 'What did you do on the weekend?', 'What did you do last weekend?'], 'at the weekend — британский вариант, on the weekend — американский.', { s: 'grammar', t: 'past_tense', d: 3 }),
                order(['We', 'visited', 'our', 'grandparents', 'last', 'week'], 'На прошлой неделе мы навестили бабушку и дедушку.', 'Обстоятельство времени обычно стоит в конце предложения.', { t: 'word_order' }, { alternatives: [['Last', 'week', 'we', 'visited', 'our', 'grandparents']] }),
                listen('I saw a great film yesterday.', 'saw — прошедшее время от see.', {}, { translation: 'Вчера я посмотрел отличный фильм.' }),
                translateBack('She didn’t come to the party.', ['Она не пришла на вечеринку'], 'didn’t come — отрицание в Past Simple.'),
              ],
            },
            {
              key: 'en-a2-travel',
              title: 'В дороге',
              objective: 'Спросить дорогу, купить билет и понять объявление.',
              topic: 'travel',
              minutes: 10,
              theory: [
                {
                  title: 'Как спросить дорогу',
                  body: 'Excuse me, how do I get to …? / Where is the nearest …? Ответы: go straight on — идите прямо, turn left/right — поверните налево/направо, it’s next to … — рядом с …',
                },
                {
                  title: 'Модальные глаголы can и have to',
                  body: 'can — «могу, можно», have to — «приходится, нужно»: You have to change at Victoria. После модального глагола — начальная форма без to (кроме have to).',
                },
              ],
              words: [
                ['station', 'станция, вокзал', 'noun', 'Where is the train station?', 'Где железнодорожный вокзал?'],
                ['ticket', 'билет', 'noun', 'A return ticket to Oxford, please.', 'Билет туда-обратно до Оксфорда, пожалуйста.'],
                ['turn left', 'повернуть налево', 'phrase', 'Turn left at the bank.', 'Поверните налево у банка.'],
                ['straight on', 'прямо', 'adverb', 'Go straight on for two minutes.', 'Идите прямо две минуты.'],
                ['platform', 'платформа', 'noun', 'The train leaves from platform 4.', 'Поезд отходит с четвёртой платформы.'],
                ['change', 'пересаживаться; менять', 'verb', 'You have to change at Victoria.', 'Вам нужно пересесть на «Виктории».'],
              ],
              exercises: [
                choice('Как спросить дорогу к вокзалу?', ['Excuse me, how do I get to the station?', 'Excuse me, where I get station?', 'Station, please, where?'], 0, 'Вежливое начало Excuse me + how do I get to …?', { t: 'questions', s: 'grammar' }),
                fill('You ___ to change at Victoria.', ['have'], 'have to — «нужно, приходится».', { s: 'grammar', t: 'modal_verbs', d: 2 }, { options: ['have', 'must', 'can'] }),
                match(
                  [
                    ['ticket', 'билет'],
                    ['platform', 'платформа'],
                    ['station', 'вокзал'],
                    ['straight on', 'прямо'],
                  ],
                  'Слова, которые встречаются на любом вокзале.',
                ),
                dialogue(
                  [
                    ['A', 'Excuse me, is the museum far from here?', 'Извините, музей далеко отсюда?'],
                    ['B', null],
                  ],
                  ['No, go straight on and turn left at the bank.', 'Yes, I’m from Almaty.', 'It’s ten pounds.'],
                  0,
                  'На вопрос о дороге отвечают направлением.',
                ),
                translate('Можно билет до Лондона, пожалуйста?', ['Can I have a ticket to London, please?', 'Could I have a ticket to London, please?', 'A ticket to London, please.'], 'Can/Could I have … please? — вежливая просьба.', { d: 2 }),
                listen('The train to Oxford leaves from platform four.', 'leaves from platform four — «отходит с четвёртой платформы».', {}, { translation: 'Поезд до Оксфорда отходит с четвёртой платформы.', answers: ['The train to Oxford leaves from platform four.', 'The train to Oxford leaves from platform 4.'] }),
                order(['Can', 'you', 'help', 'me', 'please'], 'Не могли бы вы мне помочь?', 'В вопросе с can модальный глагол стоит первым.', { t: 'modal_verbs' }),
                speak('Excuse me, where is the station?', 'Извините, где вокзал?', 'В station «ti» читается как «ш»: [стейшн].'),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'B1',
      title: 'Английский B1: мнения и аргументы',
      description: 'Выражение мнения, связки because, although, however.',
      modules: [
        {
          title: 'Своё мнение',
          description: 'Аргументация и связность речи.',
          lessons: [
            {
              key: 'en-b1-opinions',
              title: 'По-моему…',
              objective: 'Высказать мнение, согласиться или возразить и связать аргументы.',
              topic: 'opinions',
              minutes: 12,
              theory: [
                {
                  title: 'Как выразить мнение',
                  body: 'In my opinion, … / I think (that) … / As far as I’m concerned, … Согласие: I agree with you. Несогласие вежливо: I see your point, but …',
                },
                {
                  title: 'because, although, however',
                  body: 'because — «потому что» (причина), although — «хотя» (уступка внутри предложения), however — «однако» (начинает новое предложение и отделяется запятой).',
                  examples: [
                    ['Although it was late, we continued.', 'Хотя было поздно, мы продолжили.'],
                    ['It’s expensive. However, it’s worth it.', 'Это дорого. Однако оно того стоит.'],
                  ],
                },
              ],
              words: [
                ['opinion', 'мнение', 'noun', 'In my opinion, it’s a good idea.', 'По-моему, это хорошая идея.'],
                ['agree', 'соглашаться', 'verb', 'I completely agree with you.', 'Полностью с вами согласен.'],
                ['although', 'хотя', 'conjunction', 'Although it rained, we went out.', 'Хотя шёл дождь, мы вышли.'],
                ['however', 'однако', 'adverb', 'However, there is a problem.', 'Однако есть проблема.'],
                ['advantage', 'преимущество', 'noun', 'The main advantage is the price.', 'Главное преимущество — цена.'],
                ['disadvantage', 'недостаток', 'noun', 'One disadvantage is the noise.', 'Один из недостатков — шум.'],
              ],
              exercises: [
                fill('___ it was raining, we went for a walk.', ['Although'], 'Уступка: although — «хотя».', { s: 'grammar', t: 'conjunctions', d: 2 }, { options: ['Although', 'However', 'Because'] }),
                fill('The flat is small. ___, it is very cheap.', ['However'], 'However начинает новое предложение и противопоставляет его предыдущему.', { s: 'grammar', t: 'conjunctions', d: 2 }, { options: ['Although', 'However', 'Because'] }),
                choice('Как вежливо возразить?', ['I see your point, but I think it’s too expensive.', 'You are wrong.', 'No.'], 0, 'I see your point, but … — признаём аргумент собеседника и предлагаем свой.', { s: 'reading', c: 'comprehension' }),
                match(
                  [
                    ['advantage', 'преимущество'],
                    ['disadvantage', 'недостаток'],
                    ['opinion', 'мнение'],
                    ['agree', 'соглашаться'],
                  ],
                  'Лексика для обсуждения и аргументации.',
                ),
                translate('По-моему, это хорошая идея.', ['In my opinion, it’s a good idea.', 'In my opinion, it is a good idea.', 'In my opinion, this is a good idea.', 'I think it’s a good idea.', 'I think it is a good idea.'], 'In my opinion, … — нейтральное введение мнения.', { d: 2 }),
                dialogue(
                  [
                    ['A', 'I think working from home is better.', 'Я думаю, работать из дома лучше.'],
                    ['B', null],
                  ],
                  ['I agree, because you save time on travel.', 'I agree, because of you save time.', 'Working is home.'],
                  0,
                  'because + полное предложение (подлежащее и сказуемое).',
                  { t: 'conjunctions', d: 2 },
                ),
                translateBack('Although the course is difficult, it is very useful.', ['Хотя курс сложный, он очень полезный', 'Хотя курс трудный, он очень полезен'], 'although — «хотя».', { d: 2 }),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'B2',
      title: 'Английский B2: гипотезы',
      description: 'Второй и третий тип условных предложений, сожаление с wish.',
      modules: [
        {
          title: 'Если бы…',
          description: 'Нереальные условия в настоящем и прошлом.',
          lessons: [
            {
              key: 'en-b2-conditionals',
              title: 'Если бы я знал',
              objective: 'Говорить о нереальных ситуациях в настоящем и прошлом.',
              topic: 'hypotheticals',
              minutes: 13,
              theory: [
                {
                  title: 'Второй тип: нереальное настоящее',
                  body: 'If + Past Simple, would + глагол: If I had more time, I would travel. С be часто используют were для всех лиц: If I were you, I would accept.',
                },
                {
                  title: 'Третий тип: нереальное прошлое',
                  body: 'If + Past Perfect, would have + V3: If I had known, I would have come. Так говорят о том, что уже нельзя изменить. В русском обе ситуации передаются одним «если бы», поэтому их легко перепутать.',
                  examples: [
                    ['If she had studied, she would have passed.', 'Если бы она занималась, она бы сдала.'],
                  ],
                },
              ],
              words: [
                ['would', 'бы (вспомогательный)', 'verb', 'I would help you.', 'Я бы тебе помог.'],
                ['if I were you', 'на твоём месте', 'phrase', 'If I were you, I would wait.', 'На твоём месте я бы подождал.'],
                ['regret', 'сожалеть', 'verb', 'I regret saying that.', 'Я жалею, что сказал это.'],
                ['wish', 'желать; жаль, что', 'verb', 'I wish I had more time.', 'Жаль, что у меня нет больше времени.'],
                ['otherwise', 'иначе', 'adverb', 'Hurry up, otherwise we’ll be late.', 'Поторопись, иначе мы опоздаем.'],
              ],
              exercises: [
                fill('If I ___ more money, I would buy a car.', ['had'], 'Второй тип: if + Past Simple.', { s: 'grammar', t: 'conditionals', d: 3 }, { options: ['have', 'had', 'would have'] }),
                fill('If I had known, I ___ have come.', ['would'], 'Третий тип: would have + V3.', { s: 'grammar', t: 'conditionals', d: 3 }, { options: ['will', 'would', 'had'] }),
                choice('Какое предложение говорит о прошлом, которое нельзя изменить?', ['If you had called me, I would have helped.', 'If you call me, I will help.', 'If you called me, I would help.'], 0, 'had called … would have helped — третий тип.', { s: 'grammar', t: 'conditionals', d: 3 }),
                translate('На твоём месте я бы подождал.', ['If I were you, I would wait.', 'If I were you, I’d wait.', 'If I was you, I would wait.'], 'If I were you, … — устойчивая форма совета.', { s: 'grammar', t: 'conditionals', d: 3 }),
                order(['I', 'wish', 'I', 'had', 'more', 'free', 'time'], 'Жаль, что у меня нет больше свободного времени.', 'wish + Past Simple — сожаление о настоящем.', { s: 'grammar', t: 'conditionals', d: 3 }),
                translateBack('If we had left earlier, we would have caught the train.', ['Если бы мы вышли раньше, мы бы успели на поезд'], 'had left … would have caught — нереальное прошлое.', { d: 3 }),
              ],
            },
          ],
        },
      ],
    },
  ],
  placement: [
    { level: 'A1', exercise: fill('She ___ a teacher.', ['is'], 'she → is.', { s: 'grammar', t: 'to_be' }, { options: ['is', 'are', 'am'] }) },
    { level: 'A1', exercise: choice('How ___ are you? — I’m 20.', ['old', 'many', 'age'], 0, 'How old are you?', { t: 'numbers' }) },
    { level: 'A1', exercise: choice('I ___ two brothers.', ['have', 'has', 'am'], 0, 'I have.', { s: 'grammar', t: 'present_tense' }) },
    { level: 'A2', exercise: fill('Yesterday we ___ to the park.', ['went'], 'go → went.', { s: 'grammar', t: 'past_tense' }, { options: ['went', 'go', 'goes'] }) },
    { level: 'A2', exercise: choice('___ you finish your homework?', ['Did', 'Do', 'Are'], 0, 'Вопрос в Past Simple с did.', { s: 'grammar', t: 'past_tense' }) },
    { level: 'A2', exercise: choice('You ___ to change trains at Victoria.', ['have', 'has', 'must to'], 0, 'have to — нужно.', { s: 'grammar', t: 'modal_verbs' }) },
    { level: 'B1', exercise: choice('___ it was cold, we swam in the lake.', ['Although', 'However', 'Because'], 0, 'although — хотя.', { s: 'grammar', t: 'conjunctions' }) },
    { level: 'B1', exercise: fill('I have lived here ___ 2015.', ['since'], 'since + момент времени.', { s: 'grammar', t: 'present_tense' }, { options: ['since', 'for', 'from'] }) },
    { level: 'B1', exercise: choice('This is the book ___ I told you about.', ['that', 'what', 'who'], 0, 'that/which для предметов.', { s: 'grammar', t: 'conjunctions' }) },
    { level: 'B2', exercise: fill('If I had known, I would ___ come.', ['have'], 'would have + V3.', { s: 'grammar', t: 'conditionals' }, { options: ['have', 'has', 'had'] }) },
    { level: 'B2', exercise: choice('The bridge ___ in 1890.', ['was built', 'built', 'has built'], 0, 'Пассив в прошедшем: was built.', { s: 'grammar', t: 'passive' }) },
    { level: 'B2', exercise: choice('I wish I ___ more time.', ['had', 'have', 'will have'], 0, 'wish + Past Simple.', { s: 'grammar', t: 'conditionals' }) },
  ],
};
