import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @IsOptional()
  selector?: string;

  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
