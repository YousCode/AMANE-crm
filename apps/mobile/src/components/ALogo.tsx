import React from 'react';
import Svg, { Path } from 'react-native-svg';

/* Le A à serrure de la maison (path de site/favicon.svg). */
export const A_PATH = 'M452 -6 L560 -6 L831.93 912 Q856.67 982 930.67 982 L930.67 1000 L653.17 1000 L653.17 982 Q715.17 982 698.38 912 Z M452 -6 L486 40 L217.73 922 Q201.48 982 261.48 982 L261.48 1000 L97.19 1000 L97.19 982 Q165.19 982 184.49 922 Z M301.5 632.5 L627.38 632.5 L627.38 647.5 L301.5 647.5 Z M406.44 636 A58 58 0 1 1 522.44 636 A58 58 0 1 1 406.44 636 Z M442.44 676 L486.44 676 L510.44 832 Q512.44 842 502.44 842 L426.44 842 Q416.44 842 418.44 832 Z';

export function ALogo({ size = 40, color = '#111111' }: { size?: number; color?: string }) {
  const h = size * (1120 / 940);
  return (
    <Svg width={size} height={h} viewBox="40 -60 940 1120" accessibilityLabel="Amane">
      <Path d={A_PATH} fill={color} />
    </Svg>
  );
}
