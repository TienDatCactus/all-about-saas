import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  selector: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}
