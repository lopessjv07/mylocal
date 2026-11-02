import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(@Req() req: any) {
    return this.usersService.listUsers(req.user.role);
  }

  @Post()
  async createUser(
    @Req() req: any,
    @Body() body: { name: string; email: string; password: string; role?: 'ADMIN' | 'USER' },
  ) {
    return this.usersService.createUser(req.user.role, body);
  }

  @Delete(':id')
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.usersService.deleteUser(req.user.id, req.user.role, id);
  }
}

