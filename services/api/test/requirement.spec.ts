jest.mock(
  '@repo/contracts',
  () => ({
    APP_NAME: 'llm',
  }),
  { virtual: true },
);

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { RequirementService } from '../src/llm/requirement.service';

describe('Requirement Extract', () => {
  let controller: AppController;
  const result = {
    action: '绑定手机号',
    constraints: ['必须绑定手机号', '密码至少8位'],
    entities: ['用户', '手机号', '密码'],
  };
  const requirementService = {
    extract: jest.fn(),
  };

  beforeEach(async () => {
    requirementService.extract.mockResolvedValue(result);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: RequirementService,
          useValue: requirementService,
        },
      ],
    }).compile();

    controller = module.get(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate input to RequirementService', async () => {
    const input = '用户注册时必须绑定手机号，密码至少8位';

    await expect(controller.extract({ input })).resolves.toEqual(result);
    expect(requirementService.extract).toHaveBeenCalledWith(input);
  });
});
