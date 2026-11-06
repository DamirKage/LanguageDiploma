import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Brain,
  CalendarDays,
  ClipboardCheck,
  Compass,
  Flag,
  Headphones,
  Lock,
  PenLine,
  Sparkles,
  Sunrise,
  type LucideIcon,
} from 'lucide-react';
import type { AchievementsDTO, CefrLevel, MilestoneDTO, MilestoneKey } from '@linguapath/shared';
import { motivationApi } from '../../api/endpoints';
import { Button, Meter, Section, errorMessage, useToast } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { qk } from '../../lib/queries';

const ICONS: Record<MilestoneKey, LucideIcon> = {
  placement: Compass,
  first_lesson: Flag,
  perfect_lesson: Sparkles,
  module_test: ClipboardCheck,
  words_20: Brain,
  words_50: Brain,
  words_100: Brain,
  days_7: CalendarDays,
  days_30: CalendarDays,
  writing_5: PenLine,
  listening_10: Headphones,
  comeback: Sunrise,
  level_complete: Award,
};

export function useAchievements(language: string | null | undefined) {
  return useQuery({ queryKey: qk.achievements(language ?? ''), queryFn: () => motivationApi.achievements(language!), enabled: !!language });
}

function useMilestoneText() {
  const { t } = useI18n();
  return {
    title: (key: MilestoneKey) => t(`motivation.milestone.${key}.title` as MessageKey),
    hint: (m: MilestoneDTO) => t(`motivation.milestone.${m.key}.hint` as MessageKey, { target: m.target }),
  };
}

/** The current week: a dot per day and a modest goal; nothing is lost for a missed day. */
export function WeekCard({ data }: { data: AchievementsDTO }) {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const w = data.week;
  const reached = w.activeDays >= w.goalDays;
  return (
    <Section title={t('motivation.week.title')}>
      <ol className="week" aria-label={t('motivation.week.days', { active: w.activeDays, goal: w.goalDays })}>
        {w.days.map((d) => (
          <li key={d.date} className="week__day" data-active={d.active || undefined} data-future={d.future || undefined}>
            <span className="week__dot" aria-hidden />
            <span className="caption">{i18n.date(new Date(`${d.date}T12:00:00`), { weekday: 'short' })}</span>
          </li>
        ))}
      </ol>
      <p className="small">
        {t('motivation.week.days', { active: w.activeDays, goal: w.goalDays })}
        <span className="muted"> · {t('motivation.week.minutes', { minutes: plural('common.minutes', w.minutes), goal: w.goalMinutes })}</span>
      </p>
      <Meter value={Math.min(w.activeDays, w.goalDays)} max={w.goalDays} tone={reached ? 'ok' : 'accent'} label={t('motivation.week.title')} />
      <p className="caption">{reached ? t('motivation.week.reached') : t('motivation.week.note')}</p>
    </Section>
  );
}

/** The closest milestone not yet reached, so the next step is always visible. */
export function NextMilestone({ data }: { data: AchievementsDTO }) {
  const { t } = useI18n();
  const text = useMilestoneText();
  const next = data.milestones
    .filter((m) => !m.achieved && m.target > 1)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];
  if (!next) return null;
  const Icon = ICONS[next.key];
  return (
    <Section title={t('motivation.next')}>
      <div className="milestone milestone--wide">
        <span className="milestone__icon" aria-hidden>
          <Icon size={20} />
        </span>
        <div className="milestone__body">
          <p className="milestone__title">{text.title(next.key)}</p>
          <p className="caption">{text.hint(next)}</p>
          <Meter value={next.current} max={next.target} label={text.title(next.key)} />
          <p className="caption">{t('motivation.progress', { current: next.current, target: next.target })}</p>
        </div>
      </div>
    </Section>
  );
}

export function MilestoneGrid({ data }: { data: AchievementsDTO }) {
  const i18n = useI18n();
  const { t } = i18n;
  const text = useMilestoneText();
  const achieved = data.milestones.filter((m) => m.achieved).length;
  return (
    <Section title={t('motivation.milestonesTitle')} aside={<span className="small muted">{t('motivation.milestonesCount', { n: achieved, total: data.milestones.length })}</span>}>
      <ul className="milestones">
        {data.milestones.map((m, i) => {
          const Icon = m.achieved ? ICONS[m.key] : Lock;
          return (
            <li key={m.key} className="milestone" data-achieved={m.achieved || undefined} style={{ '--i': i } as React.CSSProperties}>
              <span className="milestone__icon" aria-hidden>
                <Icon size={18} />
              </span>
              <div className="milestone__body">
                <p className="milestone__title">{text.title(m.key)}</p>
                <p className="caption">
                  {m.achieved && m.achievedAt
                    ? t('motivation.achievedOn', { date: i18n.date(new Date(m.achievedAt), { day: 'numeric', month: 'long' }) })
                    : text.hint(m)}
                </p>
                {!m.achieved && m.target > 1 ? <Meter value={m.current} max={m.target} label={text.title(m.key)} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Level-by-level path to a certificate and the button to receive it. */
export function LevelCertificates({ language, data }: { language: string; data: AchievementsDTO }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const queryClient = useQueryClient();
  const issue = useMutation({
    mutationFn: (level: CefrLevel) => motivationApi.issueCertificate(language, level),
    onSuccess: () => {
      toast(t('motivation.cert.issued'));
      void queryClient.invalidateQueries({ queryKey: qk.achievements(language) });
    },
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  return (
    <Section id="certificates" title={t('motivation.cert.title')}>
      <p className="caption">{t('motivation.cert.rule')}</p>
      <ul className="cert-levels">
        {data.levels.map((l) => {
          const lessonsPct = l.lessons.total ? l.lessons.completed / l.lessons.total : 0;
          return (
            <li key={l.level} className="cert-level" data-done={l.certificate ? true : undefined}>
              <span className="cert-level__badge">{l.level}</span>
              <div className="cert-level__body">
                <p className="small">
                  {t('motivation.cert.lessons', { done: l.lessons.completed, total: l.lessons.total })}
                  {l.moduleTests.total ? <span className="muted"> · {t('motivation.cert.tests', { done: l.moduleTests.passed, total: l.moduleTests.total })}</span> : null}
                </p>
                <Meter value={Math.round(lessonsPct * 100)} tone={l.eligible ? 'ok' : 'accent'} label={l.level} />
              </div>
              <div className="cert-level__action">
                {l.certificate ? (
                  <Link className="btn btn--sm" to={`/certificate/${l.certificate.code}`}>
                    <Award size={14} aria-hidden />
                    {t('motivation.cert.open')}
                  </Link>
                ) : l.eligible ? (
                  <Button size="sm" variant="primary" onClick={() => issue.mutate(l.level)} loading={issue.isPending && issue.variables === l.level}>
                    <Award size={14} aria-hidden />
                    {t('motivation.cert.get')}
                  </Button>
                ) : (
                  <span className="caption">{t('motivation.cert.locked')}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Milestones reached a moment ago, shown on the lesson summary. */
export function NewMilestones({ language }: { language: string }) {
  const { t } = useI18n();
  const text = useMilestoneText();
  const { data } = useAchievements(language);
  const fresh = data?.milestones.filter((m) => m.isNew) ?? [];
  const certReady = data?.levels.find((l) => l.eligible && !l.certificate);
  if (!fresh.length && !certReady) return null;
  return (
    <section className="new-milestones" aria-live="polite">
      {fresh.map((m) => {
        const Icon = ICONS[m.key];
        return (
          <div key={m.key} className="new-milestone">
            <span className="milestone__icon" aria-hidden>
              <Icon size={20} />
            </span>
            <div>
              <p className="eyebrow">{t('motivation.newTitle')}</p>
              <p className="milestone__title">{text.title(m.key)}</p>
            </div>
          </div>
        );
      })}
      {certReady ? (
        <div className="new-milestone">
          <span className="milestone__icon" aria-hidden>
            <Award size={20} />
          </span>
          <div>
            <p className="eyebrow">{t('motivation.cert.readyTitle')}</p>
            <p className="milestone__title">
              {t('motivation.cert.ready', { level: certReady.level })} <Link to="/progress#certificates">{t('motivation.cert.goTo')}</Link>
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
