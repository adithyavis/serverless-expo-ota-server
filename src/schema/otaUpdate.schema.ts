import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';

export type OTAUpdate = {
  partitionKey: string;
  sortKey: number;
  id: string;
  platform: string;
  manifest: string;
  runtimeVersion: string;
  otaUpdateVersion: string;
  mandatory?: boolean;
  activeDevices?: number;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OTAUpdateItem = Item & OTAUpdate;

export const OTAUpdateSchema = new dynamoose.Schema(
  {
    partitionKey: {
      type: String,
      required: true,
      hashKey: true,
    },
    sortKey: {
      type: Number,
      required: true,
      rangeKey: true,
    },
    id: {
      type: String,
      required: true,
    },
    otaUpdateVersion: {
      type: String,
      required: true,
    },
    runtimeVersion: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      required: true,
    },
    manifest: {
      type: String,
      required: true,
    },
    mandatory: {
      type: Boolean,
      required: false,
      default: false,
    },
    activeDevices: {
      type: Number,
      required: false,
      default: 0,
    },
    enabled: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);
