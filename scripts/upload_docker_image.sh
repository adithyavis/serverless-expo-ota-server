#!/usr/bin/env bash

# Replace with your own value
ECR_REPOSITORY=xxxx121324.dkr.ecr.us-west-2.amazonaws.com/serverless-expo-ota-server

docker build -t serverless-expo-ota-server . --platform=linux/amd64 --no-cache                           
docker tag serverless-expo-ota-server:latest $ECR_REPOSITORY:latest
docker push $ECR_REPOSITORY:latest
