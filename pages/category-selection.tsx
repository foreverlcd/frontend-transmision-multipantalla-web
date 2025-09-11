import { GetServerSidePropsContext } from 'next';
import { useRouter } from 'next/router';
import { useContext, useState } from 'react';
import nookies from 'nookies';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

interface User {
  id: number;
  email: string;
  role: string;
  teamId: number | null;
}

interface CategorySelectionPageProps {
  user: User;
}

interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
}

// Categorías predefinidas (puedes modificar según tus necesidades)
const CATEGORIES: Category[] = [
  {
    id: 1,
    name: 'Equipo A',
    description: 'Transmisiones del Equipo A',
    icon: '🔴',
    color: 'bg-red-600 hover:bg-red-700'
  },
  {
    id: 2,
    name: 'Equipo B', 
    description: 'Transmisiones del Equipo B',
    icon: '🔵',
    color: 'bg-blue-600 hover:bg-blue-700'
  }
];

export default function CategorySelectionPage({ user }: CategorySelectionPageProps) {
  const authContext = useContext(AuthContext);
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!authContext) {
    throw new Error('CategorySelectionPage debe estar dentro de un AuthProvider');
  }

  const { logout } = authContext;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleCategorySelect = async (categoryId: number) => {
    setIsLoading(true);
    setSelectedCategory(categoryId);
    
    // Guardar la categoría seleccionada en localStorage
    localStorage.setItem('selectedCategory', categoryId.toString());
    
    // Simular un pequeño delay para UX
    setTimeout(() => {
      // Redirigir al monitor con la categoría seleccionada
      router.push(`/monitor?category=${categoryId}`);
    }, 500);
  };

  const selectedCategoryData = CATEGORIES.find(cat => cat.id === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Selección de Categoría</h1>
            <p className="text-lg text-gray-300 mt-2">
              Bienvenido, {user.email} - Elige la categoría a monitorear
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-150 ease-in-out"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* Información */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-2xl">
              👑
            </div>
            <div>
              <h2 className="text-xl font-semibold">Panel de Administrador</h2>
              <p className="text-gray-400">Selecciona una categoría para comenzar a monitorear</p>
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-300">
              <span className="font-semibold">ℹ️ Información:</span> Una vez que selecciones una categoría, 
              solo verás las transmisiones de los participantes asignados a esa categoría específica.
            </p>
          </div>
        </div>

        {/* Grid de Categorías */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.map((category) => (
            <div key={category.id} className="relative">
              <button
                onClick={() => handleCategorySelect(category.id)}
                disabled={isLoading}
                className={`w-full p-6 rounded-xl text-left transition-all duration-300 transform hover:scale-105 ${
                  selectedCategory === category.id
                    ? 'ring-4 ring-white ring-opacity-50 scale-105'
                    : 'hover:shadow-2xl'
                } ${category.color} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center space-x-4 mb-4">
                  <div className="text-4xl">{category.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{category.name}</h3>
                    <p className="text-gray-100 text-sm">{category.description}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-100">
                    <span>📺</span>
                    <span>Monitoreo en tiempo real</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-100">
                    <span>🎯</span>
                    <span>Filtrado por categoría</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-100">
                    <span>⚡</span>
                    <span>Transmisión multipantalla</span>
                  </div>
                </div>

                {selectedCategory === category.id && isLoading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-xl flex items-center justify-center">
                    <div className="flex items-center space-x-3 text-white">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>Cargando...</span>
                    </div>
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Botón para ver todas las categorías */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => handleCategorySelect(0)} // 0 = todas las categorías
            disabled={isLoading}
            className={`px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 ${
              selectedCategory === 0 ? 'ring-4 ring-white ring-opacity-50 scale-105' : ''
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">👀</span>
              <div className="text-left">
                <div className="font-semibold">Ver Todas las Categorías</div>
                <div className="text-sm text-gray-300">Monitorear todos los equipos</div>
              </div>
            </div>
            
            {selectedCategory === 0 && isLoading && (
              <div className="flex items-center space-x-2 mt-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="text-sm">Cargando...</span>
              </div>
            )}
          </button>
        </div>

        {/* Footer con información adicional */}
        <div className="mt-12 text-center text-gray-400">
          <p className="text-sm">
            Sistema de Transmisión Multipantalla ASDU - Panel de Administración
          </p>
          <p className="text-xs mt-1">
            Puedes cambiar de categoría en cualquier momento desde el dashboard
          </p>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  try {
    // Obtener cookies del contexto
    const cookies = nookies.get(context);
    const token = cookies.token;

    // Si no hay token, redirigir al login
    if (!token) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    // Hacer petición al backend para verificar el token y obtener datos del usuario
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Verificar que el usuario sea ADMIN
    if (response.data.user.role !== 'ADMIN') {
      return {
        redirect: {
          destination: '/compartir',
          permanent: false,
        },
      };
    }

    // Si todo está bien, pasar los datos del usuario como props
    return {
      props: {
        user: response.data.user,
      },
    };

  } catch (error) {
    // Si el token es inválido o hay error, redirigir al login
    console.error('Error en getServerSideProps:', error);
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }
}
