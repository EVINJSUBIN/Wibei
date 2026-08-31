FROM node:20-bookworm-slim

# Install system audio and download utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Download official standalone yt-dlp Linux binary directly
RUN mkdir -p /app/bin && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /app/bin/yt-dlp && \
    chmod a+rx /app/bin/yt-dlp

# Copy package manifests
COPY package*.json ./

# Install npm dependencies without triggering postinstall (since yt-dlp was already downloaded)
RUN npm install --omit=dev --ignore-scripts

# Copy all source files
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
