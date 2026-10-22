import Svg, { Path } from 'react-native-svg';
import { brand, logoHorizontalPaths, logoHorizontalViewBox } from '@hulul/shared';

export function BrandLogo({ width = 168 }: { width?: number }) {
  return <Svg width={width} height={width * 340 / 1170} viewBox={logoHorizontalViewBox} fill={brand.colors.primary} accessibilityLabel="HULUL" accessibilityRole="image">
    {logoHorizontalPaths.map((d, i) => <Path key={i} d={d} />)}
  </Svg>;
}
