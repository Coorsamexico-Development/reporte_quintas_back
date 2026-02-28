import { Test, TestingModule } from '@nestjs/testing';
import { CedisService } from './cedis.service';

describe('CedisService', () => {
  let service: CedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CedisService],
    }).compile();

    service = module.get<CedisService>(CedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
