import { IsString, IsNumber } from 'class-validator';

export class SyncBalanceDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  balance: number;
}
