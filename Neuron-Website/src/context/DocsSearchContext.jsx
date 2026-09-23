import { createContext, useContext, useState } from 'react';

const DocsSearchContext = createContext({
  searchQuery: '',
  setSearchQuery: () => {}
});

export function DocsSearchProvider({ children }) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <DocsSearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </DocsSearchContext.Provider>
  );
}

export function useDocsSearch() {
  return useContext(DocsSearchContext);
}
