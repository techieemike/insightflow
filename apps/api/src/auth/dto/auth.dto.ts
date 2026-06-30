import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail() email: string;

  @IsString()
  @MinLength(6)
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'Password must be alphanumeric' })
  password: string;

  @IsString() name: string;
}

export class LoginDto {
  @IsEmail() email: string;

  @IsString() password: string;
}
