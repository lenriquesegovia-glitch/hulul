import { icons, type UiIconName } from '@hulul/shared';

interface Props {
  name: UiIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  label?: string;
}

export function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 1.8, label }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {icons[name].map((s, i) => {
        if (s.kind === 'path') return <path key={i} d={s.d} />;
        if (s.kind === 'circle') return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
        return <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />;
      })}
    </svg>
  );
}
