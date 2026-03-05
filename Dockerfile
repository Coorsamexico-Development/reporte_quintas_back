# 1. Base stage - Instalación de dependencias básicas
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

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
# Usamos un script más detallado para facilitar la depuración en Cloud Run
CMD ["sh", "-c", "echo \"🔍 [$(date '+%Y-%m-%d %H:%M:%S')] Iniciando proceso de arranque en Cloud Run...\"; \
           echo \"📡 [$(date '+%Y-%m-%d %H:%M:%S')] Verificando conexión con la base de datos...\"; \
           if [ -z \"$DATABASE_URL\" ]; then echo \"❌ [$(date '+%Y-%m-%d %H:%M:%S')] ERROR: DATABASE_URL no está definida.\"; exit 1; fi; \
           echo \"📂 [$(date '+%Y-%m-%d %H:%M:%S')] Aplicando migraciones de Prisma...\"; \
           npx prisma migrate deploy || { echo \"❌ [$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Fallaron las migraciones. Revisa los logs de Cloud SQL Proxy o la red.\"; exit 1; }; \
           echo \"🚀 [$(date '+%Y-%m-%d %H:%M:%S')] Migraciones exitosas. Iniciando servidor NestJS...\"; \
           node dist/main.js"]


