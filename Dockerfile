FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/views ./src/views
COPY --from=build /app/src/public ./src/public
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
CMD ["sh", "-c", "npm exec -- prisma migrate deploy && node dist/src/server.js"]
