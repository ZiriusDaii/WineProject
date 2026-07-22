# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
# Vite solo expone en import.meta.env las vars VITE_* presentes en process.env
# al momento del build -- sin este ARG/ENV, RUN npm run build no la ve y
# App.tsx cae al fallback 'http://localhost:3000', horneado en el bundle.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
