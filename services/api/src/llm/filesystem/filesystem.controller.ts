import { Body, Controller, Post } from '@nestjs/common';
import { FilesystemService } from './filesystem.service';

@Controller('api/files')
export class FilesystemController {
  constructor(private readonly filesystemService: FilesystemService) {}

  @Post('file-chat')
  fileChat(@Body() body: { input: string }) {
    return this.filesystemService.fileChat(body.input);
  }
}
