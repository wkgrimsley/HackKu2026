# Stage 1: Build the React frontend
FROM node:20 AS frontend-builder

WORKDIR /app/client

# Install frontend dependencies
COPY client/package*.json ./
RUN npm install

# Copy client source files (excluding node_modules)
COPY client/src ./src
COPY client/index.html client/vite.config.js client/eslint.config.js ./

# Build the React app
RUN npm run build

# Stage 2: Set up the production environment
FROM node:20

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install

# Copy backend code
COPY server.js ./
COPY matchmaking.js ./
COPY gameManager.js ./
COPY friendsurely.js ./
COPY friendsgame.js ./
COPY circlephysics.js ./

# Copy built React files to the public directory
COPY --from=frontend-builder /app/client/dist ./public

EXPOSE 80

CMD ["node", "server.js"]
