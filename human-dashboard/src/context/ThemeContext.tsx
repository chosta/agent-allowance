import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { themes } from '../config/themes'

// Inline type definitions to avoid esbuild export issues
type ThemeName = 'terminal' | 'amber' | 'void'
type Theme = typeof themes.terminal

interface ThemeContextType {
  theme: Theme
  themeName: ThemeName
  setTheme: (name: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('aam-theme')
    if (saved === 'terminal' || saved === 'amber' || saved === 'void') {
      return saved
    }
    return 'terminal'
  })

  const theme = themes[themeName]

  const setTheme = (name: ThemeName) => {
    setThemeName(name)
    localStorage.setItem('aam-theme', name)
  }

  // Apply bg to body
  useEffect(() => {
    document.body.className = `${theme.colors.bgMain} ${theme.colors.textPrimary}`
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
