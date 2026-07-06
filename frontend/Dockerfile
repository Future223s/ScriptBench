FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG API_BASE_URL
RUN npm run build

EXPOSE 3000

CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]