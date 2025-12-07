FROM node:25

WORKDIR /app

# Copy root package.json for workspace setup
COPY package.json package-lock.json ./

# Copy package files for all workspaces
# Note: web uses root package-lock.json (workspace), api has its own
COPY farcaster/package.json ./farcaster/
COPY shared/database/package.json shared/database/package-lock.json ./shared/database/

# Install all dependencies from root (workspace linking)
RUN npm install

# Copy source files
WORKDIR /app
COPY farcaster ./farcaster
COPY shared ./shared
COPY tsconfig.base.json ./

WORKDIR /app/farcaster

CMD ["npm", "run", "dev"]

