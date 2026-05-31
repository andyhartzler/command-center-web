# command-center-web — self-hosted (lenovo-worker) image
# Build stage: install all deps (incl. dev) and produce the Next build.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run stage: production runtime, `next start` on PORT.
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/next.config.ts ./next.config.ts
# OAuth token stores (Nest/Withings) persist under /app/data when not on Vercel.
RUN mkdir -p /app/data
EXPOSE 3001
CMD ["npm", "start"]
