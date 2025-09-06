// pages/index.tsx
import Link from 'next/link';

export default function HomePage() {
  return (
   <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
    <h1 className="text-5xl font-bold mb-4">ASDU Hackathon Monitor</h1>
    <p className="text-xl text-gray-400 mb-8">Plataforma de monitoreo en tiempo real.</p>
    <div className="space-x-4">
      <Link href="/login" className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition">
      Iniciar Sesión
      </Link>
    </div>
   </div>
  );
}