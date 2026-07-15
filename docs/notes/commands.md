## Docker

### Delete and restart a docker volume

docker compose -f .\docker-compose-dev.yml down
docker volume ls
docker volume rm scriptbench_backend-data
docker compose -f .\docker-compose-dev.yml up -d --build 

## Error Handling

