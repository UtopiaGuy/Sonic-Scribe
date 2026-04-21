FROM node:20-bookworm-slim

# Install ffmpeg and whisper.cpp build dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    build-essential \
    clang \
    cmake \
    git \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Build whisper.cpp from source 
WORKDIR /tmp/whisper
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git . && \
    cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++ && \
    cmake --build build --config Release -j$(nproc) && \
    cp build/bin/whisper-cli /usr/local/bin/ && \
    chmod +x /usr/local/bin/whisper-cli && \
    find build -type f -name "*.so*" -exec cp {} /usr/local/lib/ \; && \
    ldconfig && \
    cd / && rm -rf /tmp/whisper

# Set up app
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Create directories
RUN mkdir -p /app/uploads /app/data /app/whisper/models

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3001/ || exit 1

CMD ["node", "server.js"]
