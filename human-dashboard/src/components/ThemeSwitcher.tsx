import { useTheme } from '../context/ThemeContext'
import { themes } from '../config/themes'

// Inline type definition to avoid esbuild export issues
type ThemeName = 'terminal' | 'amber' | 'void'

const themeIcons: Record<ThemeName, string> = {
  terminal: '🌲',
  amber: '🔶',
  void: '💠',
}

const themeNames: ThemeName[] = ['terminal', 'amber', 'void']

export function ThemeSwitcher() {
  const { themeName, setTheme, theme } = useTheme()

  return (
    <div className="relative group">
      <button
        className={`px-3 py-1.5 rounded-lg ${theme.colors.bgCard} ${theme.colors.border} border text-sm flex items-center gap-2`}
      >
        <span>{themeIcons[themeName as ThemeName]}</span>
        <span className={theme.colors.textSecondary}>{themes[themeName as ThemeName].name}</span>
      </button>
      
      <div className={`absolute right-0 mt-2 w-36 rounded-lg ${theme.colors.bgCard} ${theme.colors.border} border shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50`}>
        {themeNames.map((name) => (
          <button
            key={name}
            onClick={() => setTheme(name)}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${theme.colors.bgCardHover} first:rounded-t-lg last:rounded-b-lg ${
              name === themeName ? theme.colors.accent : theme.colors.textSecondary
            }`}
          >
            <span>{themeIcons[name]}</span>
            <span>{themes[name].name}</span>
            {name === themeName && <span className="ml-auto">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
