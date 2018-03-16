FROM node:boron

WORKDIR /opt/app

COPY . /opt/app
RUN npm install

EXPOSE 30000

ENV CORE_PORT=30000

VOLUME /opt/app/config
VOLUME /opt/app/cache

CMD node atajo.core.js
