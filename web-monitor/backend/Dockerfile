# Dockerfile for backend

# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
COPY package*.json ./

# Install any needed packages
RUN npm install

# Bundle app source
COPY . .

# Compile TypeScript
RUN npm run build

# Your app binds to port 3001
EXPOSE 3001

# Define the command to run your app
CMD [ "node", "dist/server.js" ]
