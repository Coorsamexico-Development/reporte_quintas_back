# Etapa de construcción
FROM node:20-slim AS builder

WORKDIR /app

# Instalar dependencias necesarias para la construcción (opcional si son binarios específicos)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código fuente y el schema de Prisma
COPY . .

# Generar el cliente de Prisma
RUN npx prisma generate

# Compilar la aplicación NestJS
RUN npm run build

# Etapa de producción
FROM node:20-slim AS runner

WORKDIR /app

# Instalar dependencias de tiempo de ejecución
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

# Copiar package.json y dependencias
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Variables de entorno por defecto (se sobreescriben en Cloud Run)
ENV NODE_ENV=production
ENV PORT=8080

# Exponer el puerto
EXPOSE 8080

# Scripts de inicio (Asegura la ruta correcta a dist/src/main.js)
CMD ["node", "dist/src/main.js"]
