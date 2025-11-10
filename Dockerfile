# syntax=docker/dockerfile:1
#
# JS-TOD Dockerfile
# Builds a reproducible environment for running JS-TOD on any Jest-based project.

FROM node:20-slim AS build
WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy the source code
COPY . .

# Build runtime image (cleaner, smaller)
FROM node:20-slim AS runtime
WORKDIR /app

# Copy app and pruned dependencies
COPY --from=build /app /app
RUN npm prune --omit=dev || true

# Create non-root user for safety
RUN useradd -m -u 10001 appuser
USER appuser

# Default entrypoint for JS-TOD (adjust if your main file is runner.js)
ENTRYPOINT ["node", "reorderRunner.js"]
CMD ["--help"]
