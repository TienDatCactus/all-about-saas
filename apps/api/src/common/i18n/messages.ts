/**
 * English exception message -> Vietnamese translation. Keyed by the literal
 * text passed to `throw new XException('...')` across the app, so no call
 * site needs to change — the filter looks up the thrown message here and
 * swaps it in when the request's locale is Vietnamese.
 */
export const VI_MESSAGES: Record<string, string> = {
	'Invalid credentials': 'Thông tin đăng nhập không đúng',
	'Invalid refresh token': 'Token làm mới không hợp lệ',
	'Session expired': 'Phiên đăng nhập đã hết hạn',
	'Current password is incorrect': 'Mật khẩu hiện tại không đúng',
	'Invalid OAuth state': 'Trạng thái OAuth không hợp lệ',
	'Not authenticated': 'Chưa đăng nhập',
	'User not authenticated': 'Người dùng chưa đăng nhập',
	'Refresh token not found': 'Không tìm thấy token làm mới',
	'Session not found': 'Không tìm thấy buổi học',
	'Participant not found': 'Không tìm thấy người tham gia',
	'Payment method not found': 'Không tìm thấy phương thức thanh toán',
	'Slot not found': 'Không tìm thấy khung giờ',
	'User not found': 'Không tìm thấy người dùng',
	'Invalid App Version': 'Phiên bản ứng dụng không hợp lệ',
	'Invalid verification type.': 'Loại xác minh không hợp lệ.',
	'file is required for type=image': 'Cần tải lên ảnh cho loại type=image',
	'phoneNumber is required for type=phone':
		'Cần nhập số điện thoại cho loại type=phone',
	'Selector and token are required.': 'Cần có selector và token.',
	'Invalid email or password': 'Email hoặc mật khẩu không đúng',
	'Invalid or expired verification token':
		'Token xác minh không hợp lệ hoặc đã hết hạn',
	'User is not active': 'Tài khoản chưa được kích hoạt',
	'Verification token not found': 'Không tìm thấy token xác minh',
	'Failed to create user from OAuth data':
		'Không thể tạo người dùng từ dữ liệu OAuth',
	'Google login is not configured in this environment':
		'Đăng nhập Google chưa được cấu hình trên môi trường này',
	'Facebook login is not configured in this environment':
		'Đăng nhập Facebook chưa được cấu hình trên môi trường này',
	'GitHub login is not configured in this environment':
		'Đăng nhập GitHub chưa được cấu hình trên môi trường này',
};
