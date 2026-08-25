# Bộ đề tra khảo: Backend + DevOps (có đáp án)

> Mục tiêu: chuyển bạn từ **"đọc hiểu code"** sang **"sở hữu codebase"**.
> Repo này do AI dựng, và AI để lại đáp án ngay trong các comment `// tại sao...`.
> Nên đây là một **self-test có sẵn đáp án**: che đáp án → tự trả lời thành câu hoàn chỉnh → mở `file:line` đối chiếu → tự chấm.

---

## Cách dùng (đọc trước khi làm)

1. **Mỗi buổi một mảng thôi.** 5 mảng = 5 buổi. Đừng làm hết một lúc, sẽ chỉ là đọc lướt.
2. **Trả lời ra tiếng / viết ra giấy thành câu hoàn chỉnh TRƯỚC**, rồi mới mở phần "Đối chiếu".
3. Phần **Đối chiếu** trỏ tới đúng dòng comment/code là "đáp án". Phần **Đáp án tóm tắt** để tự chấm — che nó lại khi làm.
4. Chấm theo rubric ở cuối. Mảng nào tụt điểm nhiều (0–1đ) → gửi lại câu trả lời của bạn cho mảng đó để được chấm gắt.

### Template 5 bước (lặp lại cho mọi subsystem)

1. Hỏi **"tại sao cái này chứ không phải cái kia"**, không hỏi định nghĩa.
2. Tự trả lời **từ nguyên lý** trước, che comment đi.
3. Tìm **bằng chứng trong code của chính bạn** (chỉ ra đúng dòng).
4. Mở comment **đối chiếu** — repo bạn là bộ đề có đáp án.
5. Săn **code chết / mâu thuẫn / cái bạn sẽ đổi** — bước lộ ra bạn có thật sự sở hữu không.

### Worked example đã làm mẫu (mảng C)

Đã tra khảo bộ ba **middleware / guard / interceptor** theo đúng 5 bước:
*auth PHẢI là Guard vì cần đọc `@Public()` metadata (`JwtAuthGuard` + `Reflector`) mà middleware mù thông tin đó; bọc response PHẢI là Interceptor vì chỉ vị trí "bọc quanh" mới đổi được return value (`TransformInterceptor` đọc `response.statusCode` sau handler); đo thời gian PHẢI là Interceptor vì cần cả mốc trước lẫn sau (`LoggingInterceptor` — `Date.now() - startedAt`).*
Mảng C dưới đây là phần bạn tự lặp lại phương pháp đó, gồm cả 3 câu điểm căng.

---

## Mảng A — Bootstrap (`apps/api/src/main.ts`)

**A1.** Nest tự đăng ký body parser trong `create()`. Vậy tại sao ở đây phải `bodyParser: false` rồi mới `app.use(json({ limit }))`? Nếu bỏ `bodyParser: false` thì `limit` có tác dụng không?
- Đối chiếu: `main.ts:28-37`
- Đáp án: express bỏ qua request đã được parse, nên `app.use()` thêm sau sẽ không bao giờ thấy body → limit thành đồ trang trí. Từ chối parser built-in là cách duy nhất để tự sở hữu limit. `BODY_LIMIT = '100kb'` (`:20`).

**A2.** `enableCors` dùng `origin: frontendUrl ? ... : false`. Tại sao KHÔNG dùng `origin: true` làm fallback? `FRONTEND_URL` để trống thì chuyện gì xảy ra với traffic cross-origin?
- Đối chiếu: `main.ts:38-46`
- Đáp án: `origin: true` phản chiếu origin của caller trong khi `credentials: true` → mọi site đọc được response đã xác thực. `FRONTEND_URL` trống ⇒ chặn toàn bộ cross-origin. Prod bắt buộc có var này (env validation là hard error).

**A3.** `app.set('trust proxy', 1)` — con số `1` nghĩa là gì, và **ba thứ nào** âm thầm hỏng nếu thiếu dòng này khi proxy nằm trong container riêng?
- Đối chiếu: `main.ts:75-87`
- Đáp án: `1` = tin đúng 1 hop proxy (entry X-Forwarded-For rightmost do proxy tự thêm), client không spoof được IP. Thiếu → `req.ip` thành IP proxy → (1) throttler dồn cả internet vào 1 bucket (limit 5/min login áp cho tất cả), (2) `Session.ipAddress` ghi IP proxy mọi login, (3) `req.protocol` đọc `http` dù đứng sau TLS. Đây là lý do `deploy/nginx/aas-proxy.conf` set `X-Forwarded-*`.

**A4.** Thứ tự đăng ký ở đây có ý nghĩa không? Tại sao `TransformInterceptor` đăng ký **trước** `ClassSerializerInterceptor` trong cùng `useGlobalInterceptors`?
- Đối chiếu: `main.ts:88-91`
- Đáp án: chỉ 2 interceptor được wire global (Transform + ClassSerializer). Thứ tự interceptor: request đi qua theo thứ tự khai báo, response đi ngược lại. (Ghi chú: `LoggingInterceptor` KHÔNG có mặt ở đây — xem câu 17.)

**A5.** `enableShutdownHooks()` giải quyết vấn đề gì cụ thể khi chạy trong Docker? `docker stop` gửi tín hiệu gì?
- Đối chiếu: `main.ts:94-96`
- Đáp án: `docker stop` gửi `SIGTERM`. Không có hook → Node thoát ngay, giết request đang chạy dở và bỏ pool DB không đóng.

**A6.** Swagger được gate bằng `NODE_ENV !== 'production'`. Lập luận bảo mật là gì? Và `logLevels` của logger (`:24-27`) đang **thiếu** level nào — hậu quả?
- Đối chiếu: `main.ts:98-109` và `:24-27`
- Đáp án: publish full schema (route/DTO/auth flow) cho anonymous = do thám miễn phí, nên tắt ở prod. `logLevels: ['error','debug','verbose','fatal']` — **thiếu `'warn'` và `'log'`**. Hậu quả nghiêm trọng: cảnh báo "refresh token reuse detected" (`auth.service.ts`) dùng `Logger.warn` → **không bao giờ in ra**. Phát hiện trộm token xong rồi im lặng. (Điểm căng thật, không chỉ lý thuyết.)

---

## Mảng B — Module wiring (`apps/api/src/app.module.ts`)

**B1.** `resolveFileSecrets()` là một **statement top-level** (`:38`), KHÔNG nằm trong `bootstrap()`. Tại sao vị trí này bắt buộc? Đặt ở đầu `bootstrap()` thì hỏng thế nào?
- Đối chiếu: `app.module.ts:26-38`
- Đáp án: `ConfigModule.forRoot()` chạy `validate` **đồng bộ** khi decorator argument được đánh giá — tức trong lúc *import* module này, mà `main.ts` import trước cả statement đầu tiên của nó. Đặt trong `bootstrap()` là quá muộn → app crash-loop "DATABASE_PASSWORD: expected string, received undefined" dù secret đã mount đúng. Là statement chứ không phải import side-effect vì thứ tự import bị formatter xáo, thứ tự statement thì không.

**B2.** `ConfigModule.forRoot` có `validate: validateEnv`. Triết lý ở đây là gì — vì sao chọn crash thay vì boot?
- Đối chiếu: `app.module.ts:50-52`
- Đáp án: crash khi config thiếu/không an toàn còn hơn boot rồi ký JWT bằng `undefined`.

**B3.** Global throttler là `100/min` per-IP. Tại sao **không** phải con số nhỏ hơn (nó từng là 10/min)? Và limit thật sự bảo vệ auth nằm ở đâu?
- Đối chiếu: `app.module.ts:56-74`
- Đáp án: global limit là **trần chống abuse**, không phải usage budget. 10/min là con số của login endpoint áp cho mọi route — thấp hơn cả một user thật (autocomplete participant bắn 1 request/prefix, gõ 4 tên là hết phút). Nó per-IP nên office/CGNAT share 1 bucket. Limit thật bảo vệ auth = `@Throttle` per-route (5/min login+signup, 3/min mail).

**B4.** Có **hai** `APP_GUARD`. Thứ tự chạy của chúng là gì, và tại sao "default-deny authentication" (JwtAuthGuard global) lại an toàn hơn gắn `@UseGuards` từng controller?
- Đối chiếu: `app.module.ts:82-93`
- Đáp án: Throttler guard + Jwt guard. Default-deny: trước đây mỗi controller phải nhớ `@UseGuards(JwtAuthGuard)`, quên là để lộ route — `POST /mail/try` chính là vụ đó. Giờ route opt-out bằng `@Public()`, JwtAuthGuard check `@Public` trước khi authenticate.

**B5.** `configure()` chỉ apply `LoggerMiddleware` cho `POST/PATCH/DELETE`. Comment nói gì về việc từng apply `helmet` ở đây — bài học về "áp 2 lần" và về việc GET response bị bỏ sót?
- Đối chiếu: `app.module.ts:97-115`
- Đáp án: helmet đã áp 1 lần global ở `main.ts`. Áp lại ở đây chỉ phủ POST/PATCH/DELETE → GET response (cái browser render) là thứ duy nhất thiếu pass thứ hai, còn write thì bị set header 2 lần. → gỡ khỏi middleware, để nguyên global.

---

## Mảng C — Vòng đời request: middleware / guard / interceptor + ĐIỂM CĂNG

**C1 (câu 12).** Vẽ lại thứ tự vòng đời một request trong Nest, từ đó suy ra **năng lực** của mỗi lớp (lớp nào đọc được metadata, lớp nào đổi được return value, lớp nào đo được thời gian).
- Đối chiếu: nguyên lý Nest + `jwt-auth.guard.ts`, `transform.interceptor.ts`, `logging.interceptor.ts`
- Đáp án: `middleware → guard → interceptor(pre) → pipe → handler → interceptor(post) → filter`. Middleware sớm nhất, chỉ thấy `req/res` thô, chưa biết trúng handler nào → không đọc metadata. Guard có `ExecutionContext` → đọc metadata qua `Reflector`, trả boolean. Interceptor bọc quanh handler → thấy trước+sau (RxJS) → đo thời gian, reshape return value.

**C2 (câu 13).** Tại sao auth PHẢI là Guard, không thể là Middleware? Chỉ ra đúng dòng code chứng minh.
- Đối chiếu: `jwt-auth.guard.ts` — `reflector.getAllAndOverride(IS_PUBLIC_KEY, ...)`
- Đáp án: guard cần biết route có gắn `@Public()` không, mà chỉ guard nhìn thấy metadata đó qua `Reflector`. Middleware mù thông tin này.

**C3 (câu 14).** `RolesGuard` phải chạy **một query DB mỗi request** để lấy role. Tại sao guard không tự có role sẵn — điều này lộ ra giới hạn gì của JWT payload?
- Đối chiếu: `common/guard/roles.guard.ts:23-41`; payload `jwt.strategy.ts`
- Đáp án: JWT payload chỉ mang `{sub, email}` — `validate()` không load gì từ DB. Nên guard muốn biết role phải tự query `user.role`. (Kéo theo: `RolesController` gắn `@Roles('admin')` là **bất khả đạt** vì không code nào gán role cho user — mọi user role null → luôn 403.)

**C4 (câu 15).** Nguyên lý sâu nhất của cả cụm: tại sao **ownership** (kiểm tra "row này có phải của tôi không") KHÔNG thuộc guard mà thuộc query trong service? Chỉ ra nơi ownership thật sự được enforce.
- Đối chiếu: comment trong `roles.guard.ts`; thực thi ở `badminton.service.ts:78` (`where: { id, ownerId }`), `:101` (pessimistic_write)
- Đáp án: guard chỉ thấy *hình dạng request*, chưa load row nào nên không trả lời được câu hỏi về dữ liệu. Ownership = `where: { id, ownerId }` trong service. **Nguyên lý: guard quyết trên hình dạng request, không quyết trên dữ liệu.**

### Ba câu điểm căng — đo "khứu giác hệ thống"

> Ba câu này quan trọng nhất. Tự soi ra được cả ba = bạn đang chuyển sang "sở hữu codebase".

**C5 (câu 16 — ĐIỂM CĂNG).** Mở `common/guard/ownership.guard.ts`. File này làm gì thật sự? Nó **mâu thuẫn** với nguyên lý nào của chính repo bạn (xem câu 15)? Người sở hữu codebase sẽ làm gì với nó?
- Đối chiếu: `ownership.guard.ts:4-9` (`return true`), TODO ở `:11`; đối lập với lập luận trong `roles.guard.ts`
- Đáp án: stub `return true` + comment "IMPLEMENT...". Nhưng chính `roles.guard.ts` đã lập luận ownership KHÔNG nên là guard. → đây là **scaffolding chết mâu thuẫn với nguyên lý của repo**. Người hiểu sẽ xoá. Người không hiểu để đó vì "AI tạo chắc có lý do". `grep -rn OwnershipGuard apps/api/src` → 0 chỗ dùng.

**C6 (câu 17 — ĐIỂM CĂNG).** `main.ts:88-91` `useGlobalInterceptors` đăng ký những interceptor nào? `LoggingInterceptor` (cái có timing) có được wire ở đâu không? Chạy `grep -rn LoggingInterceptor apps/api/src` và tự kết luận.
- Đối chiếu: `main.ts:88-91`; `common/interceptor/logging.interceptor.ts:12-13`; grep
- Đáp án: chỉ đăng ký `TransformInterceptor` + `ClassSerializerInterceptor`. `LoggingInterceptor` chỉ xuất hiện trong chính file định nghĩa nó — **chưa wire ở đâu, là code chết**. Hệ quả: interceptor log xịn (có timing `Date.now()-startedAt`) nằm không dùng; cái thật sự chạy là `LoggerMiddleware` — thô hơn, chỉ POST/PATCH/DELETE (`app.module.ts:102`). Hai cơ chế log **chồng vai**.

**C7 (câu 18 — ĐIỂM CĂNG).** `VersionMiddleware` viết xong nhưng ở trạng thái nào trong `app.module.ts`? Nếu bật lên nó sẽ làm gì với mọi request?
- Đối chiếu: `app.module.ts:116` (`// consumer.apply(VersionMiddleware)`); `common/middleware/version.middleware.ts:14`
- Đáp án: bị comment-out → **dead code**. Nếu bật: 400 mọi request thiếu header `x-app-version: 2.0.0` (hardcoded).

---

## Mảng D — Auth (flow + rủi ro)

**D1 (câu 19).** JWT secret lấy từ đâu, payload chứa gì, và `validate()` trong `JwtStrategy` load **gì** từ DB mỗi request? Hệ quả bảo mật của câu trả lời đó là gì?
- Đối chiếu: `auth/strategy/jwt.strategy.ts:8-19`
- Đáp án: secret từ `configuration().jwt.secret` (đọc `process.env.JWT_SECRET` trực tiếp, bỏ qua `ConfigService`). Payload chỉ `{sub, email}`. `validate()` **không load gì** → trả `{id, email}` từ payload. **Hệ quả: access token không thể thu hồi** — sau logout / đổi mật khẩu / revoke session / deactivate, token vẫn valid tới hết `JWT_EXPIRES_IN` (default 3600s). Đây là rủi ro, không phải feature.

**D2 (câu 20).** Sign-up băm mật khẩu bằng thuật toán gì, cost bao nhiêu, ở **đâu** (hook nào)? Token xác thực email được lưu ở dạng gì, hạn bao lâu?
- Đối chiếu: `user.entity.ts:27,70-85` (`@BeforeInsert`, `bcrypt`, cost 12); `auth.service.ts:602-634`, `tokens.service.ts:83-85,111`
- Đáp án: bcrypt cost 12, trong `@BeforeInsert hashPassword` (guard `/^\$2[aby]\$\d{2}\$/` để không băm lại). Token: `randomBytes(32).base64url`, lưu **sha256 hex**, `selector = randomUUID()`, hạn **1 giờ**.

**D3 (câu 21).** Refresh token có được **rotate** không? Lưu ở DB dạng gì? Cơ chế phát hiện tái sử dụng (reuse detection) hoạt động ra sao, và "grace window" 10s để làm gì?
- Đối chiếu: `auth.service.ts:265-367`; `session.entity.ts:34-36`
- Đáp án: có rotate; lưu **sha256** (`refreshTokenHash`, `select:false`). Lookup theo hash trong transaction; nếu trong `ROTATION_GRACE_MS=10_000` từ `rotatedAt` → cấp access token mà không rotate (cho phép nhiều tab đua nhau); ngoài grace mà token đã rotate → **revoke MỌI session của user** + 401 (đây là reuse detection: giữ row cũ nên phát hiện được token đã dùng lại).

**D4 (câu 22).** OAuth chống CSRF bằng cơ chế gì (KHÔNG dùng session-store của passport)? Cookie `oauth_state` có những flag nào và tại sao `sameSite` phải là `'lax'` chứ không `'strict'`?
- Đối chiếu: `common/guard/oauth-state.ts:15-44,67-116`
- Đáp án: **double-submit cookie**. Mint `randomBytes(32).base64url`, set cookie `oauth_state` (`httpOnly`, `sameSite:'lax'`, `path:'/auth'`, `secure` theo config, `maxAge` 10 phút). Callback: xoá cookie trước (single-use), rồi `timingSafeEqual` so với `req.query.state`. Phải `lax` vì `strict` sẽ không gửi cookie khi user quay về từ redirect của provider (cross-site navigation).

**D5 (câu 23 — ĐIỂM CĂNG).** Khi OAuth callback về mà **email đó đã tồn tại** dưới một account password sẵn có, code làm gì? Đây là rủi ro bảo mật gì?
- Đối chiếu: `users.service.ts:76-110` (đặc biệt `:91-100`)
- Đáp án: nếu tồn tại user cùng email → **link im lặng** provider account vào user đó và đăng nhập luôn, **không kiểm tra provider đã verify email chưa**. Là **pre-emptive account takeover**: kẻ tấn công tạo OAuth với email nạn nhân (Facebook/GitHub có thể mang email chưa verify) rồi chiếm account password.

**D6 (câu 24).** Access token và refresh token đi qua đâu — cookie hay body? Refresh cookie có `path`/`domain` gì? Ý nghĩa cross-site?
- Đối chiếu: `auth.service.ts:687-699` (`setCookie`); `auth.controller.ts:73-75`
- Đáp án: refresh → **cookie** `refresh_token` (`httpOnly`, `secure` default true, `sameSite` default lax, **không set path ⇒ `/`, không set domain ⇒ host-only**). Access → **body**. `sameSite` là site-scoped: `app.example.com ↔ api.example.com` là same-site nên lax chạy; nếu web ở registrable domain khác thật thì cần `COOKIE_SAME_SITE=none` + `COOKIE_SECURE=true`. Vì cookie scope `/`, nó gửi tới cả endpoint public — nên thu hẹp về `path:'/auth'` sẽ hợp lý.

**D7 (câu 25).** `POST /auth/dev/login` được gate bằng **mấy lớp**? Liệt kê. Nó có `@Throttle` không?
- Đối chiếu: `auth.controller.ts:84-110`; `configuration.ts:45`; `env.validation.ts:97-104`
- Đáp án: 3 lớp — (1) `DEV_AUTH_BYPASS==='true'`, (2) `NODE_ENV!=='production'` (fail → **404** không phải 403), (3) env validation từ chối boot nếu `DEV_AUTH_BYPASS=true` khi prod. Gate đúng. Nhưng **không có `@Throttle`**.

**D8 (câu 26 — ĐIỂM CĂNG).** User tạo qua OAuth được đặt mật khẩu gì? Chạy mắt qua `users.service.ts` chỗ tạo user. Vì sao đây là lỗ hổng nghiêm trọng?
- Đối chiếu: `users.service.ts:93-99` (`password: basePassword ?? providerUserId`)
- Đáp án: mọi OAuth user nhận **cùng một mật khẩu đã biết** = `BASE_PASSWORD`. `@BeforeInsert` băm nó → `POST /auth/login` chấp nhận. Ai biết `BASE_PASSWORD` đăng nhập được **bất kỳ** OAuth user nào qua email. Nếu `BASE_PASSWORD` trống → mật khẩu = `providerUserId` (id Google/GitHub **công khai**). Đúng ra OAuth account phải `password: null`.

---

## Mảng E — "Cái calc" (badminton splitter)

**E1 (câu 27).** Logic tiền/làm tròn nằm ở đâu — trong service, controller, hay package? Đơn vị làm tròn là bao nhiêu, và ai "gánh" phần dư làm tròn?
- Đối chiếu: `packages/badminton-calc/src/index.ts:61,66-67,177`
- Đáp án: toàn bộ ở **package** `@repo/badminton-calc`, hàm `computeSplit`. `ROUND_UNIT = 1000`; `roundingResidual = expense - Σ totals` do **organizer gánh**. Service chỉ tạo id participant trước INSERT rồi freeze snapshot vào `badminton_session.computed` (jsonb).

**E2 (câu 28 — ĐIỂM CĂNG).** Có `apps/api/src/badminton/badminton.calc.ts` VÀ `packages/badminton-calc`. Cái nào được import thật? Chạy grep. Verdict về duplication?
- Đối chiếu: `badminton.service.ts:6` (`import { computeSplit } from '@repo/badminton-calc'`); grep `./badminton.calc`
- Đáp án: service/entity/test đều import **package**. **Không gì** import `./badminton.calc` (nó chỉ import file types của chính nó). → `badminton.calc.ts` là **bản sao chết, gần như byte-for-byte** của package. Kéo theo chết cùng: `types/computed-snapshot.ts` và 3 file `dto/*.ts` (đã có bản dùng thật trong `badminton.dto.ts`). **6 file chết — nên xoá.**

**E3 (câu 29).** Discount được redistribute thế nào để tổng vẫn khớp expense? Thuật toán chia phần lẻ (rounding) tên gì, và tại sao một session giảm giá 100% lại thu 0 chứ không "chế" ra một khoản?
- Đối chiếu: `packages/badminton-calc/src/index.ts:126-155`
- Đáp án: discount là whole-bill, rescale một lần `scale = expense / Σ eff` để Σ vẫn = expense. Chia lẻ bằng **largest-remainder**; `collectTarget` lấy từ Σ raw nên giảm 100% → target 0 → thu 0.

---

## Rubric tự chấm (mỗi câu 0–3đ)

| Điểm | Nghĩa |
|------|-------|
| **3** | Trả lời từ nguyên lý TRƯỚC khi mở đáp án, chỉ đúng `file:line`, nêu được cả *hệ quả* nếu làm sai. |
| **2** | Đúng ý chính nhưng phải mở code mới nhớ ra chi tiết, hoặc thiếu phần "hệ quả/tại sao". |
| **1** | Chỉ nhớ mang máng "có cái gì đó ở đây", không tái tạo được lập luận. |
| **0** | Không trả lời được, hoặc trả lời sai nguyên lý. |

**Cách đọc điểm theo mảng** (mỗi mảng quy về trung bình):
- **≥ 2.5**: bạn sở hữu mảng đó. Chuyển mảng khác.
- **1.5–2.4**: đọc hiểu nhưng chưa sở hữu. Làm lại sau 2 ngày, che đáp án kỹ hơn.
- **< 1.5**: lỗ hổng thật. **Gửi lại câu trả lời của bạn cho mảng đó** để được chấm gắt (chỉ ra chỗ tưởng hiểu mà chưa + đào sâu, không đưa đáp án luôn).

**Ba câu bản lề** (16, 17, 18 = C5, C6, C7): tự soi ra `OwnershipGuard` stub mâu thuẫn, `LoggingInterceptor` chưa wire, `VersionMiddleware` bị bỏ — mà **không cần gợi ý** — thì bạn đã lên nấc "sở hữu codebase". Không soi ra → đó chính là khứu giác cần khôi phục.

---

### Ghi chú cho người ra đề (không phải câu hỏi)
Ba điểm căng ở mảng C **đã được verify bằng grep trên repo thật** — không phải suy đoán:
`OwnershipGuard`, `LoggingInterceptor`, `VersionMiddleware` đều không được wire ở bất kỳ đâu ngoài chính file định nghĩa (hoặc dòng comment). Mảng D còn nhiều điểm căng nặng hơn (câu 19, 23, 26) là **bug bảo mật thật**, không chỉ code chết — đó là lý do chúng được đưa vào bộ đề.
