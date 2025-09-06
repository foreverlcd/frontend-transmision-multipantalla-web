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
}

export default function MonitorPage({ user }: MonitorPageProps) {
  return <MonitorComponent user={user} />;
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
