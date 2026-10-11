import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext({
  language: 'English',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key
});

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('English');

  const t = (key, fallback) => {
    return fallback !== undefined ? fallback : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context || {
    language: 'English',
    setLanguage: () => {},
    t: (key, fallback) => fallback !== undefined ? fallback : key
  };
}

export default LanguageContext;
