import { choice, choiceRu, dialogue, fill, listen, match, order, speak, translate, translateBack, type LanguageSpec } from '../builders';

export const turkish: LanguageSpec = {
  code: 'tr',
  name: 'Турецкий',
  nativeName: 'Türkçe',
  ttsLocale: 'tr-TR',
  specialChars: ['ç', 'ğ', 'ı', 'İ', 'ö', 'ş', 'ü'],
  order: 3,
  courses: [
    {
      level: 'A1',
      title: 'Турецкий A1: первые шаги',
      description: 'Приветствия, личные окончания, числа, семья и кафе. Гармония гласных с первого урока.',
      modules: [
        {
          title: 'Знакомство',
          description: 'Приветствия, «я — студент» и числа.',
          lessons: [
            {
              key: 'tr-a1-greetings',
              title: 'Привет и знакомство',
              objective: 'Поздороваться, представиться и попрощаться.',
              topic: 'greetings',
              minutes: 8,
              theory: [
                {
                  title: 'Кто говорит «Hoşça kal», а кто «Güle güle»',
                  body: 'Прощаются по-разному в зависимости от роли: тот, кто уходит, говорит Hoşça kal («оставайся счастливо»), а тот, кто остаётся, — Güle güle («уходи с улыбкой»). Универсальный вариант — Görüşürüz («увидимся»).',
                },
                {
                  title: 'Буквы ı и i',
                  body: 'В турецком две разные буквы: ı без точки (звук близок к русскому «ы») и i с точкой (как «и»). Заглавные: I и İ. Это разные звуки: kız — «девочка», kiz такого слова нет.',
                  examples: [
                    ['Adın ne?', 'Как тебя зовут?'],
                    ['Memnun oldum.', 'Очень приятно.'],
                  ],
                },
              ],
              words: [
                ['merhaba', 'здравствуйте, привет', 'interjection', 'Merhaba, benim adım Aliya.', 'Здравствуйте, меня зовут Алия.'],
                ['günaydın', 'доброе утро', 'interjection', 'Günaydın! Nasılsın?', 'Доброе утро! Как дела?'],
                ['teşekkürler', 'спасибо', 'interjection', 'İyiyim, teşekkürler.', 'Я в порядке, спасибо.'],
                ['nasılsın', 'как дела', 'phrase', 'Merhaba Ayşe, nasılsın?', 'Привет, Айше, как дела?'],
                ['memnun oldum', 'очень приятно', 'phrase', 'Ben Can. — Memnun oldum.', 'Я Джан. — Очень приятно.'],
                ['görüşürüz', 'увидимся', 'phrase', 'Yarın görüşürüz!', 'Увидимся завтра!'],
                ['ad', 'имя', 'noun', 'Senin adın ne?', 'Как тебя зовут?'],
              ],
              exercises: [
                choice('Как ответить на «Nasılsın?»', ['İyiyim, teşekkürler.', 'Benim adım Ali.', 'Güle güle!'], 0, 'Nasılsın? — «Как дела?». Ответ: İyiyim — «я в порядке».'),
                match(
                  [
                    ['merhaba', 'здравствуйте'],
                    ['günaydın', 'доброе утро'],
                    ['teşekkürler', 'спасибо'],
                    ['görüşürüz', 'увидимся'],
                  ],
                  'Базовые слова первого разговора.',
                ),
                fill('Benim ___ Daniyar.', ['adım'], 'Benim adım … — «Меня зовут …», дословно «моё имя».', { s: 'grammar', t: 'possessive' }, { translation: 'Меня зовут Данияр.', options: ['adım', 'adın', 'ad'] }),
                dialogue(
                  [
                    ['A', 'Merhaba! Ben Elif.', 'Привет! Я Элиф.'],
                    ['B', null],
                  ],
                  ['Memnun oldum, Elif. Ben Arman.', 'Güle güle, Elif.', 'İyi geceler.'],
                  0,
                  'При знакомстве отвечают Memnun oldum и называют себя.',
                ),
                choice('Вы уходите из гостей. Что вы скажете хозяевам?', ['Hoşça kalın!', 'Güle güle!', 'Günaydın!'], 0, 'Уходящий говорит Hoşça kal(ın), остающийся — Güle güle.', { s: 'reading', c: 'comprehension', d: 2 }),
                listen('İyi akşamlar!', 'akşam — «вечер».', {}, { options: ['İyi akşamlar!', 'İyi geceler!', 'Günaydın!'], translation: 'Добрый вечер!' }),
                translate('Привет, как дела?', ['Merhaba, nasılsın?', 'Selam, nasılsın?'], 'nasılsın — «как ты?»'),
                speak('Memnun oldum.', 'Очень приятно.', 'Ударение в турецком обычно на последний слог: мемну́н олду́м.'),
              ],
            },
            {
              key: 'tr-a1-personal-endings',
              title: 'Кто я и откуда',
              objective: 'Рассказать о себе с личными окончаниями: «Я студент», «Я из Казахстана».',
              topic: 'to_be',
              minutes: 11,
              theory: [
                {
                  title: 'Глагол «быть» — это окончание',
                  body: 'В турецком нет отдельного глагола «быть» в настоящем времени: вместо него к слову добавляется личное окончание. Ben öğrenciyim — «я студент», sen öğrencisin — «ты студент», o öğrenci — «он студент», biz öğrenciyiz — «мы студенты».',
                  examples: [
                    ['Ben doktorum.', 'Я врач.'],
                    ['Biz Kazakistanlıyız.', 'Мы из Казахстана.'],
                  ],
                },
                {
                  title: 'Гармония гласных',
                  body: 'Гласная окончания подстраивается под последнюю гласную слова: doktor → doktorum (o → u), öğretmen → öğretmenim (e → i), Kazakistanlı → Kazakistanlıyım (ı → ı). После гласной появляется соединительная -y-: öğrenci-y-im.',
                },
              ],
              words: [
                ['öğrenci', 'студент, ученик', 'noun', 'Ben öğrenciyim.', 'Я студент.'],
                ['öğretmen', 'учитель', 'noun', 'Annem öğretmen.', 'Моя мама — учительница.'],
                ['doktor', 'врач', 'noun', 'Babam doktor.', 'Мой папа — врач.'],
                ['mühendis', 'инженер', 'noun', 'Ben mühendisim.', 'Я инженер.'],
                ['nereli', 'откуда (родом)', 'adverb', 'Nerelisin?', 'Откуда ты?'],
                ['şehir', 'город', 'noun', 'Almatı büyük bir şehir.', 'Алматы — большой город.'],
              ],
              exercises: [
                fill('Ben öğrenci___.', ['yim'], 'После гласной i — соединительная -y- и окончание -im: öğrenciyim.', { s: 'grammar', t: 'vowel_harmony', d: 2 }, { options: ['yim', 'im', 'sın'] }),
                fill('Ben doktor___.', ['um'], 'Последняя гласная o → окончание -um: doktorum.', { s: 'grammar', t: 'vowel_harmony', d: 2 }, { options: ['um', 'im', 'ım'] }),
                fill('Sen öğretmen___.', ['sin'], '«Ты» — окончание -sin (после e): öğretmensin.', { s: 'grammar', t: 'vowel_harmony', d: 2 }, { options: ['sin', 'sın', 'im'] }),
                match(
                  [
                    ['ben', 'я'],
                    ['sen', 'ты'],
                    ['o', 'он / она'],
                    ['biz', 'мы'],
                  ],
                  'В турецком нет рода: o — и «он», и «она», и «оно».',
                  { s: 'grammar', t: 'pronouns' },
                ),
                choice('Как сказать «Мы из Казахстана»?', ['Biz Kazakistanlıyız.', 'Biz Kazakistanlıyım.', 'Biz Kazakistan biz.'], 0, 'biz → окончание -(y)ız после ı: Kazakistanlıyız.', { s: 'grammar', t: 'vowel_harmony', d: 3 }),
                translate('Я инженер.', ['Ben mühendisim.', 'Mühendisim.'], 'mühendis + im. Местоимение ben можно опустить.', { s: 'grammar', t: 'to_be' }),
                translateBack('Sen nerelisin?', ['Откуда ты', 'Ты откуда'], 'nereli — «откуда родом», -sin — «ты».'),
                listen('Ben Kazakistanlıyım.', 'Kazakistanlı — «казахстанец», -yım — «я».', {}, { translation: 'Я из Казахстана.' }),
                speak('Ben öğrenciyim.', 'Я студент.', 'ğ почти не произносится, лишь удлиняет предыдущую гласную: [ө:ренджийим].'),
              ],
            },
            {
              key: 'tr-a1-numbers',
              title: 'Числа и возраст',
              objective: 'Называть числа до 100 и говорить о возрасте.',
              topic: 'numbers',
              minutes: 9,
              theory: [
                {
                  title: 'Числа строятся как в русском',
                  body: 'Сначала десятки, потом единицы, без союза: yirmi beş — 25, kırk iki — 42. Существительное после числа остаётся в единственном числе: iki kitap — «две книги».',
                },
                {
                  title: 'Сколько тебе лет?',
                  body: 'Kaç yaşındasın? — «Сколько тебе лет?» Ответ: Yirmi yaşındayım — «Мне двадцать лет».',
                  examples: [['Otuz yaşındayım.', 'Мне тридцать лет.']],
                },
              ],
              words: [
                ['bir', 'один', 'numeral', 'Bir çay lütfen.', 'Один чай, пожалуйста.'],
                ['beş', 'пять', 'numeral', 'Beş kardeşim var.', 'У меня пять братьев и сестёр.'],
                ['on', 'десять', 'numeral', 'Saat on.', 'Десять часов.'],
                ['yirmi', 'двадцать', 'numeral', 'Yirmi yaşındayım.', 'Мне двадцать лет.'],
                ['kaç', 'сколько', 'adverb', 'Kaç yaşındasın?', 'Сколько тебе лет?'],
                ['yaş', 'возраст', 'noun', 'Yaşın kaç?', 'Сколько тебе лет?'],
              ],
              exercises: [
                match(
                  [
                    ['üç', '3'],
                    ['yedi', '7'],
                    ['on', '10'],
                    ['elli', '50'],
                  ],
                  'Основные числа.',
                ),
                choice('Как будет 25?', ['yirmi beş', 'beş yirmi', 'yirmi ve beş'], 0, 'Десятки, затем единицы, без союза.', { s: 'grammar', d: 2 }),
                listen('kırk iki', 'kırk — 40, iki — 2.', {}, { options: ['42', '24', '52'], answers: ['42'] }),
                fill('Kaç ___?', ['yaşındasın'], 'Kaç yaşındasın? — «Сколько тебе лет?»', { s: 'grammar', t: 'questions', d: 2 }, { options: ['yaşındasın', 'yaşındayım', 'yaş'] }),
                translate('Мне двадцать лет.', ['Yirmi yaşındayım.', 'Ben yirmi yaşındayım.'], 'yaşında + -yım — «я в возрасте».', { s: 'grammar', d: 2 }),
                choiceRu('Что означает это слово?', 'iki kitap', ['две книги', 'одна книга', 'книги'], 0, 'После числа существительное остаётся в единственном числе: iki kitap.', { s: 'grammar', t: 'plural', d: 2 }),
                dialogue(
                  [
                    ['A', 'Kaç yaşındasın?', 'Сколько тебе лет?'],
                    ['B', null],
                  ],
                  ['On dokuz yaşındayım.', 'On dokuz kitap.', 'Ben öğrenciyim.'],
                  0,
                  'Ответ о возрасте: … yaşındayım.',
                ),
                speak('Yirmi yaşındayım.', 'Мне двадцать лет.', 'ı в yaşında — звук, похожий на «ы».'),
              ],
            },
          ],
        },
        {
          title: 'Мой мир',
          description: 'Семья и кафе.',
          lessons: [
            {
              key: 'tr-a1-family',
              title: 'Моя семья',
              objective: 'Рассказать о семье: притяжательные окончания и конструкция var / yok.',
              topic: 'family',
              minutes: 11,
              theory: [
                {
                  title: '«Мой» — это окончание',
                  body: 'Принадлежность выражается окончанием: anne → annem («моя мама»), baba → babam («мой папа»), kardeş → kardeşim («мой брат/сестра»). После гласной — -m, после согласной — -Im с гармонией гласных.',
                  examples: [
                    ['Annem öğretmen.', 'Моя мама — учительница.'],
                    ['Ablam İstanbul’da yaşıyor.', 'Моя старшая сестра живёт в Стамбуле.'],
                  ],
                },
                {
                  title: 'var и yok',
                  body: '«У меня есть» — …-im var: Bir kardeşim var. «У меня нет» — …-im yok: Arabam yok.',
                },
              ],
              words: [
                ['aile', 'семья', 'noun', 'Ailem büyük.', 'Моя семья большая.'],
                ['anne', 'мама', 'noun', 'Annemin adı Gülnara.', 'Мою маму зовут Гульнара.'],
                ['baba', 'папа', 'noun', 'Babam mühendis.', 'Мой папа — инженер.'],
                ['kardeş', 'брат или сестра', 'noun', 'İki kardeşim var.', 'У меня двое братьев/сестёр.'],
                ['abla', 'старшая сестра', 'noun', 'Ablam doktor.', 'Моя старшая сестра — врач.'],
                ['ağabey', 'старший брат', 'noun', 'Ağabeyim Ankara’da çalışıyor.', 'Мой старший брат работает в Анкаре.'],
                ['var', 'есть, имеется', 'adverb', 'Bir kız kardeşim var.', 'У меня есть младшая сестра.'],
              ],
              exercises: [
                match(
                  [
                    ['anne', 'мама'],
                    ['baba', 'папа'],
                    ['abla', 'старшая сестра'],
                    ['aile', 'семья'],
                  ],
                  'В турецком, как и в казахском, есть отдельные слова для старших брата и сестры.',
                ),
                fill('Anne___ öğretmen.', ['m'], 'После гласной притяжательное окончание — -m: annem.', { s: 'grammar', t: 'possessive' }, { options: ['m', 'im', 'ım'] }),
                fill('Kardeş___ var.', ['im'], 'После согласной с последней гласной e — -im: kardeşim.', { s: 'grammar', t: 'possessive', d: 2 }, { options: ['m', 'im', 'ım', 'um'] }),
                choice('Как сказать «У меня нет машины»?', ['Arabam yok.', 'Arabam var.', 'Ben araba yok.'], 0, 'Отсутствие — yok, а «моя машина» — arabam.', { s: 'grammar', t: 'possessive', d: 2 }),
                translate('У меня есть брат.', ['Bir erkek kardeşim var.', 'Erkek kardeşim var.', 'Bir kardeşim var.', 'Bir ağabeyim var.'], 'kardeş + im + var. erkek kardeş — «брат» (уточнение пола).', { s: 'grammar', t: 'possessive', d: 2 }),
                translateBack('Ailem çok büyük.', ['Моя семья очень большая', 'У меня очень большая семья'], 'aile + m — «моя семья».'),
                order(['Benim', 'iki', 'kardeşim', 'var'], 'У меня двое братьев (сестёр).', 'Конструкция: (Benim) … -im var.'),
                speak('Bu benim ailem.', 'Это моя семья.', 'ai в aile читается раздельно: а-и-ле.'),
              ],
            },
            {
              key: 'tr-a1-cafe',
              title: 'В кафе',
              objective: 'Заказать еду и напитки, попросить счёт и узнать цену.',
              topic: 'food',
              minutes: 10,
              theory: [
                {
                  title: 'Вежливый заказ',
                  body: 'Проще всего назвать блюдо и добавить lütfen: Bir çay lütfen. Вежливая просьба: …alabilir miyim? («можно мне …?»). Счёт: Hesap lütfen.',
                  examples: [
                    ['Bir çay ve bir su lütfen.', 'Один чай и одну воду, пожалуйста.'],
                    ['Menüyü alabilir miyim?', 'Можно меню?'],
                  ],
                },
                {
                  title: 'Вопросительная частица mi',
                  body: 'Общий вопрос задаётся частицей mi / mı / mu / mü, которая пишется отдельно и следует гармонии гласных: Çay var mı? — «Чай есть?»',
                },
              ],
              words: [
                ['çay', 'чай', 'noun', 'Türk çayı çok güzel.', 'Турецкий чай очень хороший.'],
                ['kahve', 'кофе', 'noun', 'Bir Türk kahvesi lütfen.', 'Один турецкий кофе, пожалуйста.'],
                ['su', 'вода', 'noun', 'Bir şişe su lütfen.', 'Бутылку воды, пожалуйста.'],
                ['hesap', 'счёт', 'noun', 'Hesap lütfen.', 'Счёт, пожалуйста.'],
                ['lütfen', 'пожалуйста', 'adverb', 'Bir çorba lütfen.', 'Суп, пожалуйста.'],
                ['ne kadar', 'сколько (стоит)', 'phrase', 'Bu ne kadar?', 'Сколько это стоит?'],
              ],
              exercises: [
                choice('Как попросить счёт?', ['Hesap lütfen.', 'Menü lütfen.', 'Hesap var.'], 0, 'hesap — «счёт», menü — «меню».'),
                fill('Çay var ___?', ['mı'], 'Последняя гласная a → частица mı.', { s: 'grammar', t: 'questions', d: 2 }, { options: ['mı', 'mi', 'mu', 'mü'] }),
                match(
                  [
                    ['çay', 'чай'],
                    ['kahve', 'кофе'],
                    ['su', 'вода'],
                    ['hesap', 'счёт'],
                  ],
                  'Основные слова для кафе.',
                ),
                dialogue(
                  [
                    ['A', 'Ne içmek istersiniz?', 'Что желаете выпить?'],
                    ['B', null],
                    ['A', 'Tabii, hemen getiriyorum.', 'Конечно, сейчас принесу.'],
                  ],
                  ['Bir çay lütfen.', 'Benim adım Çay.', 'Güle güle.'],
                  0,
                  'Официант спрашивает о напитке.',
                  {},
                  'Вы в кафе в Стамбуле.',
                ),
                translate('Сколько это стоит?', ['Bu ne kadar?', 'Ne kadar?', 'Bu kaç lira?'], 'ne kadar — «сколько».', { t: 'questions', s: 'grammar' }),
                listen('Menüyü alabilir miyim?', 'alabilir miyim — «могу ли я взять».', {}, { translation: 'Можно меню?' }),
                order(['Bir', 'çay', 've', 'bir', 'su', 'lütfen'], 'Один чай и одну воду, пожалуйста.', 've — «и».'),
                speak('Hesap lütfen.', 'Счёт, пожалуйста.', 'ü в lütfen — как «ю» без «й»: [лютфен].'),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'A2',
      title: 'Турецкий A2: события и поездки',
      description: 'Прошедшее время на -dı, падежи направления и места.',
      modules: [
        {
          title: 'Истории и поездки',
          description: 'Рассказ о прошлом и путешествия.',
          lessons: [
            {
              key: 'tr-a2-past',
              title: 'Что было вчера',
              objective: 'Рассказать о прошлом с окончанием -dı и вопросом «Ne yaptın?».',
              topic: 'past_events',
              minutes: 12,
              theory: [
                {
                  title: 'Окончание -dı',
                  body: 'Прошедшее время: основа + -dı/-di/-du/-dü (по гармонии гласных) + личное окончание: geldim, okudum, gördüm. После глухих согласных (ç, f, h, k, p, s, ş, t) d переходит в t: gittim, yaptım, içtim.',
                  examples: [
                    ['Dün sinemaya gittim.', 'Вчера я ходил в кино.'],
                    ['Kitap okudum.', 'Я читал книгу.'],
                  ],
                },
              ],
              words: [
                ['dün', 'вчера', 'adverb', 'Dün evdeydim.', 'Вчера я был дома.'],
                ['gitmek', 'идти, ехать', 'verb', 'Dün okula gittim.', 'Вчера я ходил в школу.'],
                ['yapmak', 'делать', 'verb', 'Hafta sonu ne yaptın?', 'Что ты делал на выходных?'],
                ['okumak', 'читать', 'verb', 'Bir kitap okudum.', 'Я прочитал книгу.'],
                ['görmek', 'видеть', 'verb', 'Güzel bir film gördüm.', 'Я посмотрел хороший фильм.'],
                ['hafta sonu', 'выходные', 'noun', 'Hafta sonu dinlendim.', 'На выходных я отдыхал.'],
              ],
              exercises: [
                fill('Dün sinemaya git___.', ['tim'], 'git- оканчивается на глухой t, поэтому -tim: gittim.', { s: 'grammar', t: 'past_tense', d: 2 }, { options: ['tim', 'dim', 'tım'] }),
                fill('Bir kitap oku___.', ['dum'], 'Последняя гласная u → -dum: okudum.', { s: 'grammar', t: 'past_tense', d: 2 }, { options: ['dum', 'dim', 'tum'] }),
                choice('Как спросить «Что ты делал на выходных?»', ['Hafta sonu ne yaptın?', 'Hafta sonu ne yapıyorsun?', 'Hafta sonu ne yapacaksın?'], 0, 'yaptın — прошедшее время, 2-е лицо.', { s: 'grammar', t: 'past_tense', d: 2 }),
                match(
                  [
                    ['geldim', 'я пришёл'],
                    ['gittim', 'я ушёл'],
                    ['gördüm', 'я увидел'],
                    ['içtim', 'я выпил'],
                  ],
                  'Формы 1-го лица в прошедшем времени.',
                  { s: 'grammar', t: 'past_tense' },
                ),
                translate('Вчера я посмотрел фильм.', ['Dün bir film izledim.', 'Dün film izledim.', 'Dün bir film gördüm.', 'Dün film gördüm.'], 'film izlemek / film görmek — «смотреть фильм».', { s: 'grammar', t: 'past_tense', d: 3 }),
                listen('Hafta sonu ne yaptın?', 'ne yaptın — «что ты сделал».', {}, { translation: 'Что ты делал на выходных?' }),
                order(['Dün', 'arkadaşımla', 'kahve', 'içtim'], 'Вчера я пил кофе с другом.', 'Сказуемое в турецком стоит в конце предложения.', { s: 'grammar', t: 'word_order', d: 2 }),
                translateBack('Dün çok çalıştım.', ['Вчера я много работал', 'Вчера я много занимался'], 'çalışmak — «работать; заниматься».'),
              ],
            },
            {
              key: 'tr-a2-travel',
              title: 'В дороге',
              objective: 'Спросить дорогу и купить билет: падежи -a/-e (куда) и -da/-de (где).',
              topic: 'travel',
              minutes: 12,
              theory: [
                {
                  title: 'Куда и где',
                  body: 'Направление — дательный падеж -(y)a/-(y)e: istasyona — «на вокзал», Ankara’ya — «в Анкару». Местоположение — -da/-de (после глухих -ta/-te): istasyonda — «на вокзале», İstanbul’da — «в Стамбуле». Окончания у имён собственных отделяются апострофом.',
                  examples: [
                    ['Ankara’ya bir bilet lütfen.', 'Один билет до Анкары, пожалуйста.'],
                    ['Otel merkezde.', 'Отель в центре.'],
                  ],
                },
              ],
              words: [
                ['istasyon', 'вокзал, станция', 'noun', 'İstasyon nerede?', 'Где вокзал?'],
                ['bilet', 'билет', 'noun', 'İzmir’e bir bilet lütfen.', 'Один билет до Измира, пожалуйста.'],
                ['nerede', 'где', 'adverb', 'Müze nerede?', 'Где музей?'],
                ['sağa', 'направо', 'adverb', 'Sağa dönün.', 'Поверните направо.'],
                ['sola', 'налево', 'adverb', 'Sola dönün.', 'Поверните налево.'],
                ['düz', 'прямо', 'adverb', 'Düz gidin.', 'Идите прямо.'],
              ],
              exercises: [
                fill('Ankara’___ bir bilet lütfen.', ['ya'], 'Направление — дательный падеж; после гласной a — -ya.', { s: 'grammar', t: 'cases', d: 2 }, { options: ['ya', 'da', 'ye'] }),
                fill('Otel merkez___.', ['de'], 'Местоположение — -de (последняя гласная e).', { s: 'grammar', t: 'cases', d: 2 }, { options: ['de', 'da', 'e'] }),
                choice('Как спросить, где вокзал?', ['İstasyon nerede?', 'İstasyon ne kadar?', 'İstasyon kim?'], 0, 'nerede — «где», ne kadar — «сколько», kim — «кто».', { t: 'questions', s: 'grammar' }),
                match(
                  [
                    ['sağa', 'направо'],
                    ['sola', 'налево'],
                    ['düz', 'прямо'],
                    ['bilet', 'билет'],
                  ],
                  'Слова для объяснения дороги.',
                ),
                dialogue(
                  [
                    ['A', 'Affedersiniz, müze nerede?', 'Простите, где музей?'],
                    ['B', null],
                  ],
                  ['Düz gidin, sonra sağa dönün.', 'Ben Kazakistanlıyım.', 'Bir çay lütfen.'],
                  0,
                  'На вопрос о дороге отвечают направлением.',
                ),
                translate('Я живу в Стамбуле.', ['İstanbul’da yaşıyorum.', 'Ben İstanbul’da yaşıyorum.', "İstanbul'da yaşıyorum.", "Ben İstanbul'da yaşıyorum."], 'Местоположение: İstanbul’da.', { s: 'grammar', t: 'cases', d: 3 }),
                listen('Tren saat sekizde kalkıyor.', 'kalkmak — «отправляться» (о транспорте).', {}, { translation: 'Поезд отправляется в восемь часов.' }),
                speak('Yardım edebilir misiniz?', 'Вы можете помочь?', 'Частица misiniz пишется отдельно, но произносится слитно с глаголом.'),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'B1',
      title: 'Турецкий B1: мнения',
      description: 'Bence, çünkü, katılıyorum: выражение и обоснование мнения.',
      modules: [
        {
          title: 'Своё мнение',
          description: 'Аргументация.',
          lessons: [
            {
              key: 'tr-b1-opinions',
              title: 'По-моему…',
              objective: 'Высказать мнение, согласиться или возразить и обосновать позицию.',
              topic: 'opinions',
              minutes: 12,
              theory: [
                {
                  title: 'Bence и Sence',
                  body: 'Bence — «по-моему», Sence — «по-твоему». Согласие: Katılıyorum. Несогласие: Katılmıyorum. Обоснование: çünkü — «потому что» (после него обычный порядок слов).',
                  examples: [
                    ['Bence bu çok iyi bir fikir.', 'По-моему, это очень хорошая идея.'],
                    ['Türkçe öğreniyorum çünkü Türkiye’de çalışmak istiyorum.', 'Я учу турецкий, потому что хочу работать в Турции.'],
                  ],
                },
              ],
              words: [
                ['bence', 'по-моему', 'adverb', 'Bence haklısın.', 'По-моему, ты прав.'],
                ['çünkü', 'потому что', 'conjunction', 'Evde kaldım çünkü hastaydım.', 'Я остался дома, потому что болел.'],
                ['katılmak', 'соглашаться; участвовать', 'verb', 'Sana katılıyorum.', 'Я с тобой согласен.'],
                ['fikir', 'идея, мнение', 'noun', 'Bu iyi bir fikir.', 'Это хорошая идея.'],
                ['önemli', 'важный', 'adjective', 'Eğitim çok önemli.', 'Образование очень важно.'],
                ['ama', 'но', 'conjunction', 'Pahalı ama güzel.', 'Дорого, но красиво.'],
              ],
              exercises: [
                choice('Как сказать «Я с тобой согласен»?', ['Sana katılıyorum.', 'Seni katılıyorum.', 'Sen katılıyorum.'], 0, 'katılmak требует дательного падежа: sana — «тебе».', { s: 'grammar', t: 'cases', d: 3 }),
                fill('___ bu çok önemli bir konu.', ['Bence'], 'Bence — «по-моему».', {}, { options: ['Bence', 'Sence', 'Çünkü'] }),
                fill('Evde kaldım ___ hastaydım.', ['çünkü'], 'Причина — çünkü.', { s: 'grammar', t: 'conjunctions', d: 2 }, { options: ['çünkü', 'ama', 'bence'] }),
                match(
                  [
                    ['bence', 'по-моему'],
                    ['çünkü', 'потому что'],
                    ['ama', 'но'],
                    ['önemli', 'важный'],
                  ],
                  'Слова для аргументации.',
                ),
                translate('По-моему, это хорошая идея.', ['Bence bu iyi bir fikir.', 'Bence iyi bir fikir.'], 'Bence + утверждение.', { d: 2 }),
                dialogue(
                  [
                    ['A', 'Sence uzaktan çalışmak daha iyi mi?', 'По-твоему, удалённая работа лучше?'],
                    ['B', null],
                  ],
                  ['Evet, bence daha iyi çünkü zaman kazanıyorum.', 'Evet, bence ben öğrenciyim.', 'Hesap lütfen.'],
                  0,
                  'Мнение с обоснованием: bence … çünkü …',
                  { t: 'conjunctions', d: 2 },
                ),
                translateBack('Pahalı ama çok kullanışlı.', ['Дорого, но очень удобно', 'Дорогой, но очень удобный'], 'ama — «но», kullanışlı — «удобный».', { d: 2 }),
              ],
            },
          ],
        },
      ],
    },
    {
      level: 'B2',
      title: 'Турецкий B2: гипотезы',
      description: 'Условное наклонение -sa/-se и нереальные условия.',
      modules: [
        {
          title: 'Если бы…',
          description: 'Нереальные условия и пожелания.',
          lessons: [
            {
              key: 'tr-b2-conditionals',
              title: 'Если бы у меня было время',
              objective: 'Говорить о реальных и нереальных условиях с -sa/-se и keşke.',
              topic: 'hypotheticals',
              minutes: 13,
              theory: [
                {
                  title: 'Реальное и нереальное условие',
                  body: 'Реальное: -(I)rsA — Yarın yağmur yağarsa evde kalırız («Если завтра пойдёт дождь, останемся дома»). Нереальное: -sA + -(A/I)rdI — Zamanım olsa daha çok seyahat ederdim («Если бы у меня было время, я бы больше путешествовал»).',
                  examples: [
                    ['Yerinde olsam beklerdim.', 'На твоём месте я бы подождал.'],
                    ['Keşke daha çok zamanım olsa.', 'Жаль, что у меня мало времени.'],
                  ],
                },
              ],
              words: [
                ['eğer', 'если', 'conjunction', 'Eğer gelirsen sevinirim.', 'Если придёшь, я буду рад.'],
                ['olsa', 'если бы был', 'verb', 'Param olsa bir ev alırdım.', 'Если бы были деньги, я бы купил дом.'],
                ['keşke', 'жаль что; хоть бы', 'interjection', 'Keşke burada olsan.', 'Жаль, что тебя здесь нет.'],
                ['seyahat etmek', 'путешествовать', 'verb', 'Seyahat etmeyi seviyorum.', 'Я люблю путешествовать.'],
                ['yerinde', 'на (твоём) месте', 'adverb', 'Yerinde olsam giderdim.', 'На твоём месте я бы пошёл.'],
              ],
              exercises: [
                fill('Zamanım ___ seyahat ederdim.', ['olsa'], 'Нереальное условие: olsa.', { s: 'grammar', t: 'conditionals', d: 3 }, { options: ['olsa', 'var', 'olur'] }),
                fill('Yarın yağmur yağar___ evde kalırız.', ['sa'], 'Реальное условие: yağar + sa.', { s: 'grammar', t: 'conditionals', d: 3 }, { options: ['sa', 'se', 'dı'] }),
                choice('Как сказать «На твоём месте я бы подождал»?', ['Yerinde olsam beklerdim.', 'Yerinde olursam bekledim.', 'Yerinde beklerim.'], 0, 'olsam + beklerdim — нереальное условие.', { s: 'grammar', t: 'conditionals', d: 3 }),
                order(['Param', 'olsa', 'bir', 'ev', 'alırdım'], 'Если бы у меня были деньги, я бы купил дом.', 'Условие -sa, затем главное сказуемое в конце.', { s: 'grammar', t: 'conditionals', d: 3 }),
                translate('Жаль, что тебя здесь нет.', ['Keşke burada olsan.', 'Keşke sen burada olsan.'], 'keşke + -sa — сожаление.', { s: 'grammar', t: 'conditionals', d: 3 }),
                translateBack('Eğer erken gelirsen birlikte yemek yeriz.', ['Если ты придёшь рано, мы поедим вместе', 'Если придёшь рано, поедим вместе'], 'gelirsen — реальное условие.', { d: 3 }),
              ],
            },
          ],
        },
      ],
    },
  ],
  placement: [
    { level: 'A1', exercise: choice('Как сказать «Я студент»?', ['Ben öğrenciyim.', 'Ben öğrenci var.', 'Ben öğrencisin.'], 0, 'öğrenci + yim.', { s: 'grammar', t: 'to_be' }) },
    { level: 'A1', exercise: fill('Anne___ doktor.', ['m'], 'annem — «моя мама».', { s: 'grammar', t: 'possessive' }, { options: ['m', 'im', 'n'] }) },
    { level: 'A1', exercise: choice('Kaç yaşındasın? — ___', ['Yirmi yaşındayım.', 'Yirmi kitap.', 'Ben yirmi.'], 0, '… yaşındayım.', { t: 'numbers' }) },
    { level: 'A2', exercise: fill('Dün sinemaya ___.', ['gittim'], 'gitmek → gittim.', { s: 'grammar', t: 'past_tense' }, { options: ['gittim', 'gidiyorum', 'giderim'] }) },
    { level: 'A2', exercise: choice('İstanbul’___ yaşıyorum.', ['da', 'a', 'dan'], 0, 'Местоположение — -da.', { s: 'grammar', t: 'cases' }) },
    { level: 'A2', exercise: choice('Çay var ___?', ['mı', 'mi', 'mu'], 0, 'Гармония: a → mı.', { s: 'grammar', t: 'questions' }) },
    { level: 'B1', exercise: choice('Sana ___.', ['katılıyorum', 'katılıyor', 'katılmak'], 0, 'Согласие: katılıyorum.', { t: 'opinions' }) },
    { level: 'B1', exercise: fill('Gelemedim ___ hastaydım.', ['çünkü'], 'Причина — çünkü.', { s: 'grammar', t: 'conjunctions' }, { options: ['çünkü', 'ama', 'eğer'] }) },
    { level: 'B1', exercise: choice('Yarın ne ___?', ['yapacaksın', 'yaptın', 'yapıyordun'], 0, 'Будущее время: -acak.', { s: 'grammar', t: 'present_tense' }) },
    { level: 'B2', exercise: fill('Zamanım ___ gelirdim.', ['olsa'], 'Нереальное условие.', { s: 'grammar', t: 'conditionals' }, { options: ['olsa', 'oldu', 'olur'] }) },
    { level: 'B2', exercise: choice('Bu ev 1990’da ___.', ['yapıldı', 'yaptı', 'yapıyor'], 0, 'Пассив: yapıldı.', { s: 'grammar', t: 'passive' }) },
    { level: 'B2', exercise: choice('Keşke burada ___.', ['olsan', 'oldun', 'olursun'], 0, 'keşke + -sa.', { s: 'grammar', t: 'conditionals' }) },
  ],
};
