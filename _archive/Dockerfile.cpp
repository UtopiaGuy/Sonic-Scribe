
# Use a base image with build tools
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    make \
    cmake \
    libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the source code
COPY . .

# Compile the C++ application
RUN g++ -std=c++17 -o C++_VR_App C++_VR_App.cpp -lcurl

# Set the entrypoint
CMD ["./C++_VR_App"]

