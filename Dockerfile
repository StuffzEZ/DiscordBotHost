FROM node:20-alpine

# Install Python and other tools bots might need
RUN apk add --no-cache python3 py3-pip git curl bash

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

# Bot data (env vars, code, logs) persisted via volume
VOLUME ["/bot-data"]

EXPOSE 3000

CMD ["node", "server.js"]
