FROM node:boron

RUN apt-get update \
 && apt-get install -y --force-yes --no-install-recommends \
      apt-transport-https \
      curl \
      ca-certificates \
 && apt-get clean \
 && apt-get autoremove \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/atajo

COPY package.json /opt/atajo
RUN npm install
COPY . /opt/atajo

EXPOSE 30000

ENV CORE_PORT=30000

VOLUME /opt/atajo/config
VOLUME /opt/atajo/cache

CMD node atajo.core.js
