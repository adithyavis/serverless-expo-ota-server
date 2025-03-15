export class NoUpdateAvailableError extends Error {}

export class UpdateNotFoundError extends Error {}

export function createNoUpdateAvailableDirectiveAsync() {
  return {
    type: 'noUpdateAvailable',
  };
}

export function getPartitionKey(platform: string, runtimeVersion: string) {
  return `${platform}-${runtimeVersion}`;
}
