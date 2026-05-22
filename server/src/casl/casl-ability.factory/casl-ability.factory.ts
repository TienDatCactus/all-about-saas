import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';

class User {
  id: number = 0;
  isAdmin: boolean = false;
}

class Article {
  id: number = 0;
  isPublished: boolean = false;
  authorId: number = 0;
}
type Subjects = InferSubjects<typeof Article | typeof User> | 'all';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User) {
    const { can, cannot, build } = new AbilityBuilder(createMongoAbility);
    if (user.isAdmin) {
      can(Action.Manage, 'all');
    } else {
      can(Action.Read, 'all');
    }
    can(Action.Update, Article, { authorId: user.id });
    cannot(Action.Delete, Article, { isPublished: true });
    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
