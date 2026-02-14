# Custom NATS image with JetStream enabled for CI testing
FROM nats:2.12-alpine

# Override the default command to enable JetStream and monitoring
# The base image has ENTRYPOINT ["nats-server"] so we just provide the args
CMD ["--jetstream", "--store_dir", "/data", "-m", "8222"]
