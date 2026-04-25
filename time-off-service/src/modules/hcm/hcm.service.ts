import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class HcmService {
  private readonly logger = new Logger(HcmService.name);
  private readonly hcmUrl = 'http://localhost:3001';

  async validateBalance(
    employeeId: string,
    locationId: string,
    daysRequested: number,
  ): Promise<boolean | null> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(`${this.hcmUrl}/validate`, {
          employeeId,
          locationId,
          daysRequested,
        });
        return response.data.approved;
      } catch (error) {
        this.logger.warn(`HCM validate attempt ${attempt} failed`);
        if (attempt === maxRetries) return null;
        await new Promise((res) => setTimeout(res, attempt * 1000));
      }
    }
    return null;
  }

  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<number | null> {
    try {
      const response = await axios.get(
        `${this.hcmUrl}/balance/${employeeId}/${locationId}`,
      );
      return response.data.balance;
    } catch {
      this.logger.warn(`HCM getBalance failed for ${employeeId}`);
      return null;
    }
  }
}
