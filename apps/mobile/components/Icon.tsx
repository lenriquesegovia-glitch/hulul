import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { icons, type UiIconName } from '@hulul/shared';

interface Props {
  name: UiIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = '#1C1A1A', strokeWidth = 1.8 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {icons[name].map((s, i) => {
        if (s.kind === 'path') return <Path key={i} d={s.d} />;
        if (s.kind === 'circle') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
        return <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />;
      })}
    </Svg>
  );
}
