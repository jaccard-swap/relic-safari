FROM node:25

WORKDIR /app

# Copy root package.json for workspace setup
COPY package.json package-lock.json ./

# Copy package files for all workspaces
COPY web/package.json ./web/
COPY shared/constants/package.json ./shared/constants/
COPY shared/contracts/package.json ./shared/contracts/

# Install all dependencies from root (workspace linking)
RUN npm install

# Copy source files (needed for building)
COPY shared/constants ./shared/constants
COPY shared/contracts ./shared/contracts
COPY tsconfig.base.json ./

# Build shared/constants first
WORKDIR /app/shared/constants
RUN npm run build

# Copy web source files
WORKDIR /app
COPY web ./web

WORKDIR /app/web

CMD ["npm", "run", "dev"]
