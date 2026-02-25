FROM node:18-alpine

WORKDIR /app

# Bağımlılıkları önce kopyala (cache için)
COPY package*.json ./
RUN npm install --omit=dev

# Uygulama dosyalarını kopyala
COPY . .

# Upload ve backup klasörleri
RUN mkdir -p uploads/logos backups

EXPOSE 80

ENV PORT=80
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
