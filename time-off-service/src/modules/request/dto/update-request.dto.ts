import { IsIn } from 'class-validator';

export class UpdateRequestDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status: string;
}
