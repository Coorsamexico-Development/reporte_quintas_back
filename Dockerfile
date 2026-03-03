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
# Eliminamos dependencias de desarrollo para mantener la imagen de producción ligera
RUN npm prune --production

# 4. Runner stage - Imagen final para producción
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001

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

EXPOSE 3001

# Script para ejecutar migraciones y arrancar la aplicación
# Usamos deploy para aplicar migraciones pendientes sin resetear la DB
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

