import Image from 'next/image';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-logo">
      <Image
        src="/brand/pawmap-mark.svg"
        alt=""
        className="brand-logo__mark"
        width={44}
        height={44}
        priority
      />
      {!compact && (
        <span className="brand-logo__type">
          <strong>PawMap</strong>
          <small>Thailand</small>
        </span>
      )}
    </span>
  );
}
