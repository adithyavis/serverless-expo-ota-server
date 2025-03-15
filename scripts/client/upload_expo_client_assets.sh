#!/usr/bin/env bash

RUNTIME_VERSION=1.0.0 # The runtime version of the client app
EXPO_UPDATES_SERVER_URL=https://ota-server.com # The URL of the OTA server
EXPO_UPDATES_ASSETS_URL=https://ota-assets.com # The URL of the cloudfront distribution that points to the s3 bucket
EXPO_UPDATES_S3_BUCKET_NAME=ota # The name of the s3 bucket
MANDATORY=true # Whether the update is mandatory or not

export RUNTIME_VERSION
export EXPO_UPDATES_SERVER_URL
export EXPO_UPDATES_ASSETS_URL
export MANDATORY

uploadPath=$(echo "$(curl -s -H "Expo-Runtime-Version: $RUNTIME_VERSION" $EXPO_UPDATES_SERVER_URL/get-upload-path)" | jq -r '.path')
export uploadPath

echo "Upload path: $(tput setaf 3)$(echo $uploadPath)$(tput sgr0)"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[y]$ ]]; then
    echo "Invalid input. To continue, press y."
    exit 1
fi

npx expo export
node ./otaScripts/exportClientExpoConfig.js
node ./otaScripts/generateManifests.js

aws s3 cp ./dist/assets s3://$EXPO_UPDATES_S3_BUCKET_NAME/$uploadPath/assets --recursive
aws s3 cp ./dist/bundles s3://$EXPO_UPDATES_S3_BUCKET_NAME/$uploadPath/bundles --recursive --content-type "application/javascript"
aws s3 cp ./dist/metadata.json s3://$EXPO_UPDATES_S3_BUCKET_NAME/$uploadPath/metadata.json
aws s3 cp ./dist/expoConfig.json s3://$EXPO_UPDATES_S3_BUCKET_NAME/$uploadPath/expoConfig.json
aws s3 cp ./dist/manifests s3://$EXPO_UPDATES_S3_BUCKET_NAME/$uploadPath/manifests --recursive 

curl -s -H "Expo-Runtime-Version: $RUNTIME_VERSION" -H "Expo-Ota-Update-Version: $(echo "$uploadPath" | awk -F '/' '{print $2}')" $EXPO_UPDATES_SERVER_URL/sync-with-db