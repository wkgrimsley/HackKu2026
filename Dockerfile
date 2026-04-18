FROM node:18

WORKDIR /app

# Install server dependencies
COPY package*.json ./
RUN npm install

# Copy server code
COPY server.js .

# Copy built React files (NOT the React source)
COPY public ./public

EXPOSE 80

CMD ["node", "server.js"]
