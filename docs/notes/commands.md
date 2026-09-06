## Docker

### Delete and restart a docker volume

docker compose -f .\docker-compose-dev.yml down
docker volume ls
docker volume rm scriptbench_backend-data
docker compose -f .\docker-compose-dev.yml up -d --build

### Remove an in-use Postgres volume

docker ps -a --filter volume=scriptbench_postgres-data
docker rm <container-id>
docker volume rm scriptbench_postgres-data

## Error Handling
