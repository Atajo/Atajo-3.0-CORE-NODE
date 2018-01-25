FROM node:boron

WORKDIR /opt/app

COPY package.json /opt/app
RUN npm install

EXPOSE 30000

