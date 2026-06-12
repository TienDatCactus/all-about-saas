import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { PolicyParser } from './policy-parser';

export type AppAbility = MongoAbility;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User, dbPerms: any[]): AppAbility {
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
