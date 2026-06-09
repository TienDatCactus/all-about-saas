import { Users } from '../users/entities/users.entity';

const policyRegex = /\${user\.(\w+)}/g;
export class PolicyParser {
  static parseConditions(
    conditions: Record<string, any>,
    user: Users,
  ): Record<string, any> {
    if (!conditions) return {};
    const jsonString = JSON.stringify(conditions);

    const parsedJson = jsonString.replace(policyRegex, (_, key) => {
      return user[key] !== undefined ? String(user[key]) : '';
    });
    return JSON.parse(parsedJson);
  }
}
