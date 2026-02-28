import { Test, TestingModule } from '@nestjs/testing';
import { CedisController } from './cedis.controller';

describe('CedisController', () => {
  let controller: CedisController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CedisController],
    }).compile();

    controller = module.get<CedisController>(CedisController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
