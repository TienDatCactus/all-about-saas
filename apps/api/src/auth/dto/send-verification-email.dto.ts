import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { VerificationType } from '../entities/verification-token.entity';

export class SendVerificationEmailDto {
  @IsString()
  @IsOptional()
  selector?: string;

  @IsNotEmpty()
  type: VerificationType;
}
