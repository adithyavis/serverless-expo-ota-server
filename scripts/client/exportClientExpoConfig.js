import ExpoConfig from '@expo/config';
import fs from 'fs/promises';

const { exp } = ExpoConfig.getConfig('..', {
  skipSDKVersionRequirement: true,
  isPublicConfig: true,
});

async function exportExpoConfig() {
  await fs.writeFile(`./dist/expoConfig.json`, JSON.stringify(exp));
}
exportExpoConfig();
