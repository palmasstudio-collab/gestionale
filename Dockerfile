# 1. Fase di Build: usa Node.js per scaricare le librerie e compilare il codice
FROM node:20 AS build
WORKDIR /app

# Copia i file delle dipendenze per installare i pacchetti necessari
COPY package*.json ./
RUN npm install

# Copia tutto il resto del codice sorgente (compresa la cartella components)
COPY . .

# Esegue la compilazione del progetto (genera la cartella /dist)
RUN npm run build

# 2. Fase di Esecuzione: usa un server leggero per servire l'app sul web
FROM node:18-slim
RUN npm install -g serve
WORKDIR /app

# Copia i file compilati dalla fase precedente
# Nota: Vite solitamente crea una cartella chiamata 'dist'
COPY --from=build /app/dist ./dist

# Cloud Run richiede l'ascolto sulla porta 8080
EXPOSE 8080

# Avvia il server statico
CMD ["serve", "-s", "dist", "-l", "8080"]

