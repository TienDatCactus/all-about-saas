import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Users } from '../users/entities/users.entity';
import { PolicyParser } from './policy-parser';

export type AppAbility = MongoAbility;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: Users, dbPerms: any[]): AppAbility {
    const { can, cannot, build } = new AbilityBuilder(createMongoAbility);
    dbPerms.forEach((perm) => {
      // Process each permission
      const parsedCon = PolicyParser.parseConditions(perm.conditions, user);

      if (perm.inverted) {
        cannot(perm.action, perm.resource, parsedCon);
      } else {
        can(perm.action, perm.resource, parsedCon);
      }
    });
    return build();
  }
}
