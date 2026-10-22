import type { RefObject } from 'react';
import { useI18n } from '../../../i18n';

/** On-screen keys for letters that are hard to type on a Russian or English keyboard. */
export function SpecialChars({
  chars,
  inputRef,
  value,
  onChange,
  disabled,
}: {
  chars: string[];
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const lower = chars.filter((c) => c === c.toLowerCase());
  if (lower.length === 0) return null;
  const insert = (char: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + char + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + char.length, start + char.length);
    });
  };
  return (
    <div className="special-chars" role="group" aria-label={t('player.specialChars')}>
      {lower.map((c) => (
        <button
          key={c}
          type="button"
          className="special-chars__key target"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insert(c)}
          disabled={disabled}
          aria-label={t('player.insertChar', { char: c })}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
