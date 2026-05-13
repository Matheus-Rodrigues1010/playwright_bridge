FROM node:20-bookworm

# Define a pasta de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência primeiro (para aproveitar o cache do Docker)
COPY package*.json ./

# Instala as dependências do Node.js
RUN npm install

# Instala o Playwright e TODAS as dependências de sistema (navegador Chromium)
RUN npx playwright install --with-deps chromium

# Copia o resto do código da aplicação
COPY . .

# Faz o build do Next.js
RUN npm run build

# Expõe a porta que o Next.js vai rodar
EXPOSE 3000

# Variável de ambiente padrão para o Next.js escutar em todas as interfaces
ENV PORT=3000
ENV HOST=0.0.0.0

# Comando para iniciar o servidor
CMD ["npm", "run", "start"]
