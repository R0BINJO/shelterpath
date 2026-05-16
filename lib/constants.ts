import type { Theme } from '@react-navigation/native';

const NAV_FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  bold: 'Inter_600SemiBold',
  heavy: 'Inter_700Bold',
} as const;

// SafeRoute Varjumine — calm crisis palette. Keep in sync with app/global.css.
export const NAV_THEME = {
  light: {
    background: 'hsl(210 25% 97%)',
    border: 'hsl(215 20% 86%)',
    card: 'hsl(0 0% 100%)',
    notification: 'hsl(0 75% 52%)',
    primary: 'hsl(212 95% 50%)',
    text: 'hsl(215 30% 12%)',
  },
  dark: {
    background: 'hsl(215 35% 8%)',
    border: 'hsl(215 25% 20%)',
    card: 'hsl(215 30% 12%)',
    notification: 'hsl(0 72% 55%)',
    primary: 'hsl(210 100% 60%)',
    text: 'hsl(210 20% 96%)',
  },
};

export const LIGHT_THEME: Theme = {
  dark: false,
  fonts: {
    regular: { fontFamily: NAV_FONTS.regular, fontWeight: '400' },
    medium: { fontFamily: NAV_FONTS.medium, fontWeight: '500' },
    bold: { fontFamily: NAV_FONTS.bold, fontWeight: '600' },
    heavy: { fontFamily: NAV_FONTS.heavy, fontWeight: '700' },
  },
  colors: NAV_THEME.light,
};
export const DARK_THEME: Theme = {
  dark: true,
  fonts: {
    regular: { fontFamily: NAV_FONTS.regular, fontWeight: '400' },
    medium: { fontFamily: NAV_FONTS.medium, fontWeight: '500' },
    bold: { fontFamily: NAV_FONTS.bold, fontWeight: '600' },
    heavy: { fontFamily: NAV_FONTS.heavy, fontWeight: '700' },
  },
  colors: NAV_THEME.dark,
};

// SafeRoute marker colour tokens (hardcoded — match the spec).
export const SHELTER_COLORS = {
  SA1: '#F5C518', // yellow — temporary cover
  SA2: '#2F80ED', // blue — stronger shelter
  SA3: '#21C45D', // green — long-term / official
  danger: 'rgba(220, 38, 38, 0.28)', // transparent red danger overlay
  dangerStroke: 'rgba(220, 38, 38, 0.65)',
  route: '#3B82F6', // bright blue route
  user: '#22D3EE',
} as const;
