import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  RESOURCE_METADATA_KEY,
  ResourceOptions,
} from '../../common/decorator/resource.decorator';

@Injectable()
export class ResourceDiscoveryService implements OnApplicationBootstrap {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  async onApplicationBootstrap() {
    const controllers = this.discoveryService.getControllers();
    const resources: ResourceOptions[] = [];

    controllers.forEach((wrapper) => {
      if (!wrapper.instance || !wrapper.metatype) return;

      const meta = this.reflector.get<ResourceOptions>(
        RESOURCE_METADATA_KEY,
        wrapper.metatype,
      );

      if (meta) {
        resources.push(meta);
      }
    });
    await this.syncResources(resources);
  }

  private async syncResources(resources: ResourceOptions[]) {}
}
