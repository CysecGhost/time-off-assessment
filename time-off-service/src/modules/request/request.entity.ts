import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @Column()
  requestedDays: number;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ default: false })
  validatedLocally: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
