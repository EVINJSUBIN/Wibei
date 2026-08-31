FROM node:20-bookworm-slim

# Install python3, ffmpeg, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
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

# Install npm dependencies without triggering postinstall
RUN npm install --omit=dev --ignore-scripts

# Copy all source files
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
