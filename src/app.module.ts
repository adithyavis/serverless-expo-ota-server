import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './services/app.service';
import { S3Module } from 'nestjs-s3';
import { S3Service } from './services/s3.services';
import { DynamoDBService } from './services/dynamoDB.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    S3Module.forRoot({
      config: {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        region: process.env.AWS_REGION,
        forcePathStyle: true,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService, S3Service, DynamoDBService],
})
export class AppModule {}
