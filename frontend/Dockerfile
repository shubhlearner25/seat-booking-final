FROM node:18
WORKDIR /usr/src/app

# Install all dependencies including devDependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy rest of code
COPY . .

# Expose Vite port
EXPOSE 3000

# Start Vite dev server inside Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
