FROM node:20
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY src ./src
CMD [ "node", "/usr/src/app/src/action.js" ]
