FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

EXPOSE 8080

USER node

CMD ["npm", "start"]