import { GetServerSidePropsContext } from 'next';
import nookies from 'nookies';
import axios from 'axios';
import CompartirComponent from '../components/CompartirComponent';

interface User {
  id: number;
  email: string;
  role: string;
  teamId: number | null;
}

interface CompartirPageProps {
  user: User;
}

export default function CompartirPage({ user }: CompartirPageProps) {
  return <CompartirComponent user={user} />;
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

    // Verificar el rol del usuario
    if (response.data.user.role === 'ADMIN') {
      // Si es ADMIN, redirigir a /monitor
      return {
        redirect: {
          destination: '/monitor',
          permanent: false,
        },
      };
    } else if (response.data.user.role === 'PARTICIPANT') {
      // Si es PARTICIPANT, pasar los datos del usuario como props
      return {
        props: {
          user: response.data.user,
        },
      };
    } else {
      // Si es un rol no reconocido, redirigir al login
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

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
