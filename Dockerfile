# Production Playwright Dockerfile
FROM mcr.microsoft.com/playwright:v1.49.0-noble

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers (already in the image, but ensures correct versions)
RUN npx playwright install --with-deps chromium

# Copy the rest of the application
COPY . .

# Set environment variables (defaults)
ENV NODE_ENV=production
ENV HEADED=0

# Create volume for reports
VOLUME /app/test-results

# Command to run tests (can be overridden)
CMD ["npm", "run", "bdd:regression"]
