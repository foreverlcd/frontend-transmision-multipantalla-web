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
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#111827',
      backgroundImage: "url('/img/imagenLogin.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      padding: '16px'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',

        background: 'rgba(17, 24, 39, 0.7)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',

      }}>
<div style={{ textAlign: 'center' }}>
  {/* Icono de usuario */}
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '8px'
  }}>
    <div style={{
      background: '#2563eb',
      borderRadius: '50%',
      padding: '12px',
      boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
    }}>
      <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  </div>
  <h2 style={{
    marginTop: '24px',
    fontSize: '30px',
    fontWeight: 'bold',
    color: 'white'
  }}>
    Iniciar Sesión
  </h2>
  <p style={{
    marginTop: '8px',
    fontSize: '14px',
    color: '#9ca3af'
  }}>
    ASDU Hackathon Monitor
  </p>
</div>

        
        {/* Mostrar error si existe */}
        {error && (
          <div style={{
            backgroundColor: '#dc2626',
            color: 'white',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '16px',
            textAlign: 'center',
            marginBottom: '20px',
            border: '2px solid #b91c1c',
            boxShadow: '0 4px 8px rgba(220, 38, 38, 0.3)',
            fontWeight: 'bold',
            zIndex: 9999,
            position: 'relative'
          }}>
            ❌ {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
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
                placeholder="Usuario"
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
                  ? 'bg-gray-900 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
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
        <div className='mt-6 text-center text-gray-500 text-center'>
          © {new Date().getFullYear()} ASDU Hackathon. Todos los derechos reservados.
        </div>
      </div>
      <style jsx global>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-8px); }
          40%, 60% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s;
        }
      `}</style>
    </div>

  );
}