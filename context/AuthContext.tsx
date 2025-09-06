'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import nookies from 'nookies';

// Definir el tipo para los datos del usuario
interface User {
  id: number;
  email: string;
  role: string;
  teamId: number | null;
}

// Definir el tipo para el contexto de autenticación
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

// Crear el contexto de autenticación
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Definir las props del AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}

// Componente AuthProvider
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // useEffect para mantener la sesión al recargar la página
  useEffect(() => {
    // Primero intentar obtener de localStorage
    let storedToken = localStorage.getItem('token');
    let storedUser = localStorage.getItem('user');

    // Si no está en localStorage, intentar obtener de cookies
    if (!storedToken) {
      const cookies = nookies.get();
      storedToken = cookies.token;
    }

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        setIsAuthenticated(true);
        console.log('🔑 Sesión restaurada desde localStorage:', userData.email);
      } catch (error) {
        console.error('❌ Error al parsear datos del usuario:', error);
        // Si hay error al parsear, limpiar localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        nookies.destroy(null, 'token');
      }
    } else if (storedToken && !storedUser) {
      // Si hay token pero no user data, intentar obtener del servidor
      console.log('🔄 Token encontrado sin datos de usuario, obteniendo del servidor...');
      setToken(storedToken);
    } else {
      console.log('ℹ️ No hay sesión almacenada');
    }
  }, []); // Se ejecuta solo una vez al montar el componente

  // Función de login
  const login = (token: string, userData: User) => {
    // Guardar en localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Actualizar el estado
    setToken(token);
    setUser(userData);
    setIsAuthenticated(true);
  };

  // Función de logout
  const logout = () => {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Limpiar cookies
    nookies.destroy(null, 'token');
    
    // Limpiar el estado
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  // Valor del contexto
  const contextValue: AuthContextType = {
    user,
    token,
    isAuthenticated,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto de autenticación
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};