FROM node:boron

WORKDIR /opt/atajo

COPY . /opt/atajo
RUN npm install

EXPOSE 30000

ENV CORE_PORT=30000

VOLUME /opt/atajo/config
VOLUME /opt/atajo/cache

CMD node atajo.core.js
