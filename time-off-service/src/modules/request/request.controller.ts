import { Controller, Post, Get, Patch, Param, Body } from '@nestjs/common';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';

@Controller('requests')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  async createRequest(@Body() dto: CreateRequestDto) {
    return this.requestService.createRequest(dto);
  }

  @Get(':employeeId')
  async getRequests(@Param('employeeId') employeeId: string) {
    return this.requestService.getRequests(employeeId);
  }

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateRequestDto) {
    return this.requestService.updateStatus(id, dto.status);
  }
}
