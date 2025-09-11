// pages/index.tsx
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Fondo */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/img/ImagenPrincipal.png"
          alt="Imagen de fondo con temática tecnológica"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Contenido principal */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 py-12 rounded-2xl shadow-2xl bg-gray-900/80 max-w-lg w-full text-center">
        <h1 className="text-5xl font-extrabold mb-4 text-white drop-shadow-lg">
          ASDU Hackathon Monitor
        </h1>
        <p className="text-xl text-gray-300 mb-8 drop-shadow">
          Plataforma de monitoreo en tiempo real.
        </p>

        <Link
          href="/login"
          className="px-8 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-200 text-lg font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Iniciar Sesión
        </Link>
      </section>
    </main>
  );
}
