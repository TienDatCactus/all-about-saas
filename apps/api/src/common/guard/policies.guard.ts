import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaslAbilityFactory } from '../../casl/ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
} from '../decorator/check-policies.decorator';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];
    if (!policyHandlers || policyHandlers.length === 0) return true; // No policies means allow access

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Assuming user is attached to request
    if (!user) return false;

    const dbPerms = await this.getUserPermissions(user.id);
    const ability = this.caslAbilityFactory.createForUser(user, dbPerms);
    return policyHandlers.every((handler) =>
      ability.can(handler.action, handler.resource),
    );
  }
  async getUserPermissions(userId: string): Promise<any[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions'],
    });
    return user?.role?.permissions || [];
  }
}
