import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './services/app.service';
import { Request, Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(['/', '/health', 'health-check'])
  healthCheck(@Req() req: Request, @Res() res: Response) {
    res.statusCode = 200;
    res.end();
  }

  @Get('/api/manifest')
  getManifest(@Req() req: Request, @Res() res: Response) {
    return this.appService.getManifest(req, res);
  }

  @Get('/get-upload-path')
  getUploadPath(@Req() req: Request, @Res() res: Response) {
    return this.appService.getUploadPath(req, res);
  }

  @Get('/sync-with-db')
  syncWithDB(@Req() req: Request, @Res() res: Response) {
    return this.appService.syncWithDB(req, res);
  }
}
