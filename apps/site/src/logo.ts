/* Le « A à serrure » d'Amane : cinq tracés (jambage plein, jambage fin, traverse, œil et corps de la serrure). */
export const MARK_VIEWBOX = '40 -60 940 1120';
export const MARK_PARTS = {
  legs: [
    'M452 -6 L560 -6 L831.93 912 Q856.67 982 930.67 982 L930.67 1000 L653.17 1000 L653.17 982 Q715.17 982 698.38 912 Z',
    'M452 -6 L486 40 L217.73 922 Q201.48 982 261.48 982 L261.48 1000 L97.19 1000 L97.19 982 Q165.19 982 184.49 922 Z',
  ],
  bar: ['M301.5 632.5 L627.38 632.5 L627.38 647.5 L301.5 647.5 Z'],
  keyhole: [
    'M406.44 636 A58 58 0 1 1 522.44 636 A58 58 0 1 1 406.44 636 Z',
    'M442.44 676 L486.44 676 L510.44 832 Q512.44 842 502.44 842 L426.44 842 Q416.44 842 418.44 832 Z',
  ],
} as const;
export const MARK_PATH = [...MARK_PARTS.legs, ...MARK_PARTS.bar, ...MARK_PARTS.keyhole].join(' ');
export const markSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" aria-hidden="true"><path fill="currentColor" d="${MARK_PATH}"/></svg>`;
