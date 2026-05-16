import { useColorScheme as useNativewindColorScheme } from 'nativewind';

export function useColorScheme() {
  // oxlint-disable-next-line typescript-eslint/unbound-method
  const { colorScheme, setColorScheme, toggleColorScheme } = useNativewindColorScheme();
  return {
    colorScheme: colorScheme ?? 'light',
    isDarkColorScheme: colorScheme === 'dark',
    setColorScheme,
    toggleColorScheme,
  };
}
