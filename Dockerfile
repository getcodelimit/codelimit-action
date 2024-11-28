FROM node:20
WORKDIR /usr/src/app
COPY dist ./dist
CMD [ "node", "dist/index.js" ]
