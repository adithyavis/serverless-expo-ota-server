import {
  GetObjectAttributesCommandOutput,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { InjectS3, S3 } from 'nestjs-s3';
@Injectable()
export class S3Service {
  constructor(@InjectS3() private readonly s3: S3) {}
  async getLatestOTAUpdateVersion(runtimeVersion: string): Promise<number> {
    const s3params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Delimiter: '/',
      Prefix: `${runtimeVersion}/`,
    };
    return await new Promise((resolve, reject) => {
      this.s3.listObjectsV2(s3params, (err, data) => {
        if (err) {
          reject(err as Error);
        }
        if (!data.CommonPrefixes) {
          throw new Error('Unsupported runtime version');
        }
        const otaUpdateVersions = data.CommonPrefixes.map((prefix) => {
          const parts = prefix.Prefix.split('/');
          return parseInt(JSON.stringify(parts[parts.length - 1]), 10);
        });
        resolve(otaUpdateVersions[otaUpdateVersions.length - 1] as number);
      });
    });
  }

  async getLatestOTAUpdateBundlePath(runtimeVersion: string): Promise<string> {
    const s3params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Delimiter: '/',
      Prefix: `${runtimeVersion}/`,
    };
    return await new Promise((resolve, reject) => {
      this.s3.listObjectsV2(s3params, (err, data) => {
        if (err) {
          reject(err as Error);
          return;
        }
        if (!data.CommonPrefixes) {
          reject(new Error('Unsupported runtime version'));
          return;
        }
        const currentOTAUpdateBundlePath: string =
          data.CommonPrefixes[data.CommonPrefixes.length - 1].Prefix;
        resolve(
          currentOTAUpdateBundlePath.substring(
            0,
            currentOTAUpdateBundlePath.length - 1,
          ),
        );
      });
    });
  }

  async getNextOTAUpdateBundlePath(runtimeVersion: string): Promise<string> {
    const s3params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Delimiter: '/',
      Prefix: `${runtimeVersion}/`,
    };
    return await new Promise((resolve, reject) => {
      this.s3.listObjectsV2(s3params, (err, data) => {
        if (err) {
          reject(err as Error);
          return;
        }
        if (!data.CommonPrefixes) {
          resolve(`${runtimeVersion}/${1}`);
          return;
        }
        const currentOTAUpdateBundlePath =
          data.CommonPrefixes[data.CommonPrefixes.length - 1].Prefix;
        const parts = currentOTAUpdateBundlePath.split('/');
        const otaUpdateVersion = `${parseInt(parts[parts.length - 2] as string, 10) + 1}`;
        resolve(`${runtimeVersion}/${otaUpdateVersion}`);
      });
    });
  }

  async getObject(key: string) {
    let createdAt: Date | null = null;
    let object: Record<string, any> | null = null;
    const getObjectPromise = new Promise<void>((resolve, reject) => {
      this.s3.getObject(
        { Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key },
        (err, data: GetObjectCommandOutput) => {
          const transformToStringAndResolve = async () => {
            if (err) {
              reject(err as Error);
              return;
            }
            if (!data || !data.Body) {
              reject(new Error(`${key} not found`));
              return;
            }
            const transformedString = await data.Body.transformToString();
            const transformedObject = JSON.parse(transformedString);
            object = transformedObject;
            resolve();
          };
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          transformToStringAndResolve();
        },
      );
    });
    const getObjectAttributesPromise = new Promise<void>((resolve, reject) => {
      this.s3.getObjectAttributes(
        {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
          ObjectAttributes: ['ObjectSize'],
        },
        (err, data: GetObjectAttributesCommandOutput) => {
          if (err) {
            reject(err as Error);
            return;
          }
          if (!data.LastModified) {
            reject(new Error(`${key} not found`));
            return;
          }
          createdAt = data.LastModified;
          resolve();
        },
      );
    });
    await Promise.all([getObjectPromise, getObjectAttributesPromise]);
    if (!object || !createdAt) {
      throw new Error(`${key} not found`);
    }
    return { object, createdAt };
  }
}
