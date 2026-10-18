import { ClayAvatar } from '../bot/ClayAvatar';
import type { ClayBotId } from '../bot/clayPresets';
import { useI18n } from '../../i18n/useI18n';

export function HeroProductMobile() {
  const { t } = useI18n();
  const contacts = t.hero.workContacts;

  return (
    <div className="hero-product hero-product--mobile">
      <div className="work-contacts" aria-hidden>
        <div className="work-contacts-status">
          <span>9:41</span>
          <span className="work-contacts-status-icons">
            <svg viewBox="0 0 18 12" width="18" height="12" fill="currentColor">
              <rect x="0" y="7" width="3" height="5" rx="0.6" />
              <rect x="5" y="4" width="3" height="8" rx="0.6" />
              <rect x="10" y="1" width="3" height="11" rx="0.6" />
              <rect x="15" y="0" width="3" height="12" rx="0.6" opacity="0.35" />
            </svg>
            <svg viewBox="0 0 16 12" width="16" height="12" fill="none">
              <path
                d="M1.2 8.6a7.2 7.2 0 0 1 13.6 0"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M4 6.4a4.2 4.2 0 0 1 8 0"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle cx="8" cy="9.4" r="1.1" fill="currentColor" />
            </svg>
            <svg viewBox="0 0 25 12" width="25" height="12" fill="none">
              <rect x="0.6" y="1.2" width="20" height="9.6" rx="2.2" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2.2" y="2.8" width="14.2" height="6.4" rx="1.2" fill="currentColor" />
              <path d="M22.2 4.4v3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
        </div>

        <header className="work-contacts-head">
          <span className="work-contacts-user">{contacts.user.slice(0, 1).toUpperCase()}</span>
          <span className="work-contacts-new" aria-hidden>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
              <path
                d="M3 8h10M8 3v10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </header>

        <div className="work-contacts-search">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.4 10.4 13.2 13.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>{contacts.search}</span>
        </div>

        <ul className="work-contacts-list">
          {contacts.chats.map((chat, index) => (
            <li key={chat.id} className={index === 0 ? 'is-active' : undefined}>
              <span className="work-contacts-face">
                <ClayAvatar
                  bot={chat.id as ClayBotId}
                  size={48}
                  autoPlay
                  followPointer={false}
                  showGround={false}
                  aria-label={chat.name}
                />
              </span>
              <div className="work-contacts-copy">
                <div className="work-contacts-row">
                  <span className="work-contacts-name">{chat.name}</span>
                  <span className="work-contacts-time">{chat.time}</span>
                </div>
                <p className="work-contacts-preview">{chat.preview}</p>
              </div>
              {chat.unread ? <span className="work-contacts-unread" /> : null}
            </li>
          ))}
        </ul>

        <div className="work-contacts-plugins">
          <span className="work-contacts-plugins-icon" aria-hidden>
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
              <path
                d="M8.2 3.4h3.6v2.2a1.8 1.8 0 1 0 0 0V3.4H15a1.6 1.6 0 0 1 1.6 1.6v3.2h-2.2a1.8 1.8 0 1 0 0 0h2.2V15A1.6 1.6 0 0 1 15 16.6h-3.2v-2.2a1.8 1.8 0 1 0 0 0v2.2H8.2A1.6 1.6 0 0 1 6.6 15v-3.2h2.2a1.8 1.8 0 1 0 0 0H6.6V5a1.6 1.6 0 0 1 1.6-1.6Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>{contacts.plugins}</span>
        </div>
      </div>
    </div>
  );
}
