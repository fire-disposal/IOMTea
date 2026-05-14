import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'matchaGreen',
  colors: {
    matchaGreen: [
      '#F2F7ED',  // 0 - lightest
      '#E3EFD6',  // 1
      '#C7E0AD',  // 2
      '#AAD184',  // 3
      '#8EC15B',  // 4
      '#6BA539',  // 5 - primary
      '#56842E',  // 6
      '#416323',  // 7
      '#2C4217',  // 8
      '#17210C',  // 9 - darkest
    ],
  },
  defaultRadius: 'md',
  fontFamily: '"Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Noto Sans SC", sans-serif',
    fontWeight: '600',
  },
})
