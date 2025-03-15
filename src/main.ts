import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import * as dynamoose from 'dynamoose';

async function bootstrap() {
  const ddb = new dynamoose.aws.ddb.DynamoDB({
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    region: process.env.AWS_REGION,
  });
  dynamoose.aws.ddb.set(ddb);

  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
