# Containerizing Sonic Scribe

Sonic Scribe v2 utilizes Docker Compose to streamline deployment. However, it uniquely bridges the gap between isolated containers and host-level native AI processes.

## Architecture Paradigm

Because LLM models (like Gemma 4) effectively require raw access to the host's GPU/Metal architecture to maintain low latency inference, running `Unsloth` within Docker introduces significant overhead and virtualization complexity for macOS environments.

Therefore, our containerization strategy separates concerns:
- **Dockerized:** The React Frontend and Node.js Backend 
- **Host Native:** The `Unsloth Studio` LLM endpoint

### The `host.docker.internal` Bridge
To allow the containerized backend to securely query the native Unsloth Server sitting on your Mac's `localhost:8888`, we utilize the docker proxy DNS routing:
```yaml
environment:
  - UNSLOTH_URL=http://host.docker.internal:8888
```

This ensures that the containerized API can talk directly to your physical host machine without requiring complex network bridges.

## Volume Mounting for Obsidian

Because Obsidian Vaults live on your physical host drive, the Docker container must volume mount the external directory into `/obsidian`.
The `docker-compose.yml` dynamically manages this:
```yaml
volumes:
  - /Users/bill/Syrcuse:/obsidian
```
The Backend API will translate this virtual path implicitly into the user's local directory tree when routing finalized transcripts!

## Deployment Command
Always run the stack using the built-in composer:
```bash
docker compose up --build
```