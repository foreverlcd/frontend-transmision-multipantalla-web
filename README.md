# 🎥 Frontend - Transmisión Multipantalla Web

## 📋 Descripción
Frontend para el sistema de transmisión multipantalla desarrollado con Next.js 15, React 19, TypeScript y Tailwind CSS. Proporciona una interfaz moderna para la autenticación de usuarios y transmisión de video en tiempo real.

## 🛠️ Tecnologías Utilizadas
- **Next.js 15** - Framework de React con Turbopack
- **React 19** - Biblioteca de interfaz de usuario
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Framework de CSS utilitario
- **Socket.io Client** - Comunicación en tiempo real
- **Axios** - Cliente HTTP
- **Simple Peer** - WebRTC para video P2P
- **Nookies** - Manejo de cookies en Next.js

## 📋 Requisitos Previos
- Node.js (versión 18 o superior)
- npm (incluido con Node.js)
- Backend ejecutándose en `http://localhost:3001`

## 🚀 Instalación y Configuración

### Paso 1: Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd frontend-transmision-multipantalla-web
```

### Paso 2: Instalar dependencias
```bash
npm install
```

### Paso 3: Configurar variables de entorno
Crea el archivo `.env.local`:
```bash
# Contenido del archivo .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Paso 4: Iniciar el servidor de desarrollo
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🎮 Scripts Disponibles

```bash
# Desarrollo - Inicia con Turbopack (recomendado)
npm run dev

# Desarrollo alternativo - Inicia con Turbopack explícito
npm run dev:turbo

# Construcción para producción
npm run build

# Servidor de producción
npm start
```

## 🌐 Páginas y Rutas

### 📄 Páginas Principales
- `/` - Página principal
- `/login` - Inicio de sesión
- `/compartir` - Compartir pantalla/video
- `/monitor` - Monitorear transmisiones

### 🔐 Autenticación
La aplicación utiliza autenticación basada en JWT:
- Tokens almacenados en cookies y localStorage
- Protección de rutas mediante middleware
- Contexto de autenticación global

## 👥 Credenciales de Prueba

### 👨‍💼 Administrador
- **Email:** `admin@asdu.com`
- **Contraseña:** `admin123`

### 👥 Participantes - Equipo Alfa
- **Email:** `p1.alfa@email.com` | **Contraseña:** `participante123`
- **Email:** `p2.alfa@email.com` | **Contraseña:** `participante123`

### 👥 Participantes - Equipo Beta
- **Email:** `p1.beta@email.com` | **Contraseña:** `participante123`
- **Email:** `p2.beta@email.com` | **Contraseña:** `participante123`

## 📁 Estructura del Proyecto
```
frontend-transmision-multipantalla-web/
├── components/              # Componentes reutilizables
│   ├── CompartirComponent.tsx
│   ├── MonitorComponent.tsx
│   └── VideoPlayer.tsx
├── context/                # Contextos de React
│   └── AuthContext.tsx
├── pages/                  # Páginas de Next.js
│   ├── _app.tsx           # Configuración global de la app
│   ├── index.tsx          # Página principal
│   ├── login.tsx          # Página de login
│   ├── compartir.tsx      # Página para compartir
│   ├── monitor.tsx        # Página de monitoreo
│   └── api/               # API routes de Next.js
├── styles/                # Estilos globales
│   └── globals.css
├── public/                # Recursos estáticos
├── .env.local            # Variables de entorno (crear manualmente)
├── next.config.ts        # Configuración de Next.js
├── tailwind.config.js    # Configuración de Tailwind
├── tsconfig.json         # Configuración de TypeScript
└── package.json          # Dependencias y scripts
```

## 🚀 Uso en Desarrollo

### 1. Asegúrate de que el backend esté ejecutándose:
```bash
# En el directorio del backend
cd ../backend-transmision-multipantalla-web
npm run dev
```

### 2. Inicia el frontend:
```bash
# En el directorio del frontend
npm run dev
```

### 3. Accede a la aplicación:
- Aplicación: `http://localhost:3000`
- Login: `http://localhost:3000/login`

## 🔧 Características Principales

### 🔐 Sistema de Autenticación
- Login con email y contraseña
- Gestión de tokens JWT
- Protección de rutas
- Contexto de usuario global

### 📺 Transmisión de Video
- Compartir pantalla/cámara
- Visualización en tiempo real
- Comunicación WebRTC P2P
- Socket.io para señalización

### 🎨 Interfaz de Usuario
- Diseño responsivo con Tailwind CSS
- Componentes modulares
- Estados de carga y error
- Navegación intuitiva

## 🐛 Solución de Problemas

### Error: "Cannot connect to backend"
1. Verifica que el backend esté ejecutándose en el puerto 3001
2. Confirma que el archivo `.env.local` contenga la URL correcta
3. Revisa la consola del navegador para errores de CORS

### Error de módulos ES/CommonJS
Si ves advertencias sobre módulos, es normal. El proyecto está configurado para usar módulos ES.

### Error de TypeScript
Asegúrate de que todas las dependencias de tipos estén instaladas:
```bash
npm install --save-dev @types/node @types/react @types/react-dom
```

## 🚀 Despliegue

### Construcción para Producción
```bash
npm run build
npm start
```

### Variables de Entorno para Producción
Configura en tu plataforma de despliegue:
```env
NEXT_PUBLIC_BACKEND_URL=https://tu-backend-url.com
```

## 🤝 Contribución
1. Fork el proyecto
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit los cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📞 Soporte
Si encuentras problemas, revisa:
1. Que el backend esté ejecutándose en el puerto 3001
2. Que el archivo `.env.local` esté configurado
3. Que todas las dependencias estén instaladas
4. Que el puerto 3000 esté disponible
5. La consola del navegador para errores específicos

## 🔗 Enlaces Útiles
- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de React](https://react.dev/)
- [Documentación de Tailwind CSS](https://tailwindcss.com/docs)
- [Documentación de TypeScript](https://www.typescriptlang.org/docs/)
