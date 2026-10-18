import { LazyVideo } from '../motion/LazyVideo';
import { publicUrl } from '../../lib/publicUrl';

/** Reflect encryption-section background video treatment */
export function EncryptionField({ className = '' }: { className?: string }) {
  return (
    <div className={`encryption-field ${className}`} aria-hidden>
      <LazyVideo
        className="encryption-field-video"
        sources={[
          { src: publicUrl('/motion/encryption.webm'), type: 'video/webm' },
          { src: publicUrl('/motion/encryption.mp4'), type: 'video/mp4' },
        ]}
      />
      <div className="encryption-field-glow" />
    </div>
  );
}
