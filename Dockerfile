# 1. Usa Node.js per installare le librerie e compilare il software
FROM node:18 AS build
WORKDIR /app

# Copia i file che elencano le librerie necessarie
COPY package*.json ./
RUN npm install

# Copia tutto il resto del codice (cartella components, src, ecc.)
COPY . .

# Crea la versione finale del sito (compilazione)
RUN npm run build

# 2. Prepara un server leggero per mostrare il sito sul web
FROM node:18-slim
RUN npm install -g serve
WORKDIR /app

# Prendi i file pronti dalla fase di build (solitamente nella cartella dist)
COPY --from=build /app/dist ./dist

# Diciamo a Google di usare la porta 8080
EXPOSE 8080

# Comando per avviare il server
CMD ["serve", "-s", "dist", "-l", "8080"]
