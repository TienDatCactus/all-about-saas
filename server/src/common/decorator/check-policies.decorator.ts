import { SetMetadata } from "@nestjs/common";

export interface PolicyHandler {
    action: string;
    resource: string;
}

export const CHECK_POLICIES_KEY = 'meta:check_policies';
export const CheckPolicies = (...handlers: PolicyHandler[]) => SetMetadata(CHECK_POLICIES_KEY, handlers);