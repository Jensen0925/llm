jest.mock(
  '@repo/contracts',
  () => ({
    APP_NAME: 'llm',
  }),
  { virtual: true },
);

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequirementService } from './llm/requirement.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: RequirementService,
          useValue: {
            extract: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return ok', () => {
      expect(appController.health()).toEqual({ ok: true });
    });
  });

  describe('hello', () => {
    it('should return shared app name', () => {
      expect(appController.hello()).toEqual({
        message: 'Hello from API, shared APP_NAME=llm',
      });
    });
  });
});
