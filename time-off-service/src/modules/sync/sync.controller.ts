import { Controller, Post, Body } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncBalanceDto } from './dto/sync-balance.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  async batchSync(@Body() payload: SyncBalanceDto[]) {
    return this.syncService.processBatchSync(payload);
  }
}
