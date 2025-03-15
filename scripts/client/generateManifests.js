import path from 'path';
import fs from 'fs/promises';
import mime from 'mime';
import crypto from 'crypto';

const runtimeVersion = process.env.RUNTIME_VERSION;
const mandatory = process.env.MANDATORY;
const uploadPath = process.env.uploadPath;
const expoUpdatesAssetsUrl = process.env.EXPO_UPDATES_ASSETS_URL;

if (!uploadPath) {
  process.exit(1);
}
const otaUpdateVersion =
  uploadPath.split('/')[uploadPath.split('/').length - 1];

async function generateManifests() {
  for (const platform of ['android', 'ios']) {
    const manifest = await generateManifest(platform);
    await fs.mkdir('./dist/manifests', { recursive: true });
    await fs.writeFile(
      `./dist/manifests/${platform}.json`,
      JSON.stringify(manifest),
    );
  }
}
generateManifests();

async function generateManifest(platform) {
  const { metadataJson, createdAt, id } = await getMetadataAsync({
    filePath: `./dist/metadata.json`,
  });
  const expoConfig = await getExpoConfigAsync({
    filePath: `./dist/expoConfig.json`,
  });
  const platformSpecificMetadata = metadataJson.fileMetadata[platform];
  const manifest = {
    id: convertSHA256HashToUUID(id),
    createdAt,
    runtimeVersion,
    assets: await Promise.all(
      platformSpecificMetadata.assets.map((asset) =>
        getAssetMetadataAsync({
          filePath: `${asset.path}`,
          ext: asset.ext,
          runtimeVersion,
          platform,
          isLaunchAsset: false,
        }),
      ),
    ),
    launchAsset: await getAssetMetadataAsync({
      filePath: `${platformSpecificMetadata.bundle}`,
      isLaunchAsset: true,
      runtimeVersion,
      platform,
      ext: null,
    }),
    metadata: {},
    extra: {
      expoClient: expoConfig,
      mandatory: mandatory === 'y' || mandatory === 'Y',
      otaUpdateVersion,
    },
  };
  return manifest;
}

function createHash(file, hashingAlgorithm, encoding) {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding);
}

function getBase64URLEncoding(base64EncodedString) {
  // eslint-disable-next-line no-div-regex
  return base64EncodedString
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function getAssetMetadataAsync({ filePath, ...arg }) {
  const assetFilePath = `./dist/${filePath}`;
  const asset = await fs.readFile(path.resolve(assetFilePath), null);
  const assetHash = getBase64URLEncoding(createHash(asset, 'sha256', 'base64'));
  const key = createHash(asset, 'md5', 'hex');
  const keyExtensionSuffix = arg.isLaunchAsset ? 'bundle' : arg.ext;
  const contentType = arg.isLaunchAsset
    ? 'application/javascript'
    : mime.getType(arg.ext);

  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url: `${expoUpdatesAssetsUrl}/${uploadPath}/${filePath}`,
  };
}

export async function getMetadataAsync({ filePath }) {
  try {
    const metadataPath = filePath;
    const updateMetadataBuffer = await fs.readFile(
      path.resolve(metadataPath),
      null,
    );
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'));
    const metadataStat = await fs.stat(metadataPath);

    return {
      metadataJson,
      createdAt: new Date(metadataStat.birthtime).toISOString(),
      id: createHash(updateMetadataBuffer, 'sha256', 'hex'),
    };
  } catch (error) {
    throw new Error(
      `No update found with runtime version: ${runtimeVersion}. Error: ${error}`,
    );
  }
}

export async function getExpoConfigAsync({ filePath }) {
  try {
    const expoConfigPath = filePath;
    const expoConfigBuffer = await fs.readFile(
      path.resolve(expoConfigPath),
      null,
    );
    const expoConfigJson = JSON.parse(expoConfigBuffer.toString('utf-8'));
    return expoConfigJson;
  } catch (error) {
    throw new Error(
      `No expo config json found with runtime version: ${runtimeVersion}. Error: ${error}`,
    );
  }
}

function convertSHA256HashToUUID(value) {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
    16,
    20,
  )}-${value.slice(20, 32)}`;
}
