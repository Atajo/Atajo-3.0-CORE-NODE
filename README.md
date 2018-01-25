# Atajo 3.0 Core Node

## Introduction

An Atajo 3.0 Core Node is the essential unit (microservice) of the Atajo Core. It is designed to be n-scale capable, whether vertically on machine across CPUs or horizontally accross machines. 

## Run Modes 
### 1. Locally (Direct on machine)

- This method is good whilst developing and debugging. 
- You can run a core node locally direct on your system with the following command. 

```bash
node atajo.core.js <release> <port>
```

- release (default `dev`) - can be `dev`, `qas` or `prd` - This is mostly used to set the log level of the running core node
- port (default `80`) - The port the core node should listen on for socket connections



### 2. All-In-One Container

- You can also run a core node locally as an all in one docker container which will contains all required services including MongoDB and Redis
- This is good for testing or developer distribution
- Note this container listens on port 30000

```bash
docker-compose -f docker-compose-aio.yml up -d
```


### 3. Standalone Container

- This container contains only the Atajo Core node. 
- This is usually for production implementations where the required database and redis services are provided by the chosen cloud provider

```bash
docker-compose -f docker-compose-prd.yml up -d
```





