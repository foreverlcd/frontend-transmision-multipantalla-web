import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Deshabilitar el overlay de errores en desarrollo para errores específicos
  onDemandEntries: {
    // Opcional: configurar el overlay de errores
  },
  // Configuración para Turbopack (nueva sintaxis)
  turbopack: {
    root: process.cwd(),
    // Configuraciones específicas de Turbopack si es necesario
  }
};

export default nextConfig;
