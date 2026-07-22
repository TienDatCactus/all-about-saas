import { CanActivate, ExecutionContext, Logger } from '@nestjs/common';
export class OwnershipGuard implements CanActivate {
	logger = new Logger(OwnershipGuard.name);
	canActivate(context: ExecutionContext) {
		// NOTICE: ROUTE GUARD
		this.logger.log('===TRIGGER ROUTE GUARD===');
		// IMPLEMENT QUERY FLASH-CARD DATA AND CHECK OWNERSHIP
		return true;
	}
}
// Ví dụ như user khi muốn sửa/xóa một flash-card thì cần phải là người tạo ra nó mới quyền sửa/xóa.
