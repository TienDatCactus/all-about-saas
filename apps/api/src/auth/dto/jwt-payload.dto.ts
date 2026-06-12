import { IsString } from 'class-validator';

export class PayloadDto {
  @IsString()
  sub: string;
  @IsString()
  email: string;
}
