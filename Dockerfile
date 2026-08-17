# Multi-stage Dockerfile for ChainJudge Express API Backend Server
FROM node:20-alpine AS base
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server code
COPY server/ ./

EXPOSE 5000
ENV NODE_ENV=production

CMD ["node", "server.js"]
