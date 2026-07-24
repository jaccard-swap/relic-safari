FROM node:25

WORKDIR /app/shared/database

# Copy only what we need - no workspace complexity
COPY shared/database/package.json ./
COPY shared/database/drizzle.config.ts ./
COPY tsconfig.base.json /app/

# Install deps directly - esbuild needs optionalDependencies for platform binaries
RUN npm cache clean --force && npm install

# Copy source
COPY shared/database/src ./src

# Default command runs migrations and seeds
CMD ["npm", "run", "db:setup"]
