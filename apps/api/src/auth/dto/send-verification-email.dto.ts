import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { VerificationType } from "../entities/verification-token.entity";

export class SendVerificationEmailDto {
  @IsString()
  @IsOptional()
  selector?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsNotEmpty()
  type: VerificationType;
}
