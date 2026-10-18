import { ExpertPack, EXPERT_ORDER } from '../bot/ExpertPack';
import { useI18n } from '../../i18n/useI18n';
import { Reveal } from '@a3s-lab/ui';

export function WorkBotStage() {
  const { t } = useI18n();
  const members = t.work.bot.squad;

  return (
    <Reveal delayMs={60}>
      <div className="work-bot-stage">
        <div className="work-bot-stage-head">
          <h3 className="work-bot-stage-title">{t.work.bot.title}</h3>
          <p className="work-bot-stage-caption">{t.work.bot.caption}</p>
        </div>

        <div className="work-bot-squad" aria-label={t.work.bot.aria}>
          {EXPERT_ORDER.map((id, i) => {
            const meta = members.find((m) => m.id === id) ?? members[i];
            return (
              <div
                key={id}
                className={`work-bot-squad-item work-bot-squad-item--${id}`}
                style={{ ['--bot-delay' as string]: `${i * 100}ms` }}
              >
                <ExpertPack
                  id={id}
                  name={meta?.name ?? id}
                  role={meta?.role ?? ''}
                />
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}
