
FROM node:22.11-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build


FROM node:22.11-alpine as runner

WORKDIR /app

COPY --from=builder /app .
COPY .env ./

EXPOSE 3000

CMD ["yarn", "start:prod"]
