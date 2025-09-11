import { GetServerSidePropsContext } from 'next';
import nookies from 'nookies';
import axios from 'axios';
import MonitorComponent from '../components/MonitorComponent';

interface User {
  id: number;
  email: string;
  role: string;
  teamId: number | null;
}

interface MonitorPageProps {
  user: User;
  selectedCategory: number | null;
}

export default function MonitorPage({ user, selectedCategory }: MonitorPageProps) {
  return <MonitorComponent user={user} selectedCategory={selectedCategory} />;
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

    // Obtener la categoría de la query string
    const categoryParam = context.query.category;
    let selectedCategory: number | null = null;

    if (categoryParam) {
      const categoryId = parseInt(categoryParam as string, 10);
      if (!isNaN(categoryId) && categoryId >= 0) {
        selectedCategory = categoryId;
      }
    }

    // Si no hay categoría seleccionada, redirigir a la selección de categoría
    if (selectedCategory === null) {
      return {
        redirect: {
          destination: '/category-selection',
          permanent: false,
        },
      };
    }

    // Si todo está bien, pasar los datos del usuario y la categoría como props
    return {
      props: {
        user: response.data.user,
        selectedCategory: selectedCategory,
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
