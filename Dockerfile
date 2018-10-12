FROM node:boron

WORKDIR /opt/atajo

COPY package.json /opt/atajo
RUN npm install
RUN mkdir logs
COPY . /opt/atajo

EXPOSE 30000

ENV CORE_PORT=30000

VOLUME /opt/atajo/config
VOLUME /opt/atajo/cache

CMD node atajo.core.js
