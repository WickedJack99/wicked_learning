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
COPY public/images/logo.png /usr/share/nginx/html/images/logo.png
COPY public/images/themes/journal-paper-leather-background.png /usr/share/nginx/html/images/themes/journal-paper-leather-background.png

EXPOSE 80
