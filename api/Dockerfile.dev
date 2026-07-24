FROM node:25

WORKDIR /app

# Copy root package.json for workspace setup
COPY package.json package-lock.json ./

# Copy package files for all workspaces
COPY api/package.json api/package-lock.json ./api/
COPY shared/database/package.json shared/database/package-lock.json ./shared/database/
COPY shared/constants/package.json ./shared/constants/
COPY shared/contracts/package.json ./shared/contracts/

# Install all dependencies from root (workspace linking)
RUN npm install

# Copy source files (needed for building)
COPY shared/database ./shared/database
COPY shared/constants ./shared/constants
COPY shared/contracts ./shared/contracts
COPY tsconfig.base.json ./

# Build shared/database first
WORKDIR /app/shared/database
RUN npm run build

# Build shared/constants
WORKDIR /app/shared/constants
RUN npm run build

# Copy API source files
WORKDIR /app
COPY api ./api

WORKDIR /app/api

CMD ["npm", "run", "dev"]