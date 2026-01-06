import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';
type FontSize = 'sm' | 'md' | 'lg';

interface ThemeContextType {
  theme: Theme;
  fontSize: FontSize;
  audioEnabled: boolean;
  toggleTheme: () => void;
  setFontSize: (size: FontSize) => void;
  setAudioEnabled: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to dark theme (new design system)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('ubl_theme') as Theme;
    return saved || 'dark';
  });

  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem('ubl_font_size') as FontSize) || 'md';
  });

  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    return localStorage.getItem('ubl_audio_enabled') !== 'false';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;

    // Apply theme class
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
    
    // Apply font size class
    body.classList.remove('font-sm', 'font-md', 'font-lg');
    body.classList.add(`font-${fontSize}`);

    // Persist settings
    localStorage.setItem('ubl_theme', theme);
    localStorage.setItem('ubl_font_size', fontSize);
    localStorage.setItem('ubl_audio_enabled', audioEnabled.toString());
  }, [theme, fontSize, audioEnabled]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      fontSize, 
      audioEnabled, 
      toggleTheme, 
      setFontSize, 
      setAudioEnabled 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
