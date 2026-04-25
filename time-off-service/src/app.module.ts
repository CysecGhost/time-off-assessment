import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceModule } from './modules/balance/balance.module';
import { RequestModule } from './modules/request/request.module';
import { HcmModule } from './modules/hcm/hcm.module';
import { SyncModule } from './modules/sync/sync.module';
import { Balance } from './modules/balance/balance.entity';
import { LeaveRequest } from './modules/request/request.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'timeoff.sqlite',
      entities: [Balance, LeaveRequest],
      synchronize: true,
    }),
    BalanceModule,
    RequestModule,
    HcmModule,
    SyncModule,
  ],
})
export class AppModule {}
