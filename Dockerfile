# ========================================
# Production Dockerfile for Rentverse Backend
# Optimized for GitLab CI/CD deployment
# Using Debian Bullseye for OpenSSL 1.1 (Prisma requirement)
# ========================================
FROM node:20-bullseye-slim

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs expressjs

# Copy package files
COPY --chown=expressjs:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy prisma schema (needed before install for generation)
COPY --chown=expressjs:nodejs prisma ./prisma

# Install dependencies
# Use || true to allow husky to fail gracefully (no git in container)
RUN pnpm install --frozen-lockfile --prod=false || true

# Generate Prisma Client
RUN pnpm prisma generate

# Copy application source
COPY --chown=expressjs:nodejs src ./src
COPY --chown=expressjs:nodejs index.js ./
COPY --chown=expressjs:nodejs templates ./templates

# Set ownership for application files
RUN chown -R expressjs:nodejs /app

# Switch to non-root user
USER expressjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "index.js"]
