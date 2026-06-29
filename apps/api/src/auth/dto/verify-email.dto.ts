import { IsString, IsNotEmpty } from "class-validator";
import { SendVerificationEmailDto } from "./send-verification-email.dto";

export class VerifyEmailDto extends SendVerificationEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
