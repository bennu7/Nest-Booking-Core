import { PartialType } from '@nestjs/mapped-types';
import { CreateCancellationPolicyDto } from './create-cancellation-policy.dto';

export class UpdateCancellationPolicyDto extends PartialType(
  CreateCancellationPolicyDto,
) {}
