import { Injectable, Logger } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';
import { SyncBalanceDto } from './dto/sync-balance.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private balanceService: BalanceService) {}

  async processBatchSync(records: SyncBalanceDto[]) {
    for (const record of records) {
      await this.balanceService.upsertBalance(
        record.employeeId,
        record.locationId,
        record.balance,
        true,
      );
      this.logger.log(
        `Synced balance for ${record.employeeId}@${record.locationId}: ${record.balance}`,
      );
    }
    return { synced: records.length };
  }
}
