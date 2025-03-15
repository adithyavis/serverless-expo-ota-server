import { Injectable } from '@nestjs/common';
import {
  OTAUpdate,
  OTAUpdateItem,
  OTAUpdateSchema,
} from 'src/schema/otaUpdate.schema';
import * as dynamoose from 'dynamoose';
import { ModelType } from 'dynamoose/dist/General';

@Injectable()
export class DynamoDBService {
  private dbInstance: ModelType<OTAUpdateItem>;

  constructor() {
    this.dbInstance = dynamoose.model<OTAUpdateItem>(
      process.env.AWS_DYNAMODB_TABLE_NAME,
      OTAUpdateSchema,
    );
  }

  async create(otaUpdate: OTAUpdate) {
    return await this.dbInstance.create({
      ...otaUpdate,
    });
  }

  async findOne(partitionKey: string, sortKey: number) {
    return await this.dbInstance.get({ partitionKey, sortKey });
  }

  async findLatest(
    condition: { [k: string]: { eq: string } },
    sort: 'ascending' | 'descending' = 'descending',
    limit = 1,
  ) {
    return await this.dbInstance
      .query(condition)
      .sort(sort)
      .limit(limit)
      .exec();
  }

  async update(
    partitionKey: string,
    sortKey: number,
    otaUpdate: Partial<OTAUpdate>,
  ) {
    return await this.dbInstance.update({
      ...otaUpdate,
      partitionKey,
      sortKey,
    });
  }

  async remove(partitionKey: string, sortKey: number) {
    return await this.dbInstance.delete({
      partitionKey,
      sortKey,
    });
  }
}
