import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequest } from './request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { BalanceService } from '../balance/balance.service';
import { HcmService } from '../hcm/hcm.service';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(LeaveRequest)
    private requestRepository: Repository<LeaveRequest>,
    private balanceService: BalanceService,
    private hcmService: HcmService,
  ) {}

  async createRequest(dto: CreateRequestDto) {
    // Step 1: Validate dates
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today)
      throw new BadRequestException('Start date cannot be in the past');
    if (end <= start)
      throw new BadRequestException('End date must be after start date');

    // Step 2: Calculate days
    const requestedDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Step 3: Check for overlapping requests
    const existing = await this.requestRepository
      .createQueryBuilder('r')
      .where('r.employeeId = :employeeId', { employeeId: dto.employeeId })
      .andWhere('r.locationId = :locationId', { locationId: dto.locationId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: ['PENDING', 'APPROVED'],
      })
      .andWhere('r.startDate <= :endDate AND r.endDate >= :startDate', {
        startDate: dto.startDate,
        endDate: dto.endDate,
      })
      .getOne();

    if (existing)
      throw new BadRequestException('Overlapping request already exists');

    // Step 4: Validate with HCM
    let validatedLocally = false;
    const hcmResult = await this.hcmService.validateBalance(
      dto.employeeId,
      dto.locationId,
      requestedDays,
    );

    if (hcmResult === null) {
      // HCM is down — degraded mode
      const localBalance = await this.balanceService.getBalance(
        dto.employeeId,
        dto.locationId,
      );
      if (!localBalance || localBalance.balance < requestedDays) {
        throw new BadRequestException(
          'Insufficient balance (validated locally, HCM unavailable)',
        );
      }
      validatedLocally = true;
    } else if (hcmResult === false) {
      throw new BadRequestException('Insufficient balance per HCM');
    }

    // Step 5: Save request
    const request = this.requestRepository.create({
      ...dto,
      requestedDays,
      status: 'PENDING',
      validatedLocally,
    });
    const saved = await this.requestRepository.save(request);

    // Step 6: Deduct local balance
    await this.balanceService.deductBalance(
      dto.employeeId,
      dto.locationId,
      requestedDays,
    );

    return saved;
  }

  async getRequests(employeeId: string) {
    return this.requestRepository.find({ where: { employeeId } });
  }

  async updateStatus(id: string, status: string) {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) throw new BadRequestException('Request not found');
    request.status = status;
    return this.requestRepository.save(request);
  }
}
