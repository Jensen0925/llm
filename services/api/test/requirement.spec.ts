import { RequirementService } from '../src/llm/requirement.service';

describe('Requirement Extract', () => {
  const service = new RequirementService();

  it('should extract correctly', async () => {
    const result = await service.extract(
      '用户注册时必须绑定手机号，密码至少8位',
    );

    expect(result.action).toBe('用户注册');
    expect(result.constraints).toContain('必须绑定手机号');
    expect(result.entities).toContain('手机号');
  });
});
