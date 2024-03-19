test: test.client

test.client:
	cd packages/client; bun test:sqlite-worker
	cd packages/client; bun test:sqlite
	cd packages/client; bun test:pg

build: build.client

build.client: build.client.bundle build.client.types

build.client.bundle:
	cd packages/client && bun run build:bundle

build.client.types:
	cd packages/client && bun run build:types
