import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ExerciseAnswer, PublicExerciseView } from '@linguapath/shared';
import { I18nProvider } from '../i18n';
import { ExerciseView, type LanguageInfo } from '../features/lesson/exercises/Exercise';

const language: LanguageInfo = { code: 'de', name: 'Немецкий', ttsLocale: 'de-DE', specialChars: ['ä', 'ö', 'ü', 'ß'] };
const common = { key: 'k', skill: 'grammar' as const, topic: 'to_be', instruction: '' };

function Harness({ exercise, onAnswer }: { exercise: PublicExerciseView; onAnswer: (a: ExerciseAnswer | null) => void }) {
  const [answer, setAnswer] = useState<ExerciseAnswer | null>(null);
  return (
    <I18nProvider>
      <ExerciseView
        exercise={exercise}
        language={language}
        answer={answer}
        onAnswer={(a) => {
          setAnswer(a);
          onAnswer(a);
        }}
        onSubmit={() => undefined}
        locked={false}
        feedback={null}
      />
    </I18nProvider>
  );
}

describe('exercise components', () => {
  it('selects a multiple-choice option by click and by number key', async () => {
    const onAnswer = vi.fn();
    render(<Harness exercise={{ ...common, type: 'choice', question: { ru: 'Вопрос' }, optionsIn: 'target', options: ['bin', 'bist', 'ist'] }} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole('radio', { name: /bist/ }));
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'choice', option: 'bist' });
    await userEvent.keyboard('3');
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'choice', option: 'ist' });
  });

  it('builds a sentence from tiles in click order and lets the learner undo', async () => {
    const onAnswer = vi.fn();
    render(<Harness exercise={{ ...common, type: 'order', translation: { ru: 'Я из Алматы' }, translationText: 'Я из Алматы', tiles: ['aus', 'Ich', 'komme', 'Almaty'] }} onAnswer={onAnswer} />);
    for (const word of ['Ich', 'komme', 'aus', 'Almaty']) await userEvent.click(screen.getAllByRole('button', { name: word }).at(-1)!);
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'order', tokens: ['Ich', 'komme', 'aus', 'Almaty'] });
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect(onAnswer).toHaveBeenLastCalledWith(null);
  });

  it('types into a gap and inserts special characters at the cursor', async () => {
    const onAnswer = vi.fn();
    render(<Harness exercise={{ ...common, type: 'fill_blank', sentence: 'Das ist ___.', translationText: 'Это …' }} onAnswer={onAnswer} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Mdchen');
    (input as HTMLInputElement).setSelectionRange(1, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Вставить «ä»' }));
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'fill_blank', text: 'Mädchen' });
  });

  it('offers a penalty-free skip when speech recognition is unavailable', async () => {
    const onAnswer = vi.fn();
    render(<Harness exercise={{ ...common, type: 'speak', text: 'Guten Tag', translation: { ru: 'Добрый день' }, translationText: 'Добрый день' }} onAnswer={onAnswer} />);
    expect(screen.getByText(/Распознавание речи не поддерживается/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить без штрафа' }));
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'speak', transcript: '', skipped: true });
  });

  it('finds the mistake by tapping a word', async () => {
    const onAnswer = vi.fn();
    render(<Harness exercise={{ ...common, type: 'error_spot', tokens: ['Gestern', 'habe', 'ich', 'gegangen.'] }} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole('radio', { name: 'habe' }));
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'error_spot', index: 1 });
  });

  it('answers a text with gaps only when every gap is chosen', async () => {
    const onAnswer = vi.fn();
    render(<Harness exercise={{ ...common, type: 'cloze_text', text: 'Ich {0} müde, {1} es spät ist.', gaps: [{ options: ['bin', 'habe'] }, { options: ['weil', 'dass'] }] }} onAnswer={onAnswer} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Пропуск 1' }), 'bin');
    expect(onAnswer).toHaveBeenLastCalledWith(null);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Пропуск 2' }), 'weil');
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'cloze_text', choices: ['bin', 'weil'] });
  });

  it('sorts words into groups by choosing a word and then a group', async () => {
    const onAnswer = vi.fn();
    render(<Harness exercise={{ ...common, type: 'categorize', categories: ['der', 'die'], items: ['Tisch', 'Lampe'] }} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tisch' }));
    await userEvent.click(screen.getByRole('button', { name: 'der' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lampe' }));
    await userEvent.click(screen.getByRole('button', { name: 'die' }));
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'categorize', placement: [{ text: 'Tisch', category: 0 }, { text: 'Lampe', category: 1 }] });
  });

  it('runs a messenger role-play turn by turn', async () => {
    const onAnswer = vi.fn();
    render(
      <Harness
        exercise={{ ...common, type: 'chat', turns: [{ message: 'Hallo!', options: ['Hallo!', 'Tschüss!'] }, { message: 'Wie geht’s?', options: ['Gut, danke.', 'Ich heiße Anna.'] }] }}
        onAnswer={onAnswer}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Hallo!' }, { timeout: 2000 }));
    await userEvent.click(await screen.findByRole('button', { name: 'Gut, danke.' }, { timeout: 2000 }));
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'chat', replies: ['Hallo!', 'Gut, danke.'] });
  });
});
