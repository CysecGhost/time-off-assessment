import { IsString, IsDateString } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
