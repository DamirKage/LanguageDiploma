import { choice, choiceRu, dialogue, fill, listen, match, order, speak, translate, translateBack, type LanguageSpec } from '../builders';

export const spanish: LanguageSpec = {
  code: 'es',
  name: 'Испанский',
  nativeName: 'Español',
  ttsLocale: 'es-ES',
  specialChars: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'],
  order: 5,
  courses: [
    {
      level: 'A1',
      title: 'Испанский A1: первые шаги',
      description: 'Приветствия, ser и estar, числа, семья и кафе. Род существительных и артикли.',
      modules: [
        {
          title: 'Знакомство',
          description: 'Приветствия, глагол ser и числа.',
          lessons: [
            {
              key: 'es-a1-greetings',
              title: 'Привет и знакомство',
              objective: 'Поздороваться, представиться и спросить, как дела.',
              topic: 'greetings',
              minutes: 8,
              theory: [
                {
                  title: 'Перевёрнутые знаки',
                  body: 'В испанском вопрос и восклицание открываются перевёрнутым знаком: ¿Cómo estás? ¡Hola! Это помогает читать с правильной интонацией с самого начала фразы.',
                  examples: [
                    ['¿Cómo te llamas?', 'Как тебя зовут?'],
                    ['¡Mucho gusto!', 'Очень приятно!'],
                  ],
                },
                {
                  title: 'tú и usted',
                  body: 'tú — «ты», usted — вежливое «Вы». С usted глагол спрягается как с «он/она»: ¿Cómo está usted?',
                },
              ],
              words: [
                ['hola', 'привет', 'interjection', '¡Hola! ¿Qué tal?', 'Привет! Как дела?'],
                ['buenos días', 'доброе утро, добрый день', 'phrase', 'Buenos días, señora.', 'Доброе утро, сеньора.'],
                ['adiós', 'до свидания', 'interjection', 'Adiós, hasta mañana.', 'До свидания, до завтра.'],
                ['gracias', 'спасибо', 'interjection', 'Muy bien, gracias.', 'Очень хорошо, спасибо.'],
                ['llamarse', 'называться, зваться', 'verb', 'Me llamo Aliya.', 'Меня зовут Алия.'],
                ['mucho gusto', 'очень приятно', 'phrase', 'Mucho gusto, Carlos.', 'Очень приятно, Карлос.'],
              ],
              exercises: [
                choice('Как ответить на «¿Cómo estás?»', ['Bien, gracias.', 'Me llamo Ana.', '¡Adiós!'], 0, '¿Cómo estás? — «Как дела?» Ответ: Bien, gracias.'),
                match(
                  [
                    ['hola', 'привет'],
                    ['adiós', 'до свидания'],
                    ['gracias', 'спасибо'],
                    ['buenas noches', 'доброй ночи'],
                  ],
                  'buenas noches — и «добрый вечер» (поздно), и «спокойной ночи».',
                ),
                fill('Me ___ Aliya.', ['llamo'], 'Me llamo … — «Меня зовут …», от глагола llamarse.', { s: 'grammar', t: 'present_tense' }, { translation: 'Меня зовут Алия.', options: ['llamo', 'llama', 'llamas'] }),
                dialogue(
                  [
                    ['A', '¡Hola! ¿Cómo te llamas?', 'Привет! Как тебя зовут?'],
                    ['B', null],
                    ['A', 'Mucho gusto.', 'Очень приятно.'],
                  ],
                  ['Me llamo Daniyar.', 'Estoy bien.', 'Adiós.'],
                  0,
                  'На ¿Cómo te llamas? отвечают Me llamo …',
                ),
                choice('Как вежливо спросить пожилого человека, как у него дела?', ['¿Cómo está usted?', '¿Cómo estás tú?', '¿Qué tal, amigo?'], 0, 'usted — вежливое обращение; глагол в форме 3-го лица: está.', { s: 'grammar', t: 'pronouns', d: 2 }),
                translate('Привет, меня зовут Анна.', ['Hola, me llamo Ana.', 'Hola, me llamo Anna.', 'Hola, soy Ana.', 'Hola, soy Anna.'], 'Me llamo … или Soy … — оба варианта естественны.'),
                listen('Buenos días.', 'días — с ударением на í.', {}, { options: ['Buenos días.', 'Buenas noches.', 'Buenas tardes.'], translation: 'Доброе утро.' }),
                speak('Mucho gusto.', 'Очень приятно.', 'ch читается как «ч»; g перед u — твёрдое.'),
              ],
            },
            {
              key: 'es-a1-ser',
              title: 'Кто я и откуда',
              objective: 'Рассказать о себе с глаголом ser: имя, профессия, происхождение.',
              topic: 'to_be',
              minutes: 10,
              theory: [
                {
                  title: 'ser — постоянные характеристики',
                  body: 'ser используют для имени, профессии, национальности и происхождения: Soy Aliya. Soy estudiante. Soy de Kazajistán. Формы: yo soy, tú eres, él/ella/usted es, nosotros somos, vosotros sois, ellos son.',
                  examples: [
                    ['Somos de Almaty.', 'Мы из Алматы.'],
                    ['Ella es médica.', 'Она врач.'],
                  ],
                },
                {
                  title: 'Род профессий',
                  body: 'Многие профессии меняют окончание: profesor — profesora, médico — médica. Артикль перед профессией после ser не ставится: Soy ingeniero.',
                },
              ],
              words: [
                ['ser', 'быть (постоянно)', 'verb', 'Soy estudiante.', 'Я студент.'],
                ['estudiante', 'студент, студентка', 'noun', 'Ella es estudiante.', 'Она студентка.', 'mf'],
                ['profesora', 'преподавательница', 'noun', 'Mi madre es profesora.', 'Моя мама — преподаватель.', 'f'],
                ['médico', 'врач', 'noun', 'Mi padre es médico.', 'Мой отец — врач.', 'm'],
                ['ciudad', 'город', 'noun', 'Astana es una ciudad moderna.', 'Астана — современный город.', 'f'],
                ['país', 'страна', 'noun', 'España es un país bonito.', 'Испания — красивая страна.', 'm'],
                ['vivir', 'жить', 'verb', 'Vivo en Almaty.', 'Я живу в Алматы.'],
              ],
              exercises: [
                fill('Yo ___ estudiante.', ['soy'], 'yo → soy.', {}, { options: ['soy', 'eres', 'es', 'somos'] }),
                fill('Nosotros ___ de Kazajistán.', ['somos'], 'nosotros → somos.', {}, { options: ['soy', 'es', 'somos', 'son'] }),
                fill('Tú ___ muy simpático.', ['eres'], 'tú → eres.', { d: 2 }, { options: ['soy', 'eres', 'es'] }),
                match(
                  [
                    ['yo', 'soy'],
                    ['tú', 'eres'],
                    ['ella', 'es'],
                    ['ellos', 'son'],
                  ],
                  'Спряжение ser неправильное, его нужно выучить.',
                  { s: 'grammar' },
                ),
                choice('Как сказать «Она врач»?', ['Ella es médica.', 'Ella es una la médica.', 'Ella médica.'], 0, 'Профессия после ser — без артикля, форма женского рода médica.', { s: 'grammar', t: 'noun_gender', d: 2 }),
                order(['Mi', 'padre', 'es', 'de', 'Shymkent'], 'Мой отец из Шымкента.', 'Порядок слов как в русском: подлежащее — глагол — дополнение.'),
                translate('Я живу в Астане.', ['Vivo en Astana.', 'Yo vivo en Astana.'], 'Местоимение yo часто опускают: окончание -o уже показывает лицо.', { s: 'grammar', t: 'present_tense' }),
                translateBack('Somos estudiantes.', ['Мы студенты', 'Мы студентки'], 'somos — «мы есть», в русском опускается.'),
                speak('Soy de Kazajistán.', 'Я из Казахстана.', 'j в Kazajistán — глухое «х», ударение на последний слог.'),
              ],
            },
            {
              key: 'es-a1-numbers',
              title: 'Числа и возраст',
              objective: 'Называть числа до 100 и говорить о возрасте с глаголом tener.',
              topic: 'numbers',
              minutes: 9,
              theory: [
                {
                  title: 'Возраст через tener',
                  body: 'В испанском возраст «имеют»: Tengo veinte años — дословно «Имею двадцать лет». Вопрос: ¿Cuántos años tienes?',
                  examples: [
                    ['Tengo diecinueve años.', 'Мне девятнадцать лет.'],
                  ],
                },
                {
                  title: 'Числа 16–29 пишутся слитно',
                  body: 'dieciséis, diecisiete, veintiuno, veinticinco. Начиная с 31 — через y: treinta y uno, cuarenta y cinco.',
                },
              ],
              words: [
                ['uno', 'один', 'numeral', 'Tengo un hermano.', 'У меня один брат.'],
                ['doce', 'двенадцать', 'numeral', 'Son las doce.', 'Сейчас двенадцать.'],
                ['veinte', 'двадцать', 'numeral', 'Tengo veinte años.', 'Мне двадцать лет.'],
                ['treinta', 'тридцать', 'numeral', 'Mi madre tiene treinta y nueve años.', 'Маме тридцать девять лет.'],
                ['tener', 'иметь', 'verb', '¿Cuántos años tienes?', 'Сколько тебе лет?'],
                ['año', 'год', 'noun', 'Un año tiene doce meses.', 'В году двенадцать месяцев.', 'm'],
              ],
              exercises: [
                match(
                  [
                    ['tres', '3'],
                    ['doce', '12'],
                    ['veinte', '20'],
                    ['cincuenta', '50'],
                  ],
                  'Основные числа для цен и возраста.',
                ),
                choice('Как сказать «Мне 25 лет»?', ['Tengo veinticinco años.', 'Soy veinticinco años.', 'Estoy veinticinco años.'], 0, 'Возраст выражается глаголом tener — «иметь».', { s: 'grammar', t: 'to_be', d: 2 }),
                fill('¿Cuántos años ___?', ['tienes'], 'tú → tienes (от tener).', { s: 'grammar', t: 'questions', d: 2 }, { options: ['tienes', 'eres', 'tengo'] }),
                listen('cuarenta y siete', 'cuarenta — 40, siete — 7.', {}, { options: ['47', '74', '27'], answers: ['47'] }),
                choiceRu('Что это за число?', 'sesenta y dos', ['62', '26', '72'], 0, 'sesenta (60) y dos (2). Не путайте sesenta (60) и setenta (70).', { d: 2 }),
                translate('Сколько тебе лет?', ['¿Cuántos años tienes?', 'Cuántos años tienes?'], 'cuántos — «сколько», años — «лет».', { s: 'grammar', t: 'questions' }),
                dialogue(
                  [
                    ['A', '¿Cuántos años tiene tu hermana?', 'Сколько лет твоей сестре?'],
                    ['B', null],
                  ],
                  ['Tiene dieciséis años.', 'Es dieciséis años.', 'Tengo una hermana.'],
                  0,
                  'О третьем лице: tiene … años.',
                ),
                speak('Tengo veinte años.', 'Мне двадцать лет.', 'ñ в слове años — мягкое «нь»: [аньос].'),
              ],
            },
          ],
        },
        {
          title: 'Мой мир',
          description: 'Семья и кафе.',
          lessons: [
            {
              key: 'es-a1-family',
              title: 'Моя семья',
              objective: 'Рассказать о семье, используя притяжательные mi / mis и род существительных.',
              topic: 'family',
              minutes: 10,
              theory: [
                {
                  title: 'mi и mis',
                  body: 'Притяжательное перед существительным меняется только по числу: mi hermano, mi hermana, mis padres. Это проще, чем в русском, где «мой/моя/моё».',
                  examples: [
                    ['Mi hermana se llama Dana.', 'Мою сестру зовут Дана.'],
                    ['Mis padres viven en Almaty.', 'Мои родители живут в Алматы.'],
                  ],
                },
                {
                  title: 'Род: -o и -a',
                  body: 'Существительные на -o обычно мужского рода (el hermano), на -a — женского (la hermana). Множественное число мужского рода может обозначать смешанную группу: los padres — «родители», los hermanos — «братья и сёстры».',
                },
              ],
              words: [
                ['la familia', 'семья', 'noun', 'Mi familia es grande.', 'Моя семья большая.', 'f'],
                ['la madre', 'мать', 'noun', 'Mi madre es profesora.', 'Моя мама — преподаватель.', 'f'],
                ['el padre', 'отец', 'noun', 'Mi padre trabaja mucho.', 'Мой отец много работает.', 'm'],
                ['el hermano', 'брат', 'noun', 'Tengo un hermano mayor.', 'У меня есть старший брат.', 'm'],
                ['la hermana', 'сестра', 'noun', 'Mi hermana tiene diez años.', 'Моей сестре десять лет.', 'f'],
                ['los padres', 'родители', 'noun', 'Mis padres son de Taraz.', 'Мои родители из Тараза.', 'm'],
                ['el hijo', 'сын', 'noun', 'Tienen dos hijos.', 'У них двое детей.', 'm'],
              ],
              exercises: [
                match(
                  [
                    ['la madre', 'мать'],
                    ['el padre', 'отец'],
                    ['los padres', 'родители'],
                    ['la hermana', 'сестра'],
                  ],
                  'los padres — «родители», а не «отцы».',
                ),
                fill('___ padres viven en Taraz.', ['Mis'], 'padres — множественное число, поэтому mis.', { s: 'grammar', t: 'possessive' }, { options: ['Mi', 'Mis'] }),
                fill('___ hermana es médica.', ['Mi'], 'hermana — единственное число: mi.', { s: 'grammar', t: 'possessive' }, { options: ['Mi', 'Mis'] }),
                choice('Какой артикль у слова hermano?', ['el', 'la', 'los'], 0, 'hermano — мужского рода, единственное число: el.', { s: 'grammar', t: 'articles' }),
                translate('У меня есть брат и сестра.', ['Tengo un hermano y una hermana.'], 'tener — «иметь»; un/una согласуются с родом.', { s: 'grammar', t: 'articles', d: 2 }),
                translateBack('Mis padres tienen tres hijos.', ['У моих родителей трое детей', 'У моих родителей три ребёнка'], 'hijos — «дети» (сыновья и дочери).', { d: 2 }),
                order(['Mi', 'familia', 'es', 'muy', 'grande'], 'Моя семья очень большая.', 'Прилагательное grande стоит после глагола es.'),
                speak('Esta es mi familia.', 'Это моя семья.', 'Ударение в familia — на второй слог: фа-ми́-лья.'),
              ],
            },
            {
              key: 'es-a1-cafe',
              title: 'В кафе',
              objective: 'Заказать еду и напитки, попросить счёт и узнать цену.',
              topic: 'food',
              minutes: 10,
              theory: [
                {
                  title: 'Вежливый заказ',
                  body: 'Quiero … («хочу») в кафе звучит нормально, но вежливее Quisiera … или ¿Me pone …? (в Испании). Счёт: La cuenta, por favor.',
                  examples: [
                    ['Quisiera un café con leche.', 'Я бы хотел кофе с молоком.'],
                    ['¿Cuánto es?', 'Сколько с меня?'],
                  ],
                },
              ],
              words: [
                ['el café', 'кофе; кафе', 'noun', 'Un café, por favor.', 'Кофе, пожалуйста.', 'm'],
                ['el agua', 'вода', 'noun', 'Un agua sin gas, por favor.', 'Воду без газа, пожалуйста.', 'f'],
                ['la cuenta', 'счёт', 'noun', 'La cuenta, por favor.', 'Счёт, пожалуйста.', 'f'],
                ['por favor', 'пожалуйста', 'phrase', 'Un té, por favor.', 'Чай, пожалуйста.'],
                ['la carta', 'меню', 'noun', '¿Me trae la carta?', 'Принесёте меню?', 'f'],
                ['cuánto', 'сколько', 'adverb', '¿Cuánto cuesta?', 'Сколько стоит?'],
              ],
              exercises: [
                choice('Как попросить счёт?', ['La cuenta, por favor.', 'La carta, gracias.', 'Soy la cuenta.'], 0, 'cuenta — «счёт», carta — «меню».'),
                fill('___ un café con leche.', ['Quisiera', 'Quiero'], 'Quisiera — вежливое «я бы хотел».', { s: 'grammar', t: 'modal_verbs', d: 2 }, { options: ['Quisiera', 'Soy', 'Tengo'] }),
                match(
                  [
                    ['la cuenta', 'счёт'],
                    ['la carta', 'меню'],
                    ['el agua', 'вода'],
                    ['el café', 'кофе'],
                  ],
                  'el agua — женского рода, но с артиклем el для благозвучия (ударное a в начале).',
                ),
                dialogue(
                  [
                    ['A', '¿Qué desea tomar?', 'Что желаете выпить?'],
                    ['B', null],
                    ['A', 'Muy bien. ¿Algo más?', 'Хорошо. Что-нибудь ещё?'],
                  ],
                  ['Un zumo de naranja, por favor.', 'Me llamo Zumo.', '¡Adiós!'],
                  0,
                  'Официант спрашивает, что вы будете пить.',
                  {},
                  'Вы в кафе в Мадриде.',
                ),
                translate('Сколько это стоит?', ['¿Cuánto cuesta?', '¿Cuánto es?', 'Cuánto cuesta?', 'Cuánto es?'], '¿Cuánto cuesta? — «Сколько стоит?», ¿Cuánto es? — «Сколько с меня?»', { t: 'questions', s: 'grammar' }),
                listen('La cuenta, por favor.', 'Счёт просят этой фразой в любой испаноязычной стране.', {}, { translation: 'Счёт, пожалуйста.' }),
                order(['Quisiera', 'un', 'agua', 'sin', 'gas'], 'Я бы хотел воду без газа.', 'sin — «без».'),
                speak('Un café, por favor.', 'Кофе, пожалуйста.', 'Ударение в café на последний слог — его показывает знак á/é.'),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'A2',
      title: 'Испанский A2: события и поездки',
      description: 'Pretérito indefinido, ser и estar, ориентирование в городе.',
      modules: [
        {
          title: 'Истории и поездки',
          description: 'Рассказ о прошлом и путешествия.',
          lessons: [
            {
              key: 'es-a2-preterite',
              title: 'Что было вчера',
              objective: 'Рассказать о завершённых событиях в pretérito indefinido.',
              topic: 'past_events',
              minutes: 12,
              theory: [
                {
                  title: 'Pretérito indefinido',
                  body: 'Для завершённых действий в прошлом: ayer, el año pasado. Правильные глаголы на -ar: hablé, hablaste, habló; на -er/-ir: comí, comiste, comió. Частые неправильные: ir/ser → fui, fuiste, fue; hacer → hice, hizo.',
                  examples: [
                    ['Ayer comí paella.', 'Вчера я ел паэлью.'],
                    ['El verano pasado fuimos a Barcelona.', 'Прошлым летом мы ездили в Барселону.'],
                  ],
                },
              ],
              words: [
                ['ayer', 'вчера', 'adverb', 'Ayer trabajé mucho.', 'Вчера я много работал.'],
                ['fui', 'я пошёл / я был (ir, ser)', 'verb', 'Fui al cine con mis amigos.', 'Я ходил в кино с друзьями.'],
                ['comer', 'есть', 'verb', 'Comimos en un restaurante.', 'Мы поели в ресторане.'],
                ['hablar', 'говорить', 'verb', 'Hablé con mi madre.', 'Я поговорил с мамой.'],
                ['el fin de semana', 'выходные', 'noun', '¿Qué hiciste el fin de semana?', 'Что ты делал на выходных?', 'm'],
                ['pasado', 'прошлый', 'adjective', 'El año pasado viajé a México.', 'В прошлом году я ездил в Мексику.'],
              ],
              exercises: [
                fill('Ayer ___ con mi madre.', ['hablé'], 'hablar → yo hablé (ударение на последний слог).', { s: 'grammar', t: 'past_tense' }, { options: ['hablé', 'hablo', 'habló'] }),
                fill('El sábado ___ al cine.', ['fui'], 'ir → yo fui.', { s: 'grammar', t: 'past_tense', d: 2 }, { options: ['fui', 'voy', 'fue'] }),
                choiceRu('Что означает эта форма?', 'hizo', ['он сделал', 'я делаю', 'мы сделали'], 0, 'hacer → él/ella hizo.', { s: 'grammar', t: 'past_tense', d: 2 }),
                match(
                  [
                    ['hablar', 'hablé'],
                    ['comer', 'comí'],
                    ['ir', 'fui'],
                    ['hacer', 'hice'],
                  ],
                  'Форма yo в pretérito indefinido.',
                  { s: 'grammar', t: 'past_tense' },
                ),
                translate('Что ты делал на выходных?', ['¿Qué hiciste el fin de semana?', 'Qué hiciste el fin de semana?'], 'hacer → tú hiciste.', { s: 'grammar', t: 'past_tense', d: 3 }),
                listen('Comimos en un restaurante.', 'comimos — «мы поели».', {}, { translation: 'Мы поели в ресторане.' }),
                order(['El', 'año', 'pasado', 'viajé', 'a', 'México'], 'В прошлом году я ездил в Мексику.', 'Обстоятельство времени часто ставят в начало.', {}, { alternatives: [['Viajé', 'a', 'México', 'el', 'año', 'pasado']] }),
                translateBack('Ayer no fui a clase.', ['Вчера я не пошёл на занятия', 'Вчера я не ходил на занятия'], 'no fui — «не пошёл».'),
              ],
            },
            {
              key: 'es-a2-travel',
              title: 'В дороге: ser и estar',
              objective: 'Спросить дорогу и описать местоположение с глаголом estar.',
              topic: 'travel',
              minutes: 11,
              theory: [
                {
                  title: 'ser или estar',
                  body: 'Оба переводятся как «быть». ser — что это и какое по сути (профессия, происхождение, характер). estar — где находится и в каком состоянии сейчас: El museo está en el centro. Estoy cansado.',
                  examples: [
                    ['La estación está a la derecha.', 'Вокзал справа.'],
                    ['Madrid es una ciudad grande.', 'Мадрид — большой город.'],
                  ],
                },
              ],
              words: [
                ['estar', 'находиться; быть (временно)', 'verb', '¿Dónde está la estación?', 'Где вокзал?'],
                ['la estación', 'вокзал, станция', 'noun', 'La estación está cerca.', 'Вокзал рядом.', 'f'],
                ['a la derecha', 'справа, направо', 'phrase', 'Gire a la derecha.', 'Поверните направо.'],
                ['a la izquierda', 'слева, налево', 'phrase', 'El banco está a la izquierda.', 'Банк слева.'],
                ['todo recto', 'прямо', 'phrase', 'Siga todo recto.', 'Идите прямо.'],
                ['el billete', 'билет', 'noun', 'Un billete para Sevilla, por favor.', 'Билет до Севильи, пожалуйста.', 'm'],
              ],
              exercises: [
                fill('¿Dónde ___ la estación?', ['está'], 'Местоположение — estar.', { s: 'grammar', t: 'ser_estar', d: 2 }, { options: ['es', 'está', 'son'] }),
                fill('Madrid ___ una ciudad muy bonita.', ['es'], 'Характеристика города — ser.', { s: 'grammar', t: 'ser_estar', d: 2 }, { options: ['es', 'está'] }),
                fill('Hoy ___ muy cansado.', ['estoy'], 'Временное состояние — estar: estoy cansado.', { s: 'grammar', t: 'ser_estar', d: 2 }, { options: ['soy', 'estoy'] }),
                match(
                  [
                    ['a la derecha', 'направо'],
                    ['a la izquierda', 'налево'],
                    ['todo recto', 'прямо'],
                    ['el billete', 'билет'],
                  ],
                  'Самые нужные слова для ориентирования.',
                ),
                dialogue(
                  [
                    ['A', 'Perdone, ¿dónde está el museo?', 'Простите, где музей?'],
                    ['B', null],
                  ],
                  ['Siga todo recto y gire a la izquierda.', 'Soy de Almaty.', 'Es un billete.'],
                  0,
                  'На вопрос о месте отвечают направлением.',
                ),
                translate('Билет до Севильи, пожалуйста.', ['Un billete para Sevilla, por favor.', 'Un billete a Sevilla, por favor.'], 'billete — «билет», para/a — «до».'),
                choice('Где ошибка?', ['El hotel es cerca de la playa.', 'El hotel está cerca de la playa.', 'El hotel es caro.'], 0, 'Местоположение выражается через estar: está cerca.', { s: 'grammar', t: 'ser_estar', d: 3 }),
                speak('¿Dónde está la estación?', 'Где вокзал?', 'Ударение в estación падает на последний слог (знак ó).'),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'B1',
      title: 'Испанский B1: мнения',
      description: 'Выражение мнения, creo que и no creo que + subjuntivo.',
      modules: [
        {
          title: 'Своё мнение',
          description: 'Аргументация и сомнение.',
          lessons: [
            {
              key: 'es-b1-opinions',
              title: 'Я думаю, что…',
              objective: 'Высказать мнение и сомнение, различая creo que и no creo que.',
              topic: 'opinions',
              minutes: 12,
              theory: [
                {
                  title: 'creo que + indicativo, no creo que + subjuntivo',
                  body: 'Утверждая мнение, используют обычное наклонение: Creo que es buena idea. Выражая сомнение или отрицание мнения — subjuntivo: No creo que sea buena idea. Аналога в русском нет, поэтому эта тема требует практики.',
                  examples: [
                    ['Creo que tienes razón.', 'Думаю, ты прав.'],
                    ['No creo que llueva hoy.', 'Не думаю, что сегодня будет дождь.'],
                  ],
                },
                {
                  title: 'Связки',
                  body: 'porque — «потому что», aunque — «хотя», sin embargo — «однако», en mi opinión — «по-моему».',
                },
              ],
              words: [
                ['creer', 'думать, верить', 'verb', 'Creo que es importante.', 'Думаю, это важно.'],
                ['la opinión', 'мнение', 'noun', 'En mi opinión, es caro.', 'По-моему, это дорого.', 'f'],
                ['porque', 'потому что', 'conjunction', 'Estudio español porque me gusta.', 'Я учу испанский, потому что он мне нравится.'],
                ['aunque', 'хотя', 'conjunction', 'Aunque es difícil, es útil.', 'Хотя это сложно, это полезно.'],
                ['la ventaja', 'преимущество', 'noun', 'Tiene muchas ventajas.', 'У этого много преимуществ.', 'f'],
                ['estar de acuerdo', 'соглашаться', 'phrase', 'Estoy de acuerdo contigo.', 'Я с тобой согласен.'],
              ],
              exercises: [
                fill('Creo que ___ una buena idea.', ['es'], 'После creo que — обычное наклонение: es.', { s: 'grammar', t: 'subjunctive', d: 2 }, { options: ['es', 'sea'] }),
                fill('No creo que ___ una buena idea.', ['sea'], 'После no creo que — subjuntivo: sea.', { s: 'grammar', t: 'subjunctive', d: 3 }, { options: ['es', 'sea'] }),
                choice('Как сказать «Я с тобой согласен»?', ['Estoy de acuerdo contigo.', 'Soy de acuerdo contigo.', 'Tengo acuerdo contigo.'], 0, 'Устойчивое выражение: estar de acuerdo.', { s: 'grammar', t: 'ser_estar', d: 2 }),
                match(
                  [
                    ['porque', 'потому что'],
                    ['aunque', 'хотя'],
                    ['sin embargo', 'однако'],
                    ['la ventaja', 'преимущество'],
                  ],
                  'Связки помогают строить аргумент.',
                ),
                translate('По-моему, это очень полезно.', ['En mi opinión, es muy útil.', 'Creo que es muy útil.', 'En mi opinión es muy útil.'], 'En mi opinión, … / Creo que …', { d: 2 }),
                dialogue(
                  [
                    ['A', '¿Crees que el examen será fácil?', 'Думаешь, экзамен будет лёгким?'],
                    ['B', null],
                  ],
                  ['No creo que sea fácil, pero estoy preparado.', 'No creo que es fácil.', 'Soy un examen.'],
                  0,
                  'Сомнение с no creo que требует subjuntivo: sea.',
                  { t: 'subjunctive', d: 3 },
                ),
                translateBack('Aunque es difícil, me gusta mucho.', ['Хотя это сложно, мне очень нравится', 'Хотя это трудно, мне очень нравится'], 'aunque — «хотя».', { d: 2 }),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'B2',
      title: 'Испанский B2: гипотезы',
      description: 'Si + imperfecto de subjuntivo + condicional.',
      modules: [
        {
          title: 'Если бы…',
          description: 'Нереальные условия.',
          lessons: [
            {
              key: 'es-b2-conditionals',
              title: 'Если бы у меня было время',
              objective: 'Говорить о нереальных ситуациях: si + imperfecto de subjuntivo.',
              topic: 'hypotheticals',
              minutes: 13,
              theory: [
                {
                  title: 'Si tuviera…, viajaría…',
                  body: 'Нереальное условие: si + imperfecto de subjuntivo (tuviera, fuera, pudiera), главная часть — condicional (viajaría, compraría). Si tuviera más tiempo, viajaría por América Latina.',
                  examples: [
                    ['Si fuera rico, compraría una casa.', 'Если бы я был богат, я бы купил дом.'],
                    ['¿Qué harías si ganaras la lotería?', 'Что бы ты сделал, если бы выиграл в лотерею?'],
                  ],
                },
              ],
              words: [
                ['si', 'если', 'conjunction', 'Si pudiera, iría.', 'Если бы мог, пошёл бы.'],
                ['tuviera', 'имел бы (tener)', 'verb', 'Si tuviera dinero, viajaría.', 'Если бы у меня были деньги, я бы путешествовал.'],
                ['viajar', 'путешествовать', 'verb', 'Me gustaría viajar más.', 'Мне хотелось бы больше путешествовать.'],
                ['me gustaría', 'мне хотелось бы', 'phrase', 'Me gustaría aprender a bailar.', 'Мне хотелось бы научиться танцевать.'],
                ['ojalá', 'хоть бы, дай бог', 'interjection', '¡Ojalá haga buen tiempo!', 'Хоть бы была хорошая погода!'],
              ],
              exercises: [
                fill('Si ___ más tiempo, viajaría más.', ['tuviera'], 'Нереальное условие: si + imperfecto de subjuntivo (tuviera).', { s: 'grammar', t: 'conditionals', d: 3 }, { options: ['tengo', 'tuviera', 'tendría'] }),
                fill('Si fuera rico, ___ una casa en la playa.', ['compraría'], 'Главная часть — condicional: compraría.', { s: 'grammar', t: 'conditionals', d: 3 }, { options: ['compro', 'compraría', 'comprara'] }),
                choice('Как вежливо выразить желание?', ['Me gustaría hablar con el director.', 'Quiero hablar con el director ya.', 'Hablo con el director.'], 0, 'Me gustaría — «мне хотелось бы», условное наклонение смягчает просьбу.', { s: 'grammar', t: 'conditionals', d: 2 }),
                order(['Si', 'pudiera', 'te', 'ayudaría'], 'Если бы я мог, я бы тебе помог.', 'si + subjuntivo, затем condicional.', { s: 'grammar', t: 'conditionals', d: 3 }),
                translate('Что бы ты сделал на моём месте?', ['¿Qué harías en mi lugar?', 'Qué harías en mi lugar?', '¿Qué harías tú en mi lugar?'], 'hacer → harías (condicional).', { s: 'grammar', t: 'conditionals', d: 3 }),
                translateBack('Si tuviera dinero, viajaría por todo el mundo.', ['Если бы у меня были деньги, я бы путешествовал по всему миру', 'Если бы у меня были деньги, я бы объездил весь мир'], 'tuviera … viajaría — нереальное условие.', { d: 3 }),
              ],
            },
          ],
        },
      ],
    },
  ],
  placement: [
    { level: 'A1', exercise: fill('Yo ___ de Kazajistán.', ['soy'], 'yo → soy.', { s: 'grammar', t: 'to_be' }, { options: ['soy', 'es', 'eres'] }) },
    { level: 'A1', exercise: choice('Как сказать «Мне 20 лет»?', ['Tengo veinte años.', 'Soy veinte años.', 'Estoy veinte años.'], 0, 'Возраст — tener.', { t: 'numbers' }) },
    { level: 'A1', exercise: choice('___ padres son médicos.', ['Mis', 'Mi', 'Me'], 0, 'Множественное число — mis.', { s: 'grammar', t: 'possessive' }) },
    { level: 'A2', exercise: fill('Ayer ___ al cine.', ['fui'], 'ir → fui.', { s: 'grammar', t: 'past_tense' }, { options: ['fui', 'voy', 'iré'] }) },
    { level: 'A2', exercise: choice('¿Dónde ___ el museo?', ['está', 'es', 'son'], 0, 'Местоположение — estar.', { s: 'grammar', t: 'ser_estar' }) },
    { level: 'A2', exercise: choice('El año pasado nosotros ___ en Madrid.', ['vivimos', 'vivo', 'viven'], 0, 'nosotros → vivimos.', { s: 'grammar', t: 'past_tense' }) },
    { level: 'B1', exercise: choice('No creo que ___ verdad.', ['sea', 'es', 'será'], 0, 'no creo que + subjuntivo.', { s: 'grammar', t: 'subjunctive' }) },
    { level: 'B1', exercise: fill('Cuando era niño, ___ en el campo.', ['vivía'], 'Привычное в прошлом — imperfecto.', { s: 'grammar', t: 'past_tense' }, { options: ['vivía', 'viví', 'vivo'] }) },
    { level: 'B1', exercise: choice('Espero que tú ___ bien.', ['estés', 'estás', 'estar'], 0, 'esperar que + subjuntivo.', { s: 'grammar', t: 'subjunctive' }) },
    { level: 'B2', exercise: fill('Si ___ tiempo, iría contigo.', ['tuviera'], 'si + imperfecto de subjuntivo.', { s: 'grammar', t: 'conditionals' }, { options: ['tuviera', 'tengo', 'tendría'] }) },
    { level: 'B2', exercise: choice('Si me lo hubieras dicho, te ___ ayudado.', ['habría', 'había', 'hubiera ido'], 0, 'Нереальное прошлое: habría + participio.', { s: 'grammar', t: 'conditionals' }) },
    { level: 'B2', exercise: choice('La casa ___ construida en 1900.', ['fue', 'era', 'estuvo'], 0, 'Пассив: fue construida.', { s: 'grammar', t: 'passive' }) },
  ],
};
