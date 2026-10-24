import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { CEFR_LEVELS, ERROR_CATEGORIES, EXERCISE_TYPES, SKILLS, type Exercise, type ExerciseType, type LocalizedText } from '@linguapath/shared';
import { Button, Field, Select, Textarea, TextInput } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { useTopics } from '../../lib/queries';

type Raw = Record<string, unknown>;

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const loc = (v: unknown) => (v && typeof v === 'object' ? ((v as LocalizedText).ru ?? '') : typeof v === 'string' ? v : '');

/** Starting content for a new exercise of each type, so the form is never invalid by shape. */
export function exerciseTemplate(type: ExerciseType, key: string, topic: string): Exercise {
  const base = { key, topic, skill: 'grammar', errorCategory: 'grammar', difficulty: 1, explanation: { ru: '' } } as const;
  switch (type) {
    case 'choice':
      return { ...base, skill: 'vocabulary', errorCategory: 'vocabulary', type, question: { ru: '' }, optionsIn: 'target', options: ['', ''], correctIndex: 0 };
    case 'fill_blank':
      return { ...base, type, sentence: '___', answers: [''] };
    case 'translate':
      return { ...base, skill: 'vocabulary', errorCategory: 'vocabulary', type, direction: 'to_target', source: { ru: '' }, answers: [''] };
    case 'order':
      return { ...base, errorCategory: 'word_order', type, tokens: [], translation: { ru: '' } };
    case 'match':
      return { ...base, skill: 'vocabulary', errorCategory: 'vocabulary', type, pairs: [] };
    case 'listen':
      return { ...base, skill: 'listening', errorCategory: 'listening', type, audioText: '', mode: 'type', answers: [''] };
    case 'dialogue':
      return { ...base, skill: 'reading', errorCategory: 'comprehension', type, lines: [], options: ['', ''], correctIndex: 0 };
    case 'speak':
      return { ...base, skill: 'speaking', errorCategory: 'pronunciation', type, text: '', translation: { ru: '' } };
  }
}

export function ExerciseEditor({
  value,
  onChange,
  onRemove,
  onMove,
  index,
  showLevel,
}: {
  value: Exercise;
  onChange: (e: Exercise) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  index: number;
  showLevel?: boolean;
}) {
  const { t } = useI18n();
  const { data: topics, topicTitle } = useTopics();
  const raw = value as unknown as Raw;
  const set = (patch: Raw) => onChange({ ...raw, ...patch } as unknown as Exercise);
  const label = (k: string) => t(`admin.exerciseEditor.${k}` as MessageKey);

  const text = (name: string, k = name, multiline = false) => (
    <Field label={label(k)}>
      {(p) =>
        multiline ? (
          <Textarea {...p} rows={2} value={String(raw[name] ?? '')} onChange={(e) => set({ [name]: e.target.value })} />
        ) : (
          <TextInput {...p} value={String(raw[name] ?? '')} onChange={(e) => set({ [name]: e.target.value })} />
        )
      }
    </Field>
  );
  const localized = (name: string, k = name, optional = false) => (
    <Field label={label(k)}>
      {(p) => (
        <TextInput
          {...p}
          value={loc(raw[name])}
          onChange={(e) => set({ [name]: optional && !e.target.value ? undefined : { ru: e.target.value } })}
        />
      )}
    </Field>
  );
  const list = (name: string, k = name, optional = false) => (
    <Field label={label(k)}>
      {(p) => (
        <Textarea
          {...p}
          rows={3}
          value={((raw[name] as string[] | undefined) ?? []).join('\n')}
          onChange={(e) => set({ [name]: optional && !e.target.value.trim() ? undefined : e.target.value.split('\n') })}
          onBlur={(e) => set({ [name]: optional && !e.target.value.trim() ? undefined : lines(e.target.value) })}
        />
      )}
    </Field>
  );
  const correctIndex = () => (
    <Field label={label('correctIndex')}>
      {(p) => (
        <TextInput {...p} type="number" min={1} value={Number(raw.correctIndex ?? 0) + 1} onChange={(e) => set({ correctIndex: Math.max(0, Number(e.target.value) - 1) })} />
      )}
    </Field>
  );

  let specific: React.ReactNode = null;
  switch (value.type) {
    case 'choice':
      specific = (
        <>
          {localized('question')}
          {text('target')}
          <Field label={label('optionsIn')}>
            {(p) => (
              <Select
                {...p}
                value={value.optionsIn}
                onChange={(e) => {
                  const optionsIn = e.target.value as 'target' | 'ui';
                  const options = value.options.map((o) => (optionsIn === 'ui' ? { ru: loc(o) } : loc(o)));
                  set({ optionsIn, options });
                }}
              >
                <option value="target">{label('optionsTarget')}</option>
                <option value="ui">{label('optionsUi')}</option>
              </Select>
            )}
          </Field>
          <Field label={label('options')}>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={value.options.map(loc).join('\n')}
                onChange={(e) => {
                  const items = e.target.value.split('\n');
                  set({ options: value.optionsIn === 'ui' ? items.map((o) => ({ ru: o })) : items });
                }}
              />
            )}
          </Field>
          {correctIndex()}
        </>
      );
      break;
    case 'fill_blank':
      specific = (
        <>
          {text('sentence')}
          {localized('translation', 'translation', true)}
          {list('answers')}
          {list('options', 'fillOptions', true)}
        </>
      );
      break;
    case 'translate':
      specific = (
        <>
          <Field label={label('direction')}>
            {(p) => (
              <Select
                {...p}
                value={value.direction}
                onChange={(e) =>
                  e.target.value === 'to_target'
                    ? set({ direction: 'to_target', source: { ru: '' }, answers: [''], answersUi: undefined })
                    : set({ direction: 'to_ui', source: '', answersUi: { ru: [''] }, answers: undefined })
                }
              >
                <option value="to_target">{label('toTarget')}</option>
                <option value="to_ui">{label('toUi')}</option>
              </Select>
            )}
          </Field>
          {value.direction === 'to_target' ? localized('source') : text('source')}
          {value.direction === 'to_target' ? (
            list('answers')
          ) : (
            <Field label={label('answersUi')}>
              {(p) => <Textarea {...p} rows={3} value={(value.answersUi?.ru ?? []).join('\n')} onChange={(e) => set({ answersUi: { ru: e.target.value.split('\n') } })} />}
            </Field>
          )}
        </>
      );
      break;
    case 'order':
      specific = (
        <>
          <Field label={label('tokens')}>
            {(p) => <TextInput {...p} value={value.tokens.join(' ')} onChange={(e) => set({ tokens: e.target.value.split(' ').filter(Boolean) })} />}
          </Field>
          <Field label={label('distractors')}>
            {(p) => (
              <TextInput {...p} value={(value.distractors ?? []).join(' ')} onChange={(e) => set({ distractors: e.target.value.trim() ? e.target.value.split(' ').filter(Boolean) : undefined })} />
            )}
          </Field>
          {localized('translation')}
        </>
      );
      break;
    case 'match':
      specific = (
        <Field label={label('pairs')}>
          {(p) => (
            <Textarea
              {...p}
              rows={4}
              value={value.pairs.map((pair) => `${pair.left} | ${loc(pair.right)}`).join('\n')}
              onChange={(e) =>
                set({
                  pairs: e.target.value.split('\n').map((line) => {
                    const [left = '', right = ''] = line.split('|');
                    return { left: left.trim(), right: { ru: right.trim() } };
                  }),
                })
              }
            />
          )}
        </Field>
      );
      break;
    case 'listen':
      specific = (
        <>
          {text('audioText')}
          {text('audioUrl')}
          <Field label={label('listenMode')}>
            {(p) => (
              <Select {...p} value={value.mode} onChange={(e) => set({ mode: e.target.value, options: e.target.value === 'choice' ? value.options ?? [''] : undefined })}>
                <option value="type">{label('listenType')}</option>
                <option value="choice">{label('listenChoice')}</option>
              </Select>
            )}
          </Field>
          {list('answers')}
          {value.mode === 'choice' ? list('options') : null}
          {localized('translation', 'translation', true)}
        </>
      );
      break;
    case 'dialogue':
      specific = (
        <>
          {localized('context', 'context', true)}
          <Field label={label('lines')}>
            {(p) => (
              <Textarea
                {...p}
                rows={4}
                value={value.lines.map((l) => `${l.speaker}: ${l.text ?? '___'}`).join('\n')}
                onChange={(e) =>
                  set({
                    lines: e.target.value.split('\n').map((line) => {
                      const match = /^\s*([AB])\s*:\s*(.*)$/.exec(line);
                      const speaker = (match?.[1] ?? 'A') as 'A' | 'B';
                      const body = (match?.[2] ?? line).trim();
                      return { speaker, text: body === '___' ? null : body };
                    }),
                  })
                }
              />
            )}
          </Field>
          {list('options')}
          {correctIndex()}
        </>
      );
      break;
    case 'speak':
      specific = (
        <>
          {text('text')}
          {localized('translation')}
        </>
      );
      break;
  }

  return (
    <fieldset className="exercise-editor">
      <legend className="exercise-editor__legend">
        <span>
          {index + 1}. {t(`exerciseTypes.${value.type}`)}
        </span>
        <span className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
          <Button variant="ghost" size="sm" icon onClick={() => onMove(-1)} aria-label={label('moveUp')}>
            <ArrowUp size={14} />
          </Button>
          <Button variant="ghost" size="sm" icon onClick={() => onMove(1)} aria-label={label('moveDown')}>
            <ArrowDown size={14} />
          </Button>
          <Button variant="ghost" size="sm" icon onClick={onRemove} aria-label={label('remove')}>
            <Trash2 size={14} />
          </Button>
        </span>
      </legend>
      <div className="form-grid">
        <Field label={label('type')}>
          {(p) => (
            <Select {...p} value={value.type} onChange={(e) => onChange({ ...exerciseTemplate(e.target.value as ExerciseType, value.key, value.topic), explanation: value.explanation })}>
              {EXERCISE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`exerciseTypes.${type}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {text('key')}
        <Field label={label('topic')}>
          {(p) => (
            <Select {...p} value={value.topic} onChange={(e) => set({ topic: e.target.value })}>
              {!topics?.some((tp) => tp.key === value.topic) ? <option value={value.topic}>{value.topic}</option> : null}
              {(topics ?? []).map((tp) => (
                <option key={tp.key} value={tp.key}>
                  {topicTitle(tp.key)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={label('skill')}>
          {(p) => (
            <Select {...p} value={value.skill} onChange={(e) => set({ skill: e.target.value })}>
              {SKILLS.map((s) => (
                <option key={s} value={s}>
                  {t(`skills.${s}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={label('category')}>
          {(p) => (
            <Select {...p} value={value.errorCategory} onChange={(e) => set({ errorCategory: e.target.value })}>
              {ERROR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`errorCategories.${c}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={label('difficulty')}>
          {(p) => (
            <Select {...p} value={value.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) })}>
              {[1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {showLevel ? (
          <Field label={t('admin.tests.exerciseLevel')}>
            {(p) => (
              <Select {...p} value={value.level ?? ''} onChange={(e) => set({ level: e.target.value || undefined })}>
                <option value="">—</option>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </div>
      <div className="stack">
        {specific}
        {localized('instruction', 'instruction', true)}
        <Field label={label('explanation')}>
          {(p) => <Textarea {...p} rows={2} value={loc(raw.explanation)} onChange={(e) => set({ explanation: { ru: e.target.value } })} />}
        </Field>
      </div>
    </fieldset>
  );
}

/** Edits a whole list of exercises: add, remove, reorder. */
export function ExerciseListEditor({
  exercises,
  onChange,
  keyPrefix,
  defaultTopic,
  showLevel,
}: {
  exercises: Exercise[];
  onChange: (list: Exercise[]) => void;
  keyPrefix: string;
  defaultTopic: string;
  showLevel?: boolean;
}) {
  const { t } = useI18n();
  const nextKey = () => {
    const used = new Set(exercises.map((e) => e.key));
    let n = exercises.length + 1;
    while (used.has(`${keyPrefix}-${n}`)) n++;
    return `${keyPrefix}-${n}`;
  };
  return (
    <div className="stack">
      {exercises.map((exercise, i) => (
        <ExerciseEditor
          key={i}
          index={i}
          value={exercise}
          showLevel={showLevel}
          onChange={(e) => onChange(exercises.map((x, j) => (j === i ? e : x)))}
          onRemove={() => onChange(exercises.filter((_, j) => j !== i))}
          onMove={(dir) => {
            const j = i + dir;
            if (j < 0 || j >= exercises.length) return;
            const next = [...exercises];
            [next[i], next[j]] = [next[j]!, next[i]!];
            onChange(next);
          }}
        />
      ))}
      <div>
        <Button onClick={() => onChange([...exercises, exerciseTemplate('choice', nextKey(), defaultTopic || 'greetings')])}>{t('admin.lessonEditor.addExercise')}</Button>
      </div>
    </div>
  );
}
