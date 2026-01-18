# --- FASE 1: Costruzione (Builder) ---
FROM node:20 AS builder
WORKDIR /app

# Copia i file di configurazione
COPY package*.json ./
RUN npm install

# Copia tutto il codice (incluse le cartelle components e utils)
COPY . .

# Compila il progetto
RUN npm run build

# --- FASE 2: Esecuzione (Server) ---
FROM node:20-slim
RUN npm install -g serve
WORKDIR /app

# Prendi i file pronti dalla fase "builder"
COPY --from=builder /app/dist ./dist

# Apri la porta per Google
EXPOSE 8080

# Avvia
CMD ["serve", "-s", "dist", "-l", "8080"]
