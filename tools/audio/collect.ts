/**
 * Lists every target-language phrase the interface can play: words and examples, theory
 * examples, exercise prompts and expected answers, lesson tests and placement items.
 * Output: JSON { [language]: Array<{ text, voice }> } for generate.py.
 */
import { writeFileSync } from 'node:fs';
import type { AudioVoice, Exercise } from '@linguapath/shared';
import { finalizeExercise, type Draft } from '../../server/src/seed/builders';
import { LANGUAGES } from '../../server/src/seed/content-seed';
import { expectedAnswer } from '../../server/src/modules/learning/checker';

function exerciseTexts(ex: Exercise): Array<[string, AudioVoice]> {
  switch (ex.type) {
    case 'choice':
      return [
        ...(ex.target ? [[ex.target, 'A'] as [string, AudioVoice]] : []),
        ...(ex.optionsIn === 'target' ? [[expectedAnswer(ex), 'A'] as [string, AudioVoice]] : []),
      ];
    case 'fill_blank':
    case 'order':
    case 'speak':
      return [[expectedAnswer(ex), 'A']];
    case 'translate':
      return ex.direction === 'to_target' ? [[expectedAnswer(ex), 'A']] : [[ex.source as string, 'A']];
    case 'listen':
      return [[ex.audioText, 'A']];
    case 'error_spot':
    case 'cloze_text':
      return [[expectedAnswer(ex), 'A']];
    case 'chat':
      return ex.turns.flatMap((t) => [[t.message, 'B'], [t.options[t.correctIndex]!, 'A']] as Array<[string, AudioVoice]>);
    case 'categorize':
      return ex.items.map((it) => [it.text, 'A'] as [string, AudioVoice]);
    case 'dialogue': {
      const missing = ex.lines.find((l) => l.text === null)?.speaker ?? 'B';
      return [
        ...ex.lines.filter((l) => l.text).map((l) => [l.text!, l.speaker] as [string, AudioVoice]),
        [ex.options[ex.correctIndex]!, missing],
        [ex.options[ex.correctIndex]!, 'A'],
      ];
    }
  }
}

const out: Record<string, Array<{ text: string; voice: AudioVoice }>> = {};
for (const spec of LANGUAGES) {
  const seen = new Set<string>();
  const list: Array<{ text: string; voice: AudioVoice }> = [];
  const add = (text: string | undefined | null, voice: AudioVoice = 'A') => {
    const t = text?.trim().replace(/\s+/g, ' ');
    if (!t || seen.has(`${voice}|${t}`)) return;
    seen.add(`${voice}|${t}`);
    list.push({ text: t, voice });
  };
  const addDraft = (draft: Draft, key: string) => {
    for (const [text, voice] of exerciseTexts(finalizeExercise(draft, key, 'greetings'))) add(text, voice);
  };
  for (const course of spec.courses)
    for (const mod of course.modules)
      for (const lesson of mod.lessons) {
        for (const [term, , , example] of lesson.words) {
          add(term);
          add(example);
        }
        for (const block of lesson.theory) for (const [target] of block.examples ?? []) add(target);
        lesson.exercises.forEach((d, i) => addDraft(d, `${lesson.key}-${i}`));
        lesson.test.forEach((d, i) => addDraft(d, `${lesson.key}-t${i}`));
      }
  spec.placement.forEach((p, i) => addDraft(p.exercise, `${spec.code}-p${i}`));
  out[spec.code] = list;
}
writeFileSync(process.argv[2] ?? 'phrases.json', JSON.stringify(out));
for (const [code, list] of Object.entries(out)) console.log(code, list.length);
