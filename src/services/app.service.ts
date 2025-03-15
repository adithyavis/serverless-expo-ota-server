import { Injectable, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as FormData from 'form-data';
import {
  createNoUpdateAvailableDirectiveAsync,
  getPartitionKey,
  NoUpdateAvailableError,
  UpdateNotFoundError,
} from '../utils';
import { S3Service } from './s3.services';
import { DynamoDBService } from './dynamoDB.service';

@Injectable()
export class AppService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly dynamoDBService: DynamoDBService,
  ) {}

  async getManifest(@Req() req: Request, @Res() res: Response) {
    const protocolVersionMaybeArray = req.headers['expo-protocol-version'];
    if (protocolVersionMaybeArray && Array.isArray(protocolVersionMaybeArray)) {
      res.statusCode = 400;
      res.json({
        error: 'Unsupported protocol version. Expected either 0 or 1.',
      });
      return;
    }
    const protocolVersion = parseInt(
      (protocolVersionMaybeArray as string) ?? '0',
      10,
    );
    const platform = req.headers['expo-platform'] ?? req.query['platform'];
    if (platform !== 'ios' && platform !== 'android') {
      res.statusCode = 400;
      res.json({
        error: 'Unsupported platform. Expected either ios or android.',
      });
      return;
    }
    const runtimeVersion =
      req.headers['expo-runtime-version'] ?? req.query['runtime-version'];
    if (!runtimeVersion || typeof runtimeVersion !== 'string') {
      res.statusCode = 400;
      res.json({
        error: 'No runtimeVersion provided.',
      });
      return;
    }
    try {
      try {
        await this.putUpdateInResponseAsync(
          req,
          res,
          runtimeVersion,
          platform,
          protocolVersion,
        );
      } catch (maybeNoUpdateAvailableError) {
        if (
          maybeNoUpdateAvailableError instanceof NoUpdateAvailableError ||
          maybeNoUpdateAvailableError instanceof UpdateNotFoundError
        ) {
          this.putNoUpdateAvailableInResponseAsync(req, res, protocolVersion);
          return;
        }
        throw maybeNoUpdateAvailableError;
      }
    } catch (error: unknown) {
      res.statusCode = 404;
      res.json({ error });
    }
  }
  async getUploadPath(@Req() req: Request, @Res() res: Response) {
    const runtimeVersion =
      req.headers['expo-runtime-version'] ?? req.query['runtime-version'];
    if (!runtimeVersion || typeof runtimeVersion !== 'string') {
      res.statusCode = 400;
      res.json({
        error: 'No runtimeVersion provided.',
      });
      return;
    }

    const iosOtaUpdates = await this.dynamoDBService.findLatest({
      partitionKey: { eq: getPartitionKey('ios', runtimeVersion) },
    });

    let path;
    if (!iosOtaUpdates[0]) {
      path = `${runtimeVersion}/1`;
    } else {
      path = `${runtimeVersion}/${iosOtaUpdates[0].sortKey + 1}`;
    }

    res.statusCode = 200;
    res.json({
      path,
    });
  }

  async syncWithDB(@Req() req: Request, @Res() res: Response) {
    const runtimeVersion =
      req.headers['expo-runtime-version'] ?? req.query['runtime-version'];
    if (!runtimeVersion || typeof runtimeVersion !== 'string') {
      res.statusCode = 400;
      res.json({
        error: 'No runtimeVersion provided.',
      });
      return;
    }

    const otaUpdateVersion =
      req.headers['expo-ota-update-version'] ?? req.query['ota-update-version'];
    if (!otaUpdateVersion || typeof otaUpdateVersion !== 'string') {
      res.statusCode = 400;
      res.json({
        error: 'No otaUpdateVersion provided.',
      });
      return;
    }

    const updateBundlePath = `${runtimeVersion}/${otaUpdateVersion}`;

    const { object: iosManifest } = await this.s3Service.getObject(
      `${updateBundlePath}/manifests/ios.json`,
    );
    const { object: androidManifest } = await this.s3Service.getObject(
      `${updateBundlePath}/manifests/android.json`,
    );

    try {
      await this.dynamoDBService.create({
        partitionKey: getPartitionKey('ios', runtimeVersion),
        sortKey: parseInt(otaUpdateVersion, 10),
        id: iosManifest.id,
        platform: 'ios',
        manifest: JSON.stringify(iosManifest),
        otaUpdateVersion,
        runtimeVersion,
      });
      await this.dynamoDBService.create({
        partitionKey: `android-${runtimeVersion}`,
        sortKey: parseInt(otaUpdateVersion, 10),
        id: androidManifest.id,
        platform: 'android',
        manifest: JSON.stringify(androidManifest),
        otaUpdateVersion,
        runtimeVersion,
      });
    } catch (error: unknown) {
      res.statusCode = 404;
      res.json({
        error,
      });
      return;
    }
    res.statusCode = 200;
    res.json();
  }

  async putUpdateInResponseAsync(
    req: Request,
    res: Response,
    runtimeVersion: string,
    platform: string,
    protocolVersion: number,
  ) {
    const currentUpdateId = req.headers['expo-current-update-id'];
    const otaUpdates = await this.dynamoDBService.findLatest({
      partitionKey: { eq: getPartitionKey(platform, runtimeVersion) },
    });

    if (!otaUpdates[0]) {
      throw new UpdateNotFoundError();
    }

    const manifest = JSON.parse(otaUpdates[0].manifest);

    // NoUpdateAvailable directive only supported on protocol version 1
    // for protocol version 0, serve most recent update as normal
    if (currentUpdateId === manifest.id && protocolVersion === 1) {
      throw new NoUpdateAvailableError();
    }

    const assetRequestHeaders: { [key: string]: object } = {};
    [...manifest.assets, manifest.launchAsset].forEach((asset) => {
      assetRequestHeaders[asset.key] = {
        'test-header': 'test-header-value',
      };
    });

    const form = new FormData();
    form.append('manifest', JSON.stringify(manifest), {
      contentType: 'application/json',
      header: {
        'content-type': 'application/json; charset=utf-8',
      },
    });
    form.append('extensions', JSON.stringify({ assetRequestHeaders }), {
      contentType: 'application/json',
    });

    res.statusCode = 200;
    res.setHeader('expo-protocol-version', protocolVersion);
    res.setHeader('expo-sfv-version', 0);
    res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader(
      'content-type',
      `multipart/mixed; boundary=${form.getBoundary()}`,
    );
    res.write(form.getBuffer());
    res.end();
  }

  putNoUpdateAvailableInResponseAsync(
    req: Request,
    res: Response,
    protocolVersion: number,
  ): void {
    if (protocolVersion === 0) {
      throw new Error(
        'NoUpdateAvailable directive not available in protocol version 0',
      );
    }

    const directive = createNoUpdateAvailableDirectiveAsync();

    const form = new FormData();
    form.append('directive', JSON.stringify(directive), {
      contentType: 'application/json',
      header: {
        'content-type': 'application/json; charset=utf-8',
      },
    });

    res.statusCode = 200;
    res.setHeader('expo-protocol-version', 1);
    res.setHeader('expo-sfv-version', 0);
    res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader(
      'content-type',
      `multipart/mixed; boundary=${form.getBoundary()}`,
    );
    res.write(form.getBuffer());
    res.end();
  }
}
