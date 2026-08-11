import { createContext, useContext, useEffect, useState } from 'react'

const TemaContext = createContext(null)

export function TemaProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem('datanasa-tema') || 'noche')

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    localStorage.setItem('datanasa-tema', tema)
  }, [tema])

  return (
    <TemaContext.Provider value={{ tema, alternar: () => setTema((t) => (t === 'noche' ? 'dia' : 'noche')) }}>
      {children}
    </TemaContext.Provider>
  )
}

export function useTema() {
  return useContext(TemaContext)
}
