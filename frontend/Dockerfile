FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
COPY contracts/openapi /contracts/openapi
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY public/images/ /usr/share/nginx/html/images/
COPY public/sounds/ /usr/share/nginx/html/sounds/

EXPOSE 80
