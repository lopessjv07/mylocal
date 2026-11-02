import { Module } from '@nestjs/common';
import { DriveService } from './drive.service';
import { DriveController } from './drive.controller';

@Module({
  providers: [DriveService],
  controllers: [DriveController],
})
export class DriveModule {}

