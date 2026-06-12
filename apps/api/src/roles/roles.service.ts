import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../casl/entities/permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll() {
    return await this.roleRepository.find({
      relations: ['permissions'],
    });
  }

  async findOne(id: number) {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async updatePermissions(
    roleId: number,
    permissionsData: Partial<Permission>[],
  ) {
    const role = await this.findOne(roleId);

    await this.dataSource.transaction(async (manager) => {
      // 1. Delete all existing permissions for this role
      await manager.delete(Permission, { role: { id: roleId } });
      const permission = new Permission();
      const newPermissions = permissionsData.map((permData) => {
        if (permData.action) permission.action = permData.action;
        if (permData.subject) permission.subject = permData.subject;
        if (permData.conditions)
          permission.conditions = permData.conditions ?? null;
        permission.inverted = permData.inverted ?? false;
        permission.role = role;
        return permission;
      });

      if (newPermissions.length > 0) {
        await manager.save(Permission, newPermissions);
      }
    });

    return this.findOne(roleId);
  }
}
