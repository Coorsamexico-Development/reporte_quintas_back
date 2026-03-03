# 1. Base stage - Instalación de dependencias básicas
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# 2. Dependencies stage - Instalación de dependencias de producción y desarrollo
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
# Instalamos todas las dependencias para poder construir el proyecto
RUN npm ci

# 3. Builder stage - Construcción de la aplicación
FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build
# NOTA: No hacemos prune aquí para mantener el CLI de prisma disponible
# Si el tamaño es crítico, se podría mover prisma a dependencies en package.json

# 4. Runner stage - Imagen final para producción
FROM base AS runner
ENV NODE_ENV=production
# Dejamos que Cloud Run defina el PORT (default 8080)
ENV PORT=8080

# Crear usuario no root para seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copiar archivos necesarios desde las etapas anteriores
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Ajustar permisos
RUN chown -R nestjs:nodejs /app

USER nestjs

# Cloud Run escucha por defecto en el 8080
EXPOSE 8080

# Script para ejecutar migraciones y arrancar la aplicación
# Usamos un script de una sola línea más robusto para capturar errores
CMD sh -c "echo '🔍 Iniciando proceso de despliegue...'; \
           echo '📂 Aplicando migraciones de base de datos...'; \
           npx prisma migrate deploy || { echo '❌ ERROR: Fallaron las migraciones de Prisma. Revisa la conexión a la DB.'; exit 1; }; \
           echo '🚀 Migraciones completadas. Arrancando servidor...'; \
           node dist/main.js"


