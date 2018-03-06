FROM node:boron

WORKDIR /opt/app

COPY . /opt/app
RUN npm install

EXPOSE 30000
ENV CORE_PORT=30000
VOLUME /opt/app/config/conf
VOLUME /opt/app/cache
CMD /usr/local/bin/node atajo.core.js
