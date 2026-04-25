import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [BalanceModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
