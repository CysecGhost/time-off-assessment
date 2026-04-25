import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './balance.entity';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
  ) {}

  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<Balance | null> {
    return this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });
  }

  async upsertBalance(
    employeeId: string,
    locationId: string,
    newBalance: number,
    log = false,
  ): Promise<void> {
    const existing = await this.getBalance(employeeId, locationId);
    if (existing) {
      if (log) {
        console.log(
          `[AUDIT] Balance changed for ${employeeId}@${locationId}: ${existing.balance} → ${newBalance}`,
        );
      }
      existing.balance = newBalance;
      await this.balanceRepository.save(existing);
    } else {
      const record = this.balanceRepository.create({
        employeeId,
        locationId,
        balance: newBalance,
      });
      await this.balanceRepository.save(record);
    }
  }

  async deductBalance(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<void> {
    const existing = await this.getBalance(employeeId, locationId);
    if (existing) {
      existing.balance -= days;
      await this.balanceRepository.save(existing);
    }
  }
}
