// common/decorators/resource.decorator.ts
import { SetMetadata } from '@nestjs/common';

export interface ResourceOptions {
  name: string;
  actions: string[];
}

export const RESOURCE_METADATA_KEY = 'custom:resource';
export const RegisterResource = (options: ResourceOptions) =>
  SetMetadata(RESOURCE_METADATA_KEY, options);
