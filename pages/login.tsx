'use client';

import React, { useState, useContext } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import nookies from 'nookies';
import { AuthContext } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const authContext = useContext(AuthContext);
  const router = useRouter();

  // Verificar que el contexto esté disponible
  if (!authContext) {
    throw new Error('LoginPage debe estar dentro de un AuthProvider');
  }

  const { login } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Limpiar errores anteriores
    setLoading(true);
    
    try {
      // Hacer petición POST al backend
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/login`,
        {
          email,
          password
        }
      );

      // Si la petición es exitosa
      if (response.data.token && response.data.user) {
        // Guardar token en cookies para getServerSideProps
        nookies.set(null, 'token', response.data.token, {
          maxAge: 24 * 60 * 60, // 1 día en segundos
          path: '/',
        });

        // También guardar en localStorage para el contexto
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // Llamar a la función login del contexto
        login(response.data.token, response.data.user);

        // Redirigir según el rol del usuario
        if (response.data.user.role === 'ADMIN') {
          router.push('/monitor');
        } else if (response.data.user.role === 'PARTICIPANT') {
          router.push('/compartir');
        } else {
          // Fallback para roles no esperados
          router.push('/');
        }
      }
    } catch (apiError: any) {
      // Prevenir que Next.js muestre el overlay de error para errores HTTP esperados
      if (apiError.response?.status && apiError.response.status >= 400 && apiError.response.status < 500) {
        // Estos son errores de cliente esperados (401, 400, etc.) - no los logueamos como errores
        console.log('Error de autenticación:', apiError.response.status, apiError.response.data);
      } else {
        // Solo loguear como error real si es un problema de red o servidor
        console.error('Error en login:', apiError);
      }
      
      const status = apiError.response?.status;
      const backendMessage = apiError.response?.data?.error;

      let errorMessage = '';
      
      if (status === 401) {
        // Usar el mensaje del backend si está disponible, sino usar mensaje genérico
        errorMessage = backendMessage || 'Credenciales incorrectas. Verifica tu email y contraseña.';
      } else if (status === 400) {
        errorMessage = backendMessage || 'Datos de entrada inválidos.';
      } else if (status === 500) {
        errorMessage = 'Error interno del servidor. Por favor, intenta más tarde.';
      } else if (backendMessage) {
        errorMessage = backendMessage;
      } else if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ERR_NETWORK') {
        errorMessage = 'No se puede conectar con el servidor. Verifica que el backend esté funcionando.';
      } else if (apiError.message) {
        errorMessage = `Error: ${apiError.message}`;
      } else {
        errorMessage = 'Error de conexión. Por favor, intenta nuevamente.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 flex items-center justify-center text-white px-4 py-8">
      <div className="absolute top-4 right-4 flex flex-col items-end z-20">
          <img
            src="./asdu_logo.png"
            alt="Imagen ASDU"
            className="w-16 h-16 rounded-2xl border-2 border-gray-200 object-cover"
          />
      </div>
      <div className="max-w-md w-full p-8 flex flex-col gap-6 border-2 border-amber-200 rounded-xl shadow-xl bg-gray-900/60 relative">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-white">
            Iniciar Sesión
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            ASDU Hackathon Monitor
          </p>
        </div>
        {/* Mostrar error si existe */}
        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg text-lg text-center mb-5 border-2 border-red-700 shadow-lg font-bold relative z-10">
            ❌ {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-xl shadow-lg bg-gray-900/70 p-2 space-y-2">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-400 text-white bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(''); // Limpiar error al escribir
                }}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-400 text-white bg-gray-800 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(''); // Limpiar error al escribir
                }}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white transition duration-150 ease-in-out ${
                loading 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Iniciando sesión...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}